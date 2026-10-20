/* AffiliFlow AI V10 — front-end
 * Flow: intel (1 call) -> Story (2 calls) + Problem-to-CTA (1 call) + Video (2 calls) in parallel.
 * Every call is small so it finishes inside Netlify's synchronous function limit, and each tab can be regenerated alone. */
'use strict';
const $ = id => document.getElementById(id);
const cleanLines = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ constants (keep in sync with netlify/functions/prompts.js) */
const STORY_SLOTS = [
  { time: '6:30 AM', mood: 'tenang & ringan', why: 'Selepas subuh, orang scroll sebelum bersiap — feed masih sunyi dan perhatian penuh.' },
  { time: '8:00 AM', mood: 'praktikal & cepat dibaca', why: 'Waktu ke tempat kerja / hantar anak — puncak buka telefon, ayat perlu pendek.' },
  { time: '10:00 AM', mood: 'ingin tahu', why: 'Rehat pagi — mood belajar sesuatu yang berguna.' },
  { time: '12:30 PM', mood: 'ringan & geli hati', why: 'Waktu makan tengah hari — scroll santai, content ringan paling laku.' },
  { time: '3:00 PM', mood: 'empati', why: 'Tenaga petang menurun — orang cari idea dan hiburan ringan.' },
  { time: '5:30 PM', mood: 'penat tapi lega', why: 'Waktu balik kerja — menunggu/dalam perjalanan, mood mahu rehat.' },
  { time: '7:45 PM', mood: 'hangat & kasih', why: 'Selepas Maghrib & makan malam — mood keluarga dan kasih sayang.' },
  { time: '9:00 PM', mood: 'mendalam & bercerita', why: 'Puncak aktiviti media sosial selepas Isyak — orang sanggup baca lebih panjang.' },
  { time: '10:00 PM', mood: 'reflektif & tenang', why: 'Sebelum tidur — keputusan membeli dibuat dengan tenang.' },
  { time: '11:00 PM', mood: 'lembut & tanpa tekanan', why: 'Pemburu "checkout" lewat malam; persaingan content rendah.' },
];
const PROBLEM_TIMES = ['6:00 AM', '11:00 AM', '1:00 PM', '4:00 PM', '6:00 PM', '9:00 PM'];
const PROBLEM_PARTS = [
  ['hook', 'Hook'], ['problem', 'Problem'], ['agitation', 'Agitation'], ['solution', 'Solution'],
  ['benefit', 'Benefit'], ['proof', 'Proof (fakta sahih)'], ['cta', 'CTA'],
];
const TABS = [['story', '📝 STORY CONTENT · 10'], ['problem', '🧩 PROBLEM → CTA · 6'], ['video', '🎬 VIDEO PROMPTS · 6 VIDEO']];

/* ------------------------------------------------------------------ state */
let productRefs = [];
let characterImageData = '';
let kit = emptyKit();
let activeTab = 'story';
let isGenerating = false;

function emptyKit() {
  return { version: 11, intel: null, story: [], problem: [], video: [], recommendations: null, qa: {}, errors: {}, status: {}, generatedAt: null };
}
const hasKit = () => !!(kit.intel || kit.story.length || kit.problem.length || kit.video.length || Object.values(kit.status).some(Boolean));

/* ------------------------------------------------------------------ small UI helpers */
function toast(msg) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 1800);
}
function copyText(text) {
  const done = () => toast('Disalin ✓');
  const fallback = () => {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
    catch (e) { toast('Tidak dapat copy automatik — sila copy manual.'); }
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback); else fallback();
}
function setStatus(msg, type = 'info') { $('intelStatus').innerHTML = `<span class="aiStatus ${type}">${msg}</span>`; }
function normalizeUrl(u) { let x = String(u || '').trim(); if (!x) return ''; if (!/^https?:\/\//i.test(x)) x = 'https://' + x; return x; }

/* ------------------------------------------------------------------ slash palette (form) */
function showSlashCategory(category) {
  document.querySelectorAll('.slashCategory').forEach(el => el.classList.toggle('active', el.dataset.slashCategory === category));
  document.querySelectorAll('.slashCategoryTab').forEach(el => { const a = el.dataset.slashTab === category; el.classList.toggle('active', a); el.setAttribute('aria-selected', a ? 'true' : 'false'); });
}
function addSlash(cmd) { const el = $('slashCommands'); if (!el) return; const arr = cleanLines(el.value); if (!arr.includes(cmd)) arr.push(cmd); el.value = arr.join('\n'); schedulePersist(); }
function getManualSlash() { return cleanLines($('slashCommands')?.value || '').filter(x => /^\/[A-Za-z0-9_-]+$/.test(x)); }

function getFieldSummary() {
  return {
    name: $('name').value.trim(), creatorName: $('creatorName')?.value.trim() || '', productDescription: $('productDescription')?.value.trim() || '', price: $('price').value.trim(), target: $('target').value.trim(),
    points: cleanLines($('points').value), style: $('style').value,
    videoStyle: $('videoStyle').value, sceneType: $('sceneType').value, affiliateUrl: normalizeUrl($('affiliateUrl').value),
    background: ($('newBackground').value === 'Custom background') ? $('customBackground').value.trim() : $('newBackground').value,
    removeBgText: $('removeBgText').checked, removeBgGraphics: $('removeBgGraphics').checked, protectProductText: $('protectProductText').checked,
    manualSlash: getManualSlash(),
  };
}

/* ------------------------------------------------------------------ images */
function imageToCompressedDataURL(file, maxSide = 1100, quality = .76) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = rd.result;
    };
    rd.onerror = reject; rd.readAsDataURL(file);
  });
}
function renderProductGallery() {
  const g = $('productGallery'); if (!g) return; g.innerHTML = '';
  productRefs.forEach((src, i) => { const img = document.createElement('img'); img.src = src; img.alt = 'Product reference ' + (i + 1); g.appendChild(img); });
  $('productCount').textContent = productRefs.length ? `${productRefs.length}/5 gambar dipilih` : '';
}
$('productImages').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 5); if (!files.length) return;
  setStatus('Memproses gambar produk…');
  try { productRefs = []; for (const f of files) productRefs.push(await imageToCompressedDataURL(f)); renderProductGallery(); await persistSession(); setStatus(`${productRefs.length} gambar produk disimpan.`, 'ok'); }
  catch (err) { setStatus('Gagal memproses gambar produk.', 'error'); console.error(err); }
});
$('characterImage').addEventListener('change', async e => {
  const f = e.target.files?.[0]; if (!f) return;
  try { characterImageData = await imageToCompressedDataURL(f, 1000, .76); $('characterPreview').innerHTML = `<img src="${characterImageData}" alt="Character reference">`; $('characterPreview').style.display = 'block'; await persistSession(); }
  catch (err) { setStatus('Gagal memproses character reference.', 'error'); }
});
function imagesFor(task) {
  const prod = task === 'intel' ? productRefs : productRefs.slice(0, task === 'video' ? 3 : 2);
  return characterImageData ? [...prod, characterImageData] : [...prod];
}

