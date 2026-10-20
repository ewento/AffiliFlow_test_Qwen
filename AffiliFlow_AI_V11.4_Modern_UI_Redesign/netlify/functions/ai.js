// AffiliFlow AI V10 — Netlify Function (Gemini backend)
// POST { task: "intel"|"story"|"problem"|"video", fields, intel, half, feedback, images:[dataURL] }
//  -> 200 { ok:true, data:{...}, model }   or   { ok:false, error, retryable }
// Each call is small (one tab / half a tab) so it finishes inside Netlify's synchronous limit.
import { buildTask } from "./prompts.js";

const BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta/models";
const PRIMARY = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const configuredFallback = process.env.GEMINI_FALLBACK_MODEL;
const FALLBACK = !configuredFallback || configuredFallback === "gemini-2.5-flash-lite"
  ? "gemini-3.5-flash-lite"
  : configuredFallback;
const BUDGET_MS = Number(process.env.AI_BUDGET_MS) || 54000; // Netlify sync functions stop at 60s
const MAX_IMAGES = 6;
const MAX_BODY = 5.5 * 1024 * 1024; // Netlify buffered payload limit is 6 MB

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-access-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: HEADERS });
const fail = (error, status = 500, retryable = false) => reply({ ok: false, error, retryable }, status);

const env = (k) => (typeof Netlify !== "undefined" && Netlify.env ? Netlify.env.get(k) : undefined) || process.env[k];

function clip(s, n) { return String(s ?? "").slice(0, n); }
function cleanFields(f = {}) {
  return {
    name: clip(f.name, 300), price: clip(f.price, 20), target: clip(f.target, 400), affiliateUrl: clip(f.affiliateUrl, 1200),
    points: (Array.isArray(f.points) ? f.points : []).slice(0, 12).map((x) => clip(x, 300)),
    style: clip(f.style, 60), videoStyle: clip(f.videoStyle, 100), sceneType: clip(f.sceneType, 60),
    background: clip(f.background, 200),
    removeBgText: !!f.removeBgText, removeBgGraphics: !!f.removeBgGraphics, protectProductText: !!f.protectProductText,
    manualSlash: (Array.isArray(f.manualSlash) ? f.manualSlash : []).filter((x) => /^\/[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 12),
  };
}

function imageParts(images) {
  const out = [];
  for (const url of (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES)) {
    const m = String(url || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (m) out.push({ inlineData: { mimeType: m[1], data: m[2] } });
  }
  return out;
}

function extractText(result) {
  const parts = (result?.candidates || []).flatMap((c) => c?.content?.parts || []);
  return parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text).join("").trim();
}

function tryParse(text) {
  const t = String(text || "").replace(/^﻿/, "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(t); } catch (_) {}
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } catch (_) {}
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch (_) {} }
  return null;
}

// Deterministic cleanup for video prompts: fix known label typos and enforce the
// A-to-B continuity anchor without rewriting the model's creative directions.
function normalizeVideoData(data) {
  if (!data || !Array.isArray(data.videos)) return data;
  for (const item of data.videos) {
    if (!item || typeof item !== "object") continue;
    const endFrame = String(item.endFrameA || "").trim().replace(/[.\s]+$/, "");
    for (const key of ["clipA", "clipB"]) {
      const clip = item[key];
      if (!clip || typeof clip !== "object" || typeof clip.prompt !== "string") continue;
      clip.prompt = clip.prompt
        .replace(/ACTION\s*AND\s*BLOCKING/gi, "ACTION AND BLOCKING")
        .replace(/ACTIONAND\s*BLOCKING/gi, "ACTION AND BLOCKING")
        .replace(/COMPOSITION\s*AND\s*END\s*FRAME/gi, "COMPOSITION AND END FRAME");
      if (key === "clipA" && endFrame && !/END FRAME:/i.test(clip.prompt)) {
        clip.prompt = `${clip.prompt.trim()} END FRAME: ${endFrame}.`;
      }
      if (key === "clipB" && endFrame) {
        const anchor = `Continue directly from Clip A's final frame: ${endFrame}.`;
        const opening = /OPENING SHOT AND STORY:\s*/i;
        if (opening.test(clip.prompt)) {
          const start = clip.prompt.match(opening);
          const afterLabel = clip.prompt.slice(start[0].length);
          if (!afterLabel.startsWith(anchor)) {
            const withoutOldAnchor = afterLabel.replace(/^Continue directly from Clip A's final frame:\s*[^.]*\.\s*/i, "");
            clip.prompt = clip.prompt.replace(opening, `${start[0]}${anchor} ${withoutOldAnchor}`);
          }
        } else {
          clip.prompt = `OPENING SHOT AND STORY: ${anchor} ${clip.prompt.trim()}`;
        }
      }
    }
  }
  return data;
}

async function callGemini(model, apiKey, spec, parts, { useSchema, useThinking }, signal) {
  const generationConfig = {
    temperature: spec.temperature,
    maxOutputTokens: spec.maxTokens,
    responseMimeType: "application/json",
  };
  if (useSchema) generationConfig.responseSchema = spec.schema;
  if (useThinking && typeof spec.thinking === "number") generationConfig.thinkingConfig = { thinkingBudget: spec.thinking };
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: spec.system }] },
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
    signal,
  });
  const raw = await res.text();
  let result = {};
  try { result = JSON.parse(raw); } catch (_) {}
  return { ok: res.ok, status: res.status, result, message: result?.error?.message || "" };
}

