// Minimal fake of the Gemini generateContent endpoint for offline tests (no API key, no network).
// It checks the request shape (systemInstruction, schema types) and returns schema-valid synthetic content.
// MOCK_MODE: "ok" (default) | "badstory" (first story call contains an invented personal experience)
const http = require('node:http');
const PORT = Number(process.env.MOCK_PORT) || 4010;
const MODE = process.env.MOCK_MODE || 'ok';
const TYPES = new Set(['STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'ARRAY', 'OBJECT']);
let storyCalls = 0;
const log = [];

function checkSchema(s, path = 'root') {
  if (!TYPES.has(s.type)) throw new Error(`Bad schema type at ${path}: ${s.type}`);
  if (s.type === 'OBJECT') {
    const keys = Object.keys(s.properties || {});
    (s.required || []).forEach(k => { if (!keys.includes(k)) throw new Error(`required ${k} not in properties at ${path}`); });
    keys.forEach(k => checkSchema(s.properties[k], `${path}.${k}`));
  }
  if (s.type === 'ARRAY') checkSchema(s.items, path + '[]');
}

const W = (i, n) => Array.from({ length: n }, (_, j) => `kata${i}x${j}${String.fromCharCode(97 + ((i * 7 + j) % 26))}`).join(' ');
const OPEN = ['Lampu malap', 'Meja belajar', 'Selepas Subuh', 'Waktu rehat', 'Petang Jumaat', 'Malam sunyi', 'Dapur kecil', 'Beg galas', 'Bunyi suis', 'Kabel panjang'];
const CTA = ['Tinggalkan soalan anda dalam komen.', 'Simpan post ini untuk rujukan.', 'Kongsi dengan rakan serumah.', 'Tag orang yang perlukan ini.', 'Bandingkan dengan pilihan lain dahulu.', 'Buka pautan dan semak gambar produk.', 'Undi A atau B di bawah.', 'Fikir tenang dahulu sebelum memilih.', 'Semak label pada halaman produk.', 'Terpulang pada anda untuk menilai.'];

function intel() {
  return { shortName: 'Lampu Meja LED', category: 'Lampu meja', audience: 'Pelajar dan pekerja WFH', primaryContext: 'Meja belajar / WFH', secondaryContexts: ['asrama', 'bilik tidur'], verifiedFacts: ['Tertera LED pada pakej'], visualIdentity: ['Badan putih', 'Kepala bulat'], productLock: 'A white foldable LED desk lamp with a round head and slim arm, exactly as in the reference image.', uncertain: ['Kecerahan', 'Bateri'], humanTensions: ['mata penat lewat malam', 'meja sempit', 'bising bila orang tidur'] };
}
function story(id, bad) {
  const i = id;
  let text = `${OPEN[i - 1]} ${W(i, 8)}. ${W(i + 20, 30)}. ${W(i + 40, 30)}. ${W(i + 60, 25)}. ${CTA[i - 1]}`;
  if (bad) text = `${OPEN[i - 1]}, saya pernah beli lampu ni minggu lepas. ` + text;
  return { id, mood: 'tenang', angle: 'angle' + i + 'x', context: 'konteks' + i + 'y', hookType: 'hook' + i, ctaType: 'cta' + i, visualDetail: 'detail' + i, story: text, short: `${OPEN[i - 1]} ${W(i + 80, 12)}.`, hashtags: ['lampumeja', 'tipsbeli', 'mejabelajar', 'wfhmalaysia', 'tag' + i + 'abc'] };
}
function problem(id) {
  const emos = ['penat', 'rindu', 'risau', 'segan', 'geli hati', 'syukur'];
  return { id, emotion: emos[id - 1], emotionTechnique: 'teknik' + id, context: 'konteks' + id, hook: `${OPEN[id + 2]} ${W(id + 100, 10)}?`, problem: W(id + 110, 24) + '.', agitation: W(id + 120, 24) + '.', solution: W(id + 130, 22) + '.', benefit: W(id + 140, 24) + '.', proof: W(id + 150, 16) + '.', cta: `${CTA[id + 3]} ${W(id + 160, 12)}.`, visualDetail: 'visual' + id, hashtags: ['lampumeja', 'wfh', 'asrama', 'tipsbeli', 'tag' + id + 'xyz'] };
}
function clip(id, k) {
  const stack = k === 'A' ? ['/ugcHandheld', '/SoftLightingAd', '/SlowPushIn'] : ['/rackFocus', '/SoftLightingAd', '/productInUse'];
  const L = (n) => W(id * 3 + (k === 'A' ? 0 : 50) + n, 12);
  const cont = k === 'B' ? `CONTINUITY: Continue directly from Clip A's final frame: lamp on desk. ${L(9)}.` : `CONTINUITY: END FRAME: lamp on desk. ${L(9)}.`;
  const body = [`REFERENCE: use the uploaded product reference image(s) as the exact product — A white foldable LED desk lamp. ${L(1)}.`, `SHOT: ${L(2)}, vertical 9:16.`, `ACTION (8s): 0-2s ${L(3)}; 2-5s ${L(4)}; 5-8s ${L(5)}.`, `SETTING: ${L(6)}.`, `LIGHT & LOOK: ${L(7)}. ${L(8)}.`, 'AUDIO: ambient room tone; no music; no speech.', cont, 'AVOID: text overlays, subtitles, watermarks; changes to the product shape, colour or label; warped fingers.'].join('\n');
  return { slashStack: stack.concat(k === 'A' ? ['/problemMoment'] : []), prompt: body + '\n' + W(id * 9 + (k === 'A' ? 1 : 2), 40) };
}
function video(id) { return { id, title: 'Idea ' + id, concept: 'Konsep ' + id + ' ' + W(id, 5), endFrameA: 'Lamp lit on the desk, hand leaving frame.', clipA: clip(id, 'A'), clipB: clip(id, 'B') }; }

function respond(body) {
  const text = body.contents[0].parts[0].text;
  checkSchema(body.generationConfig.responseSchema);
  if (!body.systemInstruction?.parts?.[0]?.text) throw new Error('missing systemInstruction');
  if (/Study the product reference images/.test(text)) return intel();
  let m = text.match(/Story Content posts #(\d+)-#(\d+)/);
  if (m) { const s = +m[1]; storyCalls++; const bad = MODE === 'badstory' && storyCalls === 1 && s === 1 && !/PREVIOUS ATTEMPT FAILED/.test(text); return { stories: [0, 1, 2, 3, 4].map(k => story(s + k, bad && k === 2)) }; }
  if (/SIX Problem-to-CTA/.test(text)) return { problemPosts: [1, 2, 3, 4, 5, 6].map(problem) };
  m = text.match(/video concepts #(\d+)-#(\d+)/);
  if (m) { const s = +m[1]; return { videos: [0, 1, 2].map(k => video(s + k)) }; }
  throw new Error('unknown task');
}

http.createServer((req, res) => {
  let b = '';
  req.on('data', c => (b += c));
  req.on('end', () => {
    try {
      if (req.url === '/__log') { res.end(JSON.stringify(log)); return; }
      if (!/generateContent/.test(req.url)) throw new Error('bad url ' + req.url);
      if (!req.headers['x-goog-api-key']) throw new Error('missing api key header');
      const body = JSON.parse(b);
      const data = respond(body);
      log.push({ url: req.url, task: body.contents[0].parts[0].text.slice(0, 60), images: body.contents[0].parts.length - 1 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] }, finishReason: 'STOP' }], modelVersion: 'mock' }));
    } catch (e) {
      console.error('MOCK ERROR', e.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
  });
}).listen(PORT, () => console.log('mock gemini on', PORT));