/* ------------------------------------------------------------------ API */
function accessCode() { try { return localStorage.getItem('affiliflow_code') || ''; } catch (e) { return ''; } }
function saveAccessCode(c) { try { localStorage.setItem('affiliflow_code', c); } catch (e) {} }

async function api(task, extra = {}, tries = 2) {
  const body = { task, fields: getFieldSummary(), images: imagesFor(task), hasCharacter: !!characterImageData, ...extra };
  let lastErr = null;
  for (let n = 0; n < tries; n++) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const code = accessCode(); if (code) headers['x-access-code'] = code;
      // Netlify uses its native function route. The local/StackBlitz Node server
      // also exposes /api/ai; try it if the preview host returns an HTML shell.
      let r, raw, data = null, lastPreview = '';
      for (const endpoint of ['/.netlify/functions/ai', '/api/ai']) {
        try {
          r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
          raw = await r.text();
          try { data = JSON.parse(raw); } catch (_) { data = null; }
          if (data || r.status !== 200) break;
          lastPreview = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
        } catch (endpointError) { lastPreview = endpointError.message || ''; }
      }
      if (r.status === 401) {
        const c = prompt('Masukkan kod akses AffiliFlow AI:');
        if (c) { saveAccessCode(c.trim()); n--; continue; }
        throw Object.assign(new Error('Kod akses diperlukan.'), { fatal: true });
      }
      if (!data) { const preview = (lastPreview || String(raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 220); const e = new Error(`Endpoint AI tidak memulangkan JSON (HTTP ${r?.status || 'tiada respons'}). ${preview || 'Pastikan projek dijalankan dengan npm start dan bukan preview HTML statik.'}`); e.retryable = r?.status >= 500 || r?.status === 200; throw e; }
      if (!r.ok || !data.ok) { const e = new Error(data.error || `Ralat AI (HTTP ${r.status})`); e.retryable = !!data.retryable; e.fatal = r.status === 500 && /GEMINI_API_KEY/.test(data.error || ''); throw e; }
      return data.data;
    } catch (e) {
      lastErr = e;
      if (e.fatal || !(e.retryable || e instanceof TypeError) || n === tries - 1) break;
      await sleep(1500 * (n + 1));
    }
  }
  if (lastErr instanceof TypeError) lastErr = new Error('Tiada sambungan ke server. Semak internet anda.');
  throw lastErr;
}