export default async (request) => {
  if (request.method === "OPTIONS") return reply({}, 204);
  if (request.method !== "POST") return fail("Method not allowed", 405);

  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) return fail("GEMINI_API_KEY belum ditetapkan di Netlify → Site configuration → Environment variables.", 500);

  const access = env("APP_ACCESS_CODE");
  if (access && request.headers.get("x-access-code") !== access) return fail("Kod akses diperlukan.", 401);

  const started = Date.now();
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return fail("Gambar terlalu besar. Kecilkan atau kurangkan bilangan gambar.", 413);
    const body = JSON.parse(text);

    const spec = buildTask(body.task, {
      fields: cleanFields(body.fields),
      intel: body.intel && typeof body.intel === "object" ? body.intel : {},
      half: body.half === 2 ? 2 : 1,
      hasCharacter: !!body.hasCharacter,
      recommendations: body.recommendations && typeof body.recommendations === "object" ? body.recommendations : {},
      feedback: clip(body.feedback, 3000),
    });
    if (!spec) return fail("Task tidak dikenali.", 400);

    const parts = [{ text: spec.text }, ...imageParts(body.images)];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BUDGET_MS);

    // Attempt ladder: full config -> without thinking config -> without schema -> fallback model.
    const ladder = [
      [PRIMARY, { useSchema: true, useThinking: true }],
      [PRIMARY, { useSchema: true, useThinking: false }],
      [PRIMARY, { useSchema: false, useThinking: false }],
      [FALLBACK, { useSchema: true, useThinking: false }],
    ];
    let last = null;
    try {
      for (let i = 0; i < ladder.length; i++) {
        const [model, mode] = ladder[i];
        if (model === FALLBACK && Date.now() - started > BUDGET_MS * 0.6) break; // not enough time left
        last = await callGemini(model, apiKey, spec, parts, mode, controller.signal);
        if (last.ok) {
          let data = tryParse(extractText(last.result));
          const reason = last.result?.candidates?.[0]?.finishReason;
          if (data) {
            if (body.task === "video") data = normalizeVideoData(data);
            return reply({ ok: true, data, model, finishReason: reason });
          }
          last = { ok: false, status: 502, message: reason === "MAX_TOKENS" ? "Respons AI terpotong (MAX_TOKENS)." : "Respons AI bukan JSON yang sah." };
          if (reason === "MAX_TOKENS") break;
          continue;
        }
        // 400 = config not accepted (thinking/schema) -> next rung. 429/5xx/404 -> jump to fallback model.
        if (last.status === 400) continue;
        if ([404, 429, 500, 502, 503, 504].includes(last.status) && i < ladder.length - 1) { i = ladder.length - 2; continue; }
        break;
      }
    } finally {
      clearTimeout(timer);
    }

    const status = last?.status || 502;
    return fail(last?.message || `Gemini API error ${status}`, 502, [429, 500, 502, 503, 504].includes(status) || /JSON|terpotong/.test(last?.message || ""));
  } catch (err) {
    if (err?.name === "AbortError") return fail("AI mengambil masa terlalu lama. Cuba lagi.", 504, true);
    return fail(err?.message || "Permintaan gagal.", 500);
  }
};