/* ------------------------------------------------------------------ text cleaning */
function cleanText(t, url) {
  let x = String(t || '');
  if (url) x = x.split(url).join(' ');
  x = x.replace(/https?:\/\/\S+/g, ' ').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ');
  return x.replace(/[ \t]{2,}/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const cleanTags = tags => (Array.isArray(tags) ? tags : []).flatMap(t => AffiliQA.tagsFromItem(t)).filter((t, i, a) => t.length >= 3 && t.length <= 28 && a.indexOf(t) === i).slice(0, 6);
const wordsIn = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;

function qaCtx(fields) { return { userName: fields.name || '', points: (fields.points || []).join(' \n '), target: fields.target || '' }; }

/* ------------------------------------------------------------------ INTEL */
async function runIntel() {
  const fields = getFieldSummary();
  const d = await api('intel');
  d.shortName = AffiliQA.resolveShortName({ productIntelligence: d }, { userName: fields.name });
  if (!d.productLock) d.productLock = 'Product exactly as shown in the reference image(s): ' + (d.visualIdentity || []).join('; ');
  kit.intel = d;
}

/* ------------------------------------------------------------------ STORY */
function normalizeStory(list, url) {
  return list.map((s, i) => ({
    id: i + 1, time: STORY_SLOTS[i].time,
    mood: String(s.mood || '').trim(), angle: String(s.angle || '').trim(), context: String(s.context || '').trim(),
    hookType: String(s.hookType || '').trim(), ctaType: String(s.ctaType || '').trim(), visualDetail: String(s.visualDetail || '').trim(),
    story: cleanText(s.story, url), short: cleanText(s.short, url), hashtags: cleanTags(s.hashtags),
  }));
}
function checkStory(items, fields) {
  const r = AffiliQA.checkItems(items, qaCtx(fields), { fields: ['story', 'short'], textOf: p => p.story, openField: 'story', closeField: 'story', expected: 10, minWords: 70, maxWords: 230, shortName: kit.intel?.shortName });
  // Story outputs use different fields from Problem-to-CTA, so run a dedicated cross-story audit.
  const seenAngles = new Map(), seenContexts = new Map();
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  items.forEach((p, i) => {
    const id = p.id || i + 1, angle = norm(p.angle), context = norm(p.context);
    if (angle) { const prev = seenAngles.get(angle); if (prev) r.warnings.push({ code: 'repeated-story-angle', post: id, message: `Story ${id}: angle sama dengan Story ${prev}. Tukar tujuan cerita, bukan sekadar ubah ayat.` }); else seenAngles.set(angle, id); }
    if (context) { const prev = seenContexts.get(context); if (prev) r.warnings.push({ code: 'repeated-story-context', post: id, message: `Story ${id}: konteks sama dengan Story ${prev}. Gunakan situasi atau persona yang benar-benar berbeza.` }); else seenContexts.set(context, id); }
  });
  const prices = new Map();
  items.forEach((p, i) => { (String(p.story || '').match(/\bRM\s?\d+(?:[.,]\d{2})?\b/gi) || []).forEach(x => { const k = x.replace(/\s+/g, '').toUpperCase(); prices.set(k, (prices.get(k) || 0) + 1); }); });
  prices.forEach((count, price) => { if (count >= 4) r.warnings.push({ code: 'repeated-story-price', post: 0, message: `Harga ${price} disebut dalam ${count} Story. Hadkan kepada 1–2 Story supaya kandungan tidak berulang dan setiap Story memberi nilai berbeza.` }); });
  r.ok = r.errors.length === 0;
  return r;
}
async function runStory() {
  const fields = getFieldSummary(), url = fields.affiliateUrl;
  const gen = async (h, fb) => {
    const d = await api('story', { intel: kit.intel, half: h, feedback: fb || '' });
    if (!Array.isArray(d.stories) || d.stories.length < 5) throw new Error('AI tidak menghasilkan 5 story lengkap.');
    return d.stories.slice(0, 5);
  };
  const halves = await Promise.all([gen(1), gen(2)]);
  let items = normalizeStory([...halves[0], ...halves[1]], url);
  let qa = checkStory(items, fields);
  for (let round = 0; round < 2 && (qa.errors.length || qa.warnings.length); round++) {
    const issues = [...qa.errors, ...qa.warnings];
    const bad = new Set(issues.filter(e => e.post > 0).map(e => (e.post <= 5 ? 1 : 2)));
    if (!bad.size) break;
    setStatus(`📝 Semakan kualiti Story: ${qa.errors.length} isu — menulis semula (${round + 1}/2)…`);
    for (const h of bad) {
      const fb = [...qa.errors, ...qa.warnings].filter(e => e.post > 0 && (e.post <= 5 ? 1 : 2) === h).map(e => '- ' + e.message).join('\n');
      try {
        const fresh = await gen(h, fb);
        const cand = [...items.map(x => ({ ...x }))];
        normalizeStory(fresh, url).forEach((s, i) => { const idx = (h - 1) * 5 + i; cand[idx] = { ...s, id: idx + 1, time: STORY_SLOTS[idx].time }; });
        const next = checkStory(cand, fields);
        const score = q => q.errors.length * 100 + q.warnings.length;
        if (score(next) < score(qa)) { items = cand; qa = next; }
      } catch (e) { console.warn('story retry failed', e); }
    }
  }
  kit.story = items; kit.qa.story = qa;
}

/* ------------------------------------------------------------------ PROBLEM → CTA */
function assembleProblem(p) {
  const j = (...a) => a.map(x => String(x || '').trim()).filter(Boolean).join(' ');
  return [p.hook, j(p.problem, p.agitation), j(p.solution, p.benefit, p.proof), p.cta].map(x => String(x || '').trim()).filter(Boolean).join('\n\n');
}
function normalizeProblem(list, url) {
  return list.slice(0, 6).map((p, i) => {
    const o = { id: i + 1, time: PROBLEM_TIMES[i], funnel: String(p.funnel || ['TOFU','TOFU','MOFU','MOFU','MOFU','BOFU'][i]).trim(), focus: String(p.focus || '').trim(), emotion: String(p.emotion || '').trim(), emotionTechnique: String(p.emotionTechnique || '').trim(), context: String(p.context || '').trim(), visualDetail: String(p.visualDetail || '').trim(), hashtags: cleanTags(p.hashtags) };
    PROBLEM_PARTS.forEach(([k]) => { o[k] = cleanText(p[k], url); });
    return o;
  });
}
function checkProblem(items, fields) {
  const r = AffiliQA.checkItems(items, qaCtx(fields), { fields: PROBLEM_PARTS.map(x => x[0]), textOf: assembleProblem, openField: 'hook', closeField: 'cta', expected: 6, minWords: 200, maxWords: 330, shortName: kit.intel?.shortName });
  items.forEach(p => { if (wordsIn(p.hook) > 30) r.warnings.push({ post: p.id, message: `Item ${p.id}: hook panjang (${wordsIn(p.hook)} patah perkataan).` }); });
  const emos = items.map(p => (p.emotion || '').toLowerCase()).filter(Boolean);
  if (new Set(emos).size < Math.min(4, emos.length)) r.errors.push({ code: 'emotion', post: 0, message: 'Terlalu banyak post menggunakan emosi yang sama. Gunakan enam emosi berbeza.' });
  // Product Claim & Evidence Engine: distinguish unsupported claims from visual observations.
  const claimContext = {
    ...qaCtx(fields),
    verifiedFacts: (kit.intel?.verifiedFacts || []).join(' '),
    productFacts: (kit.intel?.productFacts || []).join(' ')
  };
  items.forEach(p => {
    const text = assembleProblem(p);
    AffiliQA.classifyProductClaims(text, claimContext).forEach(c => {
      // 'Memudahkan' about budgeting/price comparison is not a product-performance claim.
      if (c.match && /^memudahkan$/i.test(c.match)) {
        const sentence = text.split(/(?<=[.!?])\s+|\n/).find(part => part.toLowerCase().includes(c.match.toLowerCase())) || '';
        if (/\b(bajet|budget|harga|kos|perbelanjaan|kemampuan|banding harga|rancang belanja)\b/i.test(sentence)) return;
      }
      if (c.category === 'source') {
        r.errors.push({ code: 'unverified-source', post: p.id,
          message: `Post ${p.id}: frasa "${c.match}" mendakwa sumber rasmi yang tidak disahkan oleh sistem. Buang rujukan rasmi atau masukkan fakta sebenar yang anda sahkan sendiri.` });
      } else {
        r.warnings.push({ code: 'unverified-claim', post: p.id,
          message: `Post ${p.id}: dakwaan ${c.type} "${c.match}" tidak dapat disahkan daripada input produk. Tukar kepada pemerhatian visual, atau nyatakan kepada pembeli: "Rujuk spesifikasi dan ulasan pembeli di listing."` });
      }
    });
    const proof = String(p.proof || '');
    const proofClaims = AffiliQA.classifyProductClaims(proof, claimContext);
    if (proofClaims.some(c => c.category === 'unverified' || c.category === 'source')) {
      r.errors.push({ code: 'weak-proof', post: p.id,
        message: `Post ${p.id}: bahagian Proof mengandungi dakwaan belum disahkan. Gunakan fakta input yang nyata atau arahan menyemak listing; jangan jadikan dakwaan sebagai bukti.` });
    }
    const proofHasAnchor = /\b(RM\s?\d|\d+(?:[.,]\d+)?\s?(?:ml|mL|cm|mm|inci|inch|%)|15%|label|logo|botol|penutup|tulisan|teks|nama produk|saiz|size|ukuran|bahan|material|corak|warna|semak|periksa|rujuk|listing|ulasan|senarai ramuan|variasi|butiran produk|gambar produk)\b/i.test(proof);
    if (proof && !proofHasAnchor) r.warnings.push({ code: 'weak-proof', post: p.id,
      message: `Post ${p.id}: Proof belum menunjukkan fakta khusus atau langkah semakan yang boleh dibuat pembeli.` });
  });
  // Cross-post story matrix: pain point + setting + solution, not context labels alone.
  const arcIssues = AffiliQA.storyArcCheck(items, assembleProblem);
  arcIssues.forEach(issue => {
    const target = issue.severity === 'warning' ? r.warnings : r.errors;
    target.push(issue);
  });
  const contexts = items.map(p => (p.context || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const contextCounts = contexts.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
  Object.entries(contextCounts).forEach(([context, count]) => { if (count >= 3) r.warnings.push({ post: 0, message: `Latar/setting yang sama digunakan ${count} kali. Pelbagaikan konteks atau angle; jangan sekadar menukar emosi dan CTA.` }); });
  r.ok = r.errors.length === 0; return r;
}
async function runProblem() {
  const fields = getFieldSummary(), url = fields.affiliateUrl;
  const gen = async fb => {
    const d = await api('problem', { intel: kit.intel, feedback: fb || '' });
    if (!Array.isArray(d.problemPosts) || d.problemPosts.length < 6) throw new Error('AI tidak menghasilkan 6 Problem-to-CTA posts lengkap.');
    return normalizeProblem(d.problemPosts, url);
  };
  let items = await gen(); let qa = checkProblem(items, fields);
  for (let round = 0; round < 2 && (qa.errors.length || qa.warnings.length); round++) {
    setStatus(`🧩 Semakan kualiti Problem-to-CTA: ${qa.errors.length + qa.warnings.length} isu — menulis semula (${round + 1}/2)…`);
    try { const next = await gen([...qa.errors, ...qa.warnings].slice(0, 20).map(e => '- ' + e.message).join('\n')); const nq = checkProblem(next, fields); const score = q => q.errors.length * 100 + q.warnings.length; if (score(nq) < score(qa)) { items = next; qa = nq; } }
    catch (e) { console.warn('problem retry failed', e); break; }
  }
  kit.problem = items; kit.qa.problem = qa;
}

/* ------------------------------------------------------------------ VIDEO */
function normalizeStack(stack) {
  const out = [];
  (Array.isArray(stack) ? stack : String(stack || '').split(/\s+/)).forEach(c => {
    const t = '/' + String(c || '').trim().replace(/^\/+/, '').replace(/[^A-Za-z0-9_-]/g, '');
    if (t.length > 3 && t.length <= 42 && !out.includes(t)) out.push(t);
  });
  return out.slice(0, 5);
}
function normalizeClip(c, productLock, clipLabel, endFrameA) {
  const stack = normalizeStack(c?.slashStack);
  let body = String(c?.prompt || '').replace(/^(\s*\/[A-Za-z0-9_-]+)+\s*/, '').trim(); // slash line is added here, never duplicated
  // Repair leaked template placeholder wording in generated prompt text.
  body = body.replace(/Preserve the exact productLock\s*:/gi, 'Preserve the exact product appearance:')
             .replace(/the exact productLock\s*:/gi, 'the exact product appearance:');
  // Repair a common model failure: Clip B repeats its whole continuity/action block twice.
  if (clipLabel === 'B') {
    const marker = /Continue directly from Clip A['’]s final frame:/ig;
    const first = marker.exec(body);
    if (first) {
      const second = marker.exec(body);
      if (second) body = body.slice(0, second.index).trim();
    }
  }
  // Deterministic repair: the QA requirement must not depend on the model remembering a section label.
  if (!/^REFERENCE\s*:/im.test(body)) {
    const lock = String(productLock || '').trim();
    const reference = lock
      ? `REFERENCE: Use the supplied product reference image as the visual source of truth. Product appearance lock: ${lock} Preserve only visible details; do not invent unclear text or specifications.`
      : 'REFERENCE: Use the user-supplied product reference image as the source of truth. If no image is supplied, keep product details generic and do not invent shape, label text, colour, logos or specifications.';
    body = `${reference}\n${body}`.trim();
  }
  if (clipLabel === 'B' && endFrameA && !/continue directly from clip a['’]s final frame/i.test(body)) {
    body = `OPENING SHOT AND STORY: Continue directly from Clip A's final frame: ${endFrameA}. Match the same camera viewpoint, product position, background and lighting before continuing the next action.\n${body}`.trim();
  }
  if (!/^\s*(?:AVOID|NEGATIVE CONSTRAINTS)\s*:/im.test(body)) {
    body += `\nNEGATIVE CONSTRAINTS: No subtitles, captions, floating text, watermarks, invented brand marks, fake specifications, unsupported claims, warped geometry, changing product colour or parts, malformed hands, extra fingers, flicker or sudden scene changes.`;
  }
  // Prevent oversized copy prompts while preserving product identity, continuity, required sections and negative constraints.
  let final = (stack.join(' ') + (stack.length ? '\n\n' : '') + body).trim();
  if (final.length > 2500) {
    const required = ['REFERENCE:', 'OPENING SHOT AND STORY:', 'PRODUCT IDENTITY LOCK:', 'ACTION AND BLOCKING:', 'CAMERA PLAN:', 'LIGHTING AND ART DIRECTION:', 'COMPOSITION AND END FRAME:', 'AUDIO:', 'NEGATIVE CONSTRAINTS:'];
    const lines = body.split('\n').map(x => x.trim()).filter(Boolean);
    const keep = [];
    for (const label of required) { const line = lines.find(x => x.toUpperCase().startsWith(label)); if (line && !keep.includes(line)) keep.push(line); }
    const compact = lines.filter(x => !keep.includes(x));
    body = [...keep, ...compact].join('\n');
    final = (stack.join(' ') + (stack.length ? '\n\n' : '') + body).trim();
    if (final.length > 2500) final = final.slice(0, 2490).replace(/\s+\S*$/, '') + '\nNEGATIVE CONSTRAINTS: No subtitles, floating text, watermarks, invented specs, product deformation, colour changes, malformed hands, flicker or sudden cuts.';
  }
  return { stack, body, final };
}
function normalizeVideos(list, startId, intel = {}) {
  return list.slice(0, 6).map((v, i) => {
    const endFrameA = String(v.endFrameA || 'The product remains stationary in a clear, stable composition matching the supplied reference image.').trim();
    return {
      id: startId + i, title: String(v.title || 'Video Idea').trim(), concept: String(v.concept || '').trim(), endFrameA,
      clipA: normalizeClip(v.clipA, intel.productLock, 'A', endFrameA),
      clipB: normalizeClip(v.clipB, intel.productLock, 'B', endFrameA),
    };
  });
}
const jacc = (a, b) => { const A = new Set(String(a).toLowerCase().split(/\W+/).filter(w => w.length > 3)), B = new Set(String(b).toLowerCase().split(/\W+/).filter(w => w.length > 3)); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / (A.size + B.size - n); };
function checkVideos(list) {
  const errors = [], warnings = [];
  list.forEach(v => {
    [['clipA', 'A'], ['clipB', 'B']].forEach(([k, L]) => {
      const c = v[k], id = v.id;
      if (c.stack.length < 2) errors.push({ post: id, message: `Video ${id} Clip ${L}: slash stack mesti 2-5 arahan.` });
      if (c.final.length < 700) errors.push({ post: id, message: `Video ${id} Clip ${L}: prompt terlalu ringkas (${c.final.length} aksara). Perlu lengkap: REFERENCE, SHOT, ACTION, SETTING, LIGHT & LOOK, AUDIO, CONTINUITY, AVOID.` });
      if (c.final.length > 2500) errors.push({ post: id, message: `Video ${id} Clip ${L}: ${c.final.length} aksara, melebihi had 2500. Ringkaskan huraian, kekalkan identiti produk dan continuity.` });
      // Normalize known labels before validation; underscore/hyphen variants are equivalent.
      const bodyForChecks = String(c.body || '')
        .replace(/ACTION[_\s-]+AND[_\s-]+BLOCKING/gi, 'ACTION AND BLOCKING')
        .replace(/CAMERA[_\s-]+PLAN/gi, 'CAMERA PLAN')
        .replace(/LIGHTING[_\s-]+AND[_\s-]+ART[_\s-]+DIRECTION/gi, 'LIGHTING AND ART DIRECTION')
        .replace(/COMPOSITION[_\s-]+AND[_\s-]+END[_\s-]+FRAME/gi, 'COMPOSITION AND END FRAME')
        .replace(/NEGATIVE[_\s-]+CONSTRAINTS/gi, 'NEGATIVE CONSTRAINTS');
      if (!/^REFERENCE\s*:/im.test(bodyForChecks)) errors.push({ post: id, message: `Video ${id} Clip ${L}: tiada baris REFERENCE (kunci imej rujukan produk).` });
      // Accept plain labels, Markdown-bold labels, and indented labels; normalizeClip may preserve formatting from the model.
      const negativeLabel = /^\s*(?:\*{1,3})?\s*(?:AVOID|NEGATIVE CONSTRAINTS)\s*:/im.test(bodyForChecks);
      if (!negativeLabel) errors.push({ post: id, message: `Video ${id} Clip ${L}: tiada baris AVOID atau NEGATIVE CONSTRAINTS; medan larangan visual wajib ada.` });
      const requiredSections = [
        ['REFERENCE', /REFERENCE\s*:/i],
        ['OPENING SHOT AND STORY', /OPENING SHOT AND STORY\s*:/i],
        ['PRODUCT IDENTITY LOCK', /PRODUCT IDENTITY LOCK\s*:/i],
        ['ACTION AND BLOCKING', /ACTION AND BLOCKING\s*:/i],
        ['CAMERA PLAN', /CAMERA PLAN\s*:/i],
        ['LIGHTING AND ART DIRECTION', /LIGHTING AND ART DIRECTION\s*:/i],
        ['COMPOSITION AND END FRAME', /COMPOSITION AND END FRAME\s*:/i],
        ['AUDIO', /AUDIO\s*:/i],
        ['NEGATIVE CONSTRAINTS', /NEGATIVE CONSTRAINTS\s*:/i]
      ];
      const sectionNames = requiredSections.map(([label]) => label);
      requiredSections.forEach(([label, re]) => {
        const match = re.exec(bodyForChecks);
        if (!match) {
          errors.push({ post: id, message: `Video ${id} Clip ${L}: bahagian wajib "${label}" tiada.` });
          return;
        }
        const start = match.index + match[0].length;
        const nextMatches = sectionNames.map(name => {
          const r = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'ig');
          let m, next = null;
          while ((m = r.exec(bodyForChecks))) { if (m.index >= start && (next === null || m.index < next)) next = m.index; }
          return next;
        }).filter(x => x !== null);
        const end = nextMatches.length ? Math.min(...nextMatches) : bodyForChecks.length;
        const sectionText = bodyForChecks.slice(start, end).replace(/[\s*`#>-]/g, '').trim();
        if (sectionText.length < 24) errors.push({ post: id, message: `Video ${id} Clip ${L}: bahagian "${label}" kosong atau terlalu umum; tulis arahan khusus sekurang-kurangnya satu ayat.` });
      });
    });
    if (!/continue directly from clip a['’]s final frame/i.test(v.clipB.body)) errors.push({ post: v.id, message: `Video ${v.id}: Clip B mesti bermula dengan arahan kesinambungan daripada frame akhir Clip A.` });
    if (jacc(v.clipA.body, v.clipB.body) > 0.75) errors.push({ post: v.id, message: `Video ${v.id}: Clip B terlalu serupa dengan Clip A; ia mesti memajukan aksi.` });
  });
  return { errors, warnings, ok: errors.length === 0 };
}
async function recommendVideoConcept() {
  if (!productRefs.length) throw new Error('Sila upload sekurang-kurangnya satu gambar produk dahulu.');
  if (!kit.intel) { setStatus('🧠 Mengenali produk daripada gambar…'); await runIntel(); }
  const rec = await api('recommend', { intel: kit.intel });
  if (!rec || !rec.concept || !Array.isArray(rec.clipASlash) || !Array.isArray(rec.clipBSlash)) throw new Error('AI tidak menghasilkan cadangan konsep dan slash yang lengkap.');
  kit.recommendations = rec;
  render();
  setStatus('Cadangan konsep dan slash tersedia. Semak pilihan sebelum Jana Tab 3.', 'ok');
  await persistSession();
}
async function runVideo() {
  if (!kit.recommendations) { await recommendVideoConcept(); }
  const manual = getManualSlash();
  const rec = { ...kit.recommendations, manualSlash: manual };
  const d = await api('video', { intel: kit.intel, recommendations: rec, feedback: '' });
  if (!Array.isArray(d.videos) || d.videos.length < 6) throw new Error('AI belum menghasilkan enam idea video lengkap. Cuba jana semula.');
  const list = normalizeVideos(d.videos.slice(0, 6), 1, kit.intel || {});
  const qa = checkVideos(list);
  if (qa.errors.length) {
    setStatus('🎬 Memperkemas prompt video berdasarkan semakan kualiti…');
    const fixed = await api('video', { intel: kit.intel, recommendations: rec, feedback: qa.errors.map(e => '- ' + e.message).join('\n') });
    if (Array.isArray(fixed.videos) && fixed.videos.length) {
      const candidate = normalizeVideos(fixed.videos.slice(0, 6), 1, kit.intel || {});
      const nextQA = checkVideos(candidate);
      const score = q => (q.errors || []).length * 100 + (q.warnings || []).length;
      if (score(nextQA) < score(qa)) { kit.video = candidate; kit.qa.video = nextQA; }
      else { kit.video = list; kit.qa.video = qa; }
    } else { kit.video = list; kit.qa.video = qa; }
  } else { kit.video = list; kit.qa.video = qa; }
}

/* ------------------------------------------------------------------ orchestration */
const RUNNERS = { story: runStory, problem: runProblem, video: runVideo };
const TAB_NAME = { story: '📝 Story', problem: '🧩 Problem→CTA', video: '🎬 Video' };
function progressLine() {
  const icon = s => s === 'running' ? '⏳' : s === 'done' ? '✅' : s === 'error' ? '⚠️' : '•';
  const intel = kit.intel ? '✅' : (isGenerating && !Object.values(kit.status).some(Boolean) ? '⏳' : '•');
  return `🧠 Produk ${intel} · ` + Object.keys(RUNNERS).map(t => `${TAB_NAME[t]} ${icon(kit.status[t])}`).join(' · ');
}
async function ensureProductInfo() {
  if (!productRefs.length) throw new Error('Sila upload sekurang-kurangnya 1 gambar produk.');
  if (!normalizeUrl($('affiliateUrl').value)) throw new Error('Sila masukkan pautan affiliate sebelum menjana content.');
  if (!kit.intel) await runIntel();
}
async function runTab(tab) {
  kit.status[tab] = 'running'; kit.errors[tab] = ''; render(); setStatus(progressLine());
  try { await ensureProductInfo(); await RUNNERS[tab](); kit.status[tab] = 'done'; kit.errors[tab] = ''; kit.generatedAt = new Date().toISOString(); }
  catch (e) { console.error(tab, e); kit.status[tab] = 'error'; kit.errors[tab] = e.message || 'Gagal dijana.'; setStatus(esc(kit.errors[tab]), 'error'); }
  render(); setStatus(progressLine(), kit.status[tab] === 'error' ? 'error' : 'ok');
}
async function generateTab(tab) {
  if (isGenerating || !RUNNERS[tab]) return;
  activeTab = tab; isGenerating = true; setBusy(true); render();
  try { await runTab(tab); }
  finally { isGenerating = false; setBusy(false); render(); persistSession(); }
}
async function regenTab(tab) { return generateTab(tab); }
async function requestVideoRecommendation() {
  if (isGenerating) return;
  activeTab = 'video'; isGenerating = true; setBusy(true); render();
  try { await ensureProductInfo(); await recommendVideoConcept(); kit.status.video = 'ready'; kit.errors.video = ''; }
  catch (e) { console.error(e); kit.errors.video = e.message || 'Gagal mendapatkan cadangan.'; setStatus(esc(kit.errors.video), 'error'); }
  finally { isGenerating = false; setBusy(false); render(); persistSession(); }
}
function setBusy(b) { document.querySelectorAll('.primary,[data-act="regen"],[data-act="generate-tab"],[data-act="recommend-video"]').forEach(x => { x.disabled = b; }); }

/* ------------------------------------------------------------------ rendering */
function bundle(text, tags) { return [text, normalizeUrl($('affiliateUrl').value), tags].filter(Boolean).join('\n\n'); }
const tagString = p => AffiliQA.formatTags(p.hashtags, 'story');

function qaCard(qa, label, okText) {
  if (!qa) return '';
  const e = qa.errors || [], w = qa.warnings || [], n = qa.notices || [];
  const claims = w.filter(x => ['unverified-claim', 'claim-needs-review'].includes(x.code));
  const otherWarnings = w.filter(x => !['unverified-claim', 'claim-needs-review'].includes(x.code));
  const list = a => a.slice(0, 12).map(x => `<li>${esc(x.message)}</li>`).join('');
  const status = e.length ? 'PERLU PENULISAN SEMULA' : claims.length ? 'LULUS BERSYARAT — SEMAK FAKTA' : (otherWarnings.length || n.length) ? 'LULUS BERSYARAT' : 'LULUS';
  return `<div class="result"><div class="rh">🛡️ SEMAKAN KUALITI ${esc(label)} <span>${status}</span></div><div class="rb">
    ${e.length ? `<div class="qaBlock errBlock"><b>⚠️ Ralat — perlu dibaiki (${e.length})</b><ul>${list(e)}</ul></div>` : ''}
    ${claims.length ? `<div class="qaBlock claimBlock"><b>🔍 Dakwaan perlu disahkan (${claims.length})</b><ul>${list(claims)}</ul><div class="small">Dakwaan ini belum semestinya salah, tetapi tidak disokong oleh fakta yang tersedia. Sahkan spesifikasi/listing atau tukar kepada pemerhatian visual atau arahan semakan pembeli.</div></div>` : ''}
    ${otherWarnings.length ? `<details open class="qaBlock warnBlock"><summary>⚠️ Cadangan / amaran (${otherWarnings.length})</summary><ul>${list(otherWarnings)}</ul></details>` : ''}
    ${n.length ? `<details class="qaBlock noteBlock"><summary>💡 Cadangan penambahbaikan (${n.length})</summary><ul>${list(n)}</ul></details>` : ''}
    ${!e.length && !w.length && !n.length ? (okText || '✅ Tiada isu yang dikesan oleh semakan automatik.') : ''}
  </div></div>`;
}
function intelCard(i) {
  if (!i) return '';
  const ul = (a, n, empty) => `<ul>${(a || []).slice(0, n).map(x => `<li>${esc(x)}</li>`).join('') || `<li>${empty}</li>`}</ul>`;
  return `<details class="result"><summary class="rh">🧠 AI PRODUCT INTELLIGENCE <span>${esc(i.shortName || '')}</span></summary><div class="rb"><b>${esc(i.shortName || '')}</b> · ${esc(i.category || '')}<br><b>👥 Sasaran:</b> ${esc(i.audience || '—')}<br><b>🎯 Konteks utama:</b> ${esc(i.primaryContext || '—')}<br><br><b>🔎 Fakta disahkan</b>${ul(i.verifiedFacts, 8, 'Tiada fakta tambahan yang cukup yakin.')}<b>👁️ Rupa produk (kunci video)</b><div class="small">${esc(i.productLock || '')}</div><br><b>💭 Perasaan pembeli</b>${ul(i.humanTensions, 6, '—')}${(i.uncertain || []).length ? `<b>⚠️ Jangan claim tanpa pengesahan</b>${ul(i.uncertain, 8, '')}` : ''}</div></details>`;
}
function stateBlock(tab) {
  if (kit.status[tab] === 'running') return `<div class="result"><div class="rb">⏳ Sedang dijana… biasanya 20–45 saat.</div></div>`;
  if (kit.errors[tab]) return `<div class="result errCard"><div class="rh">⚠️ Tab ini gagal dijana</div><div class="rb">${esc(kit.errors[tab])}<br><br><button class="copy" data-act="regen" data-tab="${tab}">🔄 Cuba lagi</button></div></div>`;
  return '';
}
const regenBar = tab => `<div class="paneBar"><button class="copy" data-act="regen" data-tab="${tab}">🔄 Jana semula tab ini</button></div>`;

function paneStory() {
  let h = `<div class="tabIntro">10 cerita ringkas untuk membina keyakinan, masing-masing dengan waktu posting yang dicadangkan dan mood yang sepadan dengan konteks pembaca. Setiap cerita ada versi penuh (Facebook) dan versi pendek (Threads/X). Waktu ialah hipotesis untuk diuji melalui Insights, bukan jaminan prestasi.</div><div class="actions"><button class="primary" data-act="generate-tab" data-tab="story">📝 Jana Tab 1 — Story Content</button></div>` + regenBar('story') + stateBlock('story');
  if (!kit.story.length) return h + `<div class="empty">Tab 1 belum dijana. Masukkan maklumat produk dan tekan Jana Tab 1.</div>`;
  h += qaCard(kit.qa.story, 'STORY');
  h += `<div class="result"><div class="rh">🗓️ JADUAL POSTING <span>waktu Malaysia</span></div><div class="rb schedule">${kit.story.map(s => `<span><b>${String(s.id).padStart(2, '0')}</b> ${esc(s.time)}</span>`).join('')}</div></div>`;
  h += intelCard(kit.intel);
  kit.story.forEach(s => {
    const slot = STORY_SLOTS[s.id - 1];
    h += `<div class="result storyCard"><div class="rh">${String(s.id).padStart(2, '0')} · 🕒 ${esc(s.time)} <span>${esc(s.mood || slot.mood)} · ${esc(s.angle || '')}</span></div><div class="rb">
      <pre class="postText">${esc(s.story)}</pre>
      <div class="small">💡 Kenapa ${esc(s.time)}: ${esc(slot.why)}</div>
      <div class="badges">${s.context ? `<span class="badge soft">📍 ${esc(s.context)}</span>` : ''}${s.ctaType ? `<span class="badge soft">👉 CTA: ${esc(s.ctaType)}</span>` : ''}${s.visualDetail ? `<span class="badge soft">🔍 ${esc(s.visualDetail)}</span>` : ''}</div>
      <div class="btnRow"><button class="copy" data-act="copy" data-kind="story" data-id="${s.id}">📋 Copy cerita penuh</button><button class="copy" data-act="copy" data-kind="short" data-id="${s.id}">📋 Copy versi pendek (Threads/X)</button></div>
      <details class="shortBox"><summary class="small">Lihat versi pendek (${s.short.length} aksara)</summary><pre class="postText">${esc(s.short)}</pre></details></div></div>`;
  });
  return h;
}
function panePro() {
  let h = `<div class="tabIntro">Enam post lengkap dengan fokus funnel berbeza (TOFU, MOFU dan BOFU). Setiap post mempunyai Hook → Problem → Agitation → Solution → Benefit → Proof → CTA, disasarkan sekitar 200–300 perkataan dan disesuaikan dengan konteks waktu penerbitan.</div><div class="actions"><button class="primary" data-act="generate-tab" data-tab="problem">🧩 Jana Tab 2 — 6 Post</button></div>` + regenBar('problem') + stateBlock('problem');
  if (!kit.problem.length) return h + `<div class="empty">Tab 2 belum dijana. Tekan Jana apabila anda memerlukan enam post strategik.</div>`;
  h += qaCard(kit.qa.problem, 'PROBLEM → CTA');
  const url = normalizeUrl($('affiliateUrl').value);
  kit.problem.forEach(p => {
    const text = assembleProblem(p), tags = AffiliQA.formatTags(p.hashtags, 'problem');
    const ready = !!(url && text);
    h += `<div class="result problemCard"><div class="rh">CONTENT ${String(p.id).padStart(2, '0')} · 🕒 ${esc(p.time)} <span>${esc(p.funnel || '')} · ❤️ ${esc(p.emotion || '')}</span></div><div class="rb">
      <div class="postBox"><pre class="postText">${esc(text)}</pre><div class="postLink">${esc(url)}</div><div class="postTags">${esc(tags)}</div></div>
      <div class="badges">${p.focus ? `<span class="badge soft">🎯 ${esc(p.focus)}</span>` : ''}${p.emotionTechnique ? `<span class="badge soft">✨ ${esc(p.emotionTechnique)}</span>` : ''}${p.context ? `<span class="badge soft">📍 ${esc(p.context)}</span>` : ''}</div>
      <div class="btnRow"><button class="copy" ${ready ? '' : 'disabled'} data-act="copy" data-kind="problem" data-id="${p.id}">📋 Copy Content</button></div>
      <details class="shortBox"><summary class="small">Lihat 7 struktur</summary><ol class="parts">${PROBLEM_PARTS.map(([k, label]) => `<li><b>${esc(label)}</b> <span class="wc">${wordsIn(p[k])} patah</span><br>${esc(p[k])}</li>`).join('')}</ol></details></div></div>`;
  });
  return h;
}
function paneVideo() {
  const rec = kit.recommendations;
  let h = `<div class="tabIntro">Satu produk menghasilkan <b>enam idea video</b>, setiap satu dengan dua prompt berasingan: Clip A (8 saat: Hook dan pembinaan minat) + Clip B (8 saat: penyelesaian hingga CTA) — 12 prompt klip keseluruhan. Gambar produk dimuat naik sekali di borang maklumat produk. Sistem mencadangkan konsep kreatif dan slash commands dahulu; pengguna boleh menerima cadangan atau memilih slash lain pada ruangan Slash Prompt Shortcuts dalam borang.</div>
    <div class="actions"><button class="ghost" data-act="recommend-video">✨ Cadangkan semula konsep &amp; /</button><button class="primary" data-act="generate-tab" data-tab="video">🎬 Jana Tab 3 — 6 Video (12 Klip)</button></div>` + stateBlock('video');
  if (rec) {
    h += `<div class="result"><div class="rh">✨ Cadangan AI <span>Semak sebelum Jana</span></div><div class="rb"><b>${esc(rec.title || 'Konsep video')}</b><p>${esc(rec.concept || '')}</p><p>${esc(rec.rationale || '')}</p><div class="badges"><span class="badge soft">Clip A: ${esc((rec.clipASlash || []).join(' '))}</span><span class="badge soft">Clip B: ${esc((rec.clipBSlash || []).join(' '))}</span></div><p class="small">Jika setuju, tekan Jana Tab 3. Jika mahu ubah, pilih/tambah arahan / pada bahagian Slash Prompt Shortcuts di borang produk, kemudian tekan Jana Tab 3.</p></div></div>`;
  } else h += `<div class="empty">Cadangan konsep akan disediakan apabila Tab 3 dibuka. Penjanaan video hanya bermula apabila anda menekan Jana.</div>`;
  if (!kit.video.length) return h;
  h += qaCard(kit.qa.video, 'VIDEO', 'Setiap klip berdurasi sasaran 8 saat dan mengandungi arahan rujukan produk, hook/aksi, kamera, pencahayaan, audio, kesinambungan serta negative constraints.');
  kit.video.forEach(v => {
    const pane = (k, L, c) => `<section class="videoClipPane ${k === 'a' ? 'active' : ''}" data-clip-pane="${k}" style="display:${k === 'a' ? 'block' : 'none'}"><pre class="postText mono">${esc(c.final)}</pre><div class="small ${c.final.length > 2500 ? 'warnText' : ''}">${c.final.length}/2500 aksara</div><button class="copy" data-act="copy" data-kind="clip${k.toUpperCase()}" data-id="${v.id}">📋 Copy Clip ${L}</button></section>`;
    h += `<div class="result videoCard" data-vid="${v.id}"><div class="rh">${esc(v.title)} <span>Clip A · 8s + Clip B · 8s</span></div><div class="rb"><div class="small">${esc(v.concept)}</div>${v.endFrameA ? `<div class="small endFrame">🎞️ Frame akhir Clip A: ${esc(v.endFrameA)}</div>` : ''}<div class="storyPlatformTabs videoClipTabs" role="tablist"><button type="button" class="storyPlatformTab active" data-act="clip" data-clip-tab="a">🎞️ Clip A · 8s</button><button type="button" class="storyPlatformTab" data-act="clip" data-clip-tab="b">🎞️ Clip B · 8s</button></div>${pane('a', 'A', v.clipA)}${pane('b', 'B', v.clipB)}</div></div>`;
  });
  return h;
}

function render() {
  const slash = kit.video.flatMap(v => [...v.clipA.stack, ...v.clipB.stack]);
  const tabs = TABS.map(([k, label]) => `<button type="button" class="outputTab ${activeTab === k ? 'active' : ''}" data-act="tab" data-tab="${k}">${label}${kit.errors[k] ? ' ⚠️' : kit.status[k] === 'running' ? ' ⏳' : kit.status[k] === 'done' ? ' ✓' : ''}</button>`).join('');
  $('results').innerHTML = `<div class="result"><div class="rh">⚡ AI WORKSPACE <span>${esc(slash.slice(0, 6).join(' ') || 'Menunggu pilihan tab')}</span></div><div class="rb">Setiap tab dijana secara berasingan. Berpindah tab tidak akan memanggil AI. Hasil tab lain dikekalkan.</div></div><div class="outputTabs" role="tablist">${tabs}</div><div class="outputPane ${activeTab === 'story' ? 'active' : ''}" data-pane="story">${paneStory()}</div><div class="outputPane ${activeTab === 'problem' ? 'active' : ''}" data-pane="problem">${panePro()}</div><div class="outputPane ${activeTab === 'video' ? 'active' : ''}" data-pane="video">${paneVideo()}</div>`;
  setBusy(isGenerating);
}

render();

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'tab') { const nextTab = el.dataset.tab; activeTab = nextTab; render(); if (nextTab === 'video' && !kit.recommendations && !isGenerating && productRefs.length) requestVideoRecommendation(); }
  else if (act === 'generate-tab') generateTab(el.dataset.tab);
  else if (act === 'recommend-video') requestVideoRecommendation();
  else if (act === 'regen') regenTab(el.dataset.tab);
  else if (act === 'clip') { const card = el.closest('.videoCard'), c = el.dataset.clipTab; card.querySelectorAll('[data-clip-tab]').forEach(b => b.classList.toggle('active', b.dataset.clipTab === c)); card.querySelectorAll('[data-clip-pane]').forEach(p => { const on = p.dataset.clipPane === c; p.classList.toggle('active', on); p.style.display = on ? 'block' : 'none'; }); }
  else if (act === 'copy') {
    const id = +el.dataset.id, kind = el.dataset.kind;
    if (kind === 'story') { const s = kit.story.find(x => x.id === id); copyText(bundle(s.story, tagString(s))); }
    else if (kind === 'short') { const s = kit.story.find(x => x.id === id); copyText(bundle(s.short, tagString(s))); }
    else if (kind === 'problem') { const p = kit.problem.find(x => x.id === id); copyText(bundle(assembleProblem(p), AffiliQA.formatTags(p.hashtags, 'problem'))); }
    else if (kind === 'clipA' || kind === 'clipB') { const v = kit.video.find(x => x.id === id); copyText(v[kind].final); }
  }
});

/* ------------------------------------------------------------------ export */
function copyAllPrompts() {
  if (!kit.video.length) { alert('Jana Tab 3 dahulu.'); return; }
  copyText(kit.video.map(v => `VIDEO IDEA ${v.id} — ${v.title}\n\nCLIP A\n${v.clipA.final}\n\nCLIP B\n${v.clipB.final}`).join('\n\n====================\n\n'));
}
function downloadKit() {
  if (!hasKit()) { alert('Jana kit dahulu.'); return; }
  const url = normalizeUrl($('affiliateUrl').value);
  const payload = { generatedAt: kit.generatedAt, affiliateUrl: url, productIntelligence: kit.intel, story: kit.story.map(s => ({ ...s, ready: bundle(s.story, tagString(s)) })), problemToCta: kit.problem.map(p => ({ ...p, ready: bundle(assembleProblem(p), AffiliQA.formatTags(p.hashtags, 'problem')) })), videos: kit.video };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); a.download = 'AffiliFlow_AI_V11_Kit.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------------ persistence (IndexedDB) */
const DB_NAME = 'AffiliFlowAI_V9', STORE = 'session';
const openDB = () => new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function dbSet(k, v) { try { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) { console.warn(e); } }
async function dbGet(k) { try { const db = await openDB(); return new Promise((res, rej) => { const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return null; } }
async function dbClear() { try { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (e) {} }

const FIELD_IDS = ['name', 'creatorName', 'productDescription', 'price', 'target', 'points', 'style', 'videoStyle', 'sceneType', 'duration', 'affiliateUrl', 'accuracy', 'newBackground', 'customBackground', 'slashCommands'];
const CHECK_IDS = ['removeBgText', 'removeBgGraphics', 'protectProductText'];
async function persistSession() {
  try {
    const fields = {}; FIELD_IDS.forEach(id => { if ($(id)) fields[id] = $(id).value; }); CHECK_IDS.forEach(id => { if ($(id)) fields[id] = $(id).checked; });
    const saved = { ...kit, status: Object.fromEntries(Object.entries(kit.status).filter(([, v]) => v === 'done' || v === 'error')) };
    await dbSet('latest', { fields, productRefs, characterImageData, kit: saved });
  } catch (e) { console.warn('persist', e); }
}
let persistTimer; function schedulePersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persistSession, 500); }
async function restoreSession() {
  const x = await dbGet('latest'); if (!x) return;
  try {
    const f = x.fields || {};
    FIELD_IDS.forEach(id => { if (f[id] !== undefined && $(id)) $(id).value = f[id]; }); CHECK_IDS.forEach(id => { if (f[id] !== undefined && $(id)) $(id).checked = f[id]; });
    productRefs = x.productRefs || []; characterImageData = x.characterImageData || ''; renderProductGallery();
    if (characterImageData) { $('characterPreview').innerHTML = `<img src="${characterImageData}" alt="Character reference">`; $('characterPreview').style.display = 'block'; }
    if (x.kit?.version === 10) { kit = { ...emptyKit(), ...x.kit }; kit.status = kit.status || {}; if (Array.isArray(kit.video) && kit.video.length > 1) { kit.video = []; kit.qa.video = null; delete kit.status.video; kit.recommendations = null; } render(); }
    setStatus(productRefs.length ? 'Session terakhir dipulihkan ✓' : '');
  } catch (e) { console.warn('restore', e); }
}
async function clearForm() {
  if (!confirm('Reset semua maklumat, gambar dan hasil AI?')) return;
  ['name', 'price', 'target', 'points', 'affiliateUrl', 'customBackground', 'slashCommands'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('productImages').value = ''; $('characterImage').value = ''; productRefs = []; characterImageData = ''; kit = emptyKit();
  $('productGallery').innerHTML = ''; $('productCount').textContent = ''; $('characterPreview').innerHTML = ''; $('characterPreview').style.display = 'none';
  activeTab = 'story'; render();
  await dbClear(); setStatus('Borang dikosongkan.');
}

window.addEventListener('load', restoreSession);
window.addEventListener('pageshow', e => { if (e.persisted) restoreSession(); });
document.addEventListener('input', schedulePersist); document.addEventListener('change', schedulePersist);
function openSupport() { $('supportModal').classList.add('show'); }
function closeSupport(e) { if (e && e.target !== $('supportModal')) return; $('supportModal').classList.remove('show'); }
