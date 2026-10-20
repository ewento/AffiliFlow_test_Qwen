// End-to-end test with a fake Gemini. Run:  NODE_PATH=<playwright node_modules> node dev-tests/e2e.js
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const APP = 3100, MOCK = 4010;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

async function waitHttp(url) { for (let i = 0; i < 50; i++) { try { await fetch(url); return; } catch (e) { await sleep(100); } } throw new Error('server not up ' + url); }

(async () => {
  const mode = process.env.MOCK_MODE || 'ok';
  const mock = spawn('node', [path.join(__dirname, 'mock-gemini.js')], { env: { ...process.env, MOCK_PORT: MOCK, MOCK_MODE: mode }, stdio: 'inherit' });
  const app = spawn('node', [path.join(ROOT, 'server.js')], { cwd: ROOT, env: { ...process.env, PORT: APP, GEMINI_API_KEY: 'test', GEMINI_API_BASE: `http://localhost:${MOCK}/v1beta/models` }, stdio: 'inherit' });
  try {
    await waitHttp(`http://localhost:${MOCK}/__log`); await waitHttp(`http://localhost:${APP}/`);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${APP}/`);
    await page.fill('#name', 'Lampu Meja LED Lipat Portable USB Rechargeable');
    await page.fill('#target', 'Pelajar dan pekerja WFH');
    await page.fill('#affiliateUrl', 'https://s.shopee.com.my/abc123');
    await page.setInputFiles('#productImages', path.join(ROOT, 'support-qr.png'));
    await page.waitForFunction(() => document.querySelectorAll('#productGallery img').length === 1);

    // simulate Netlify HTML 504 on the first problem call to prove the client retries
    let blocked = 0;
    await page.route('**/.netlify/functions/ai', async route => {
      const body = route.request().postDataJSON();
      if (body.task === 'problem' && blocked < 1) { blocked++; return route.fulfill({ status: 504, contentType: 'text/html', body: '<html>Gateway Timeout</html>' }); }
      route.continue();
    });
    await page.click('.primary');
    await page.waitForFunction(() => /^Siap/.test(document.querySelector('#intelStatus')?.innerText || ''), null, { timeout: 60000 });
    const status = await page.innerText('#intelStatus');
    console.log('STATUS:', status);
    ok(blocked === 1, 'client survived an HTML 504 (retry) on Problem-to-CTA');
    ok(await page.locator('.storyCard').count() === 10, '10 Story cards');
    ok(await page.locator('.problemCard').count() === 6, '6 Problem-to-CTA cards');
    ok(await page.locator('.videoCard').count() === 6, '6 video cards');
    const times = await page.$$eval('.storyCard .rh', els => els.map(e => e.innerText.match(/\d+:\d+ [AP]M/)[0]));
    ok(new Set(times).size === 10, 'ten different posting times: ' + times.join(', '));
    ok(await page.locator('.problemCard details li').count() === 42, 'every problem post exposes 7 parts (42 parts)');
    const prob = await page.innerText('.problemCard >> nth=0');
    ok(prob.includes('https://s.shopee.com.my/abc123') && /#\w+/.test(prob), 'problem post shows link + hashtags once');
    ok((prob.match(/https:\/\/s\.shopee/g) || []).length === 1, 'affiliate link appears once in problem post');

    await page.click('[data-act="tab"][data-tab="problem"]');
    await page.click('.problemCard >> nth=0 >> [data-act="copy"]');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok(clip.includes('https://s.shopee.com.my/abc123') && clip.trim().split('\n').pop().startsWith('#'), 'Problem copy = story + link + hashtags');
    await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'e2e-problem.png'), fullPage: false });

    await page.click('[data-act="tab"][data-tab="video"]');
    const stacks = await page.$$eval('.videoCard', cs => cs.map(c => c.querySelector('[data-clip-pane="a"] pre').innerText.split('\n')[0]));
    ok(stacks.every(s => s.startsWith('/')), 'every Clip A prompt starts with the slash stack');
    const lens = await page.$$eval('.videoCard pre', ps => ps.map(p => p.innerText.length));
    ok(lens.length === 12 && lens.every(n => n < 2500 && n > 700), '12 clip prompts, 700-2500 chars (max ' + Math.max(...lens) + ')');
    await page.click('.videoCard >> nth=0 >> [data-clip-tab="b"]');
    const bText = await page.innerText('.videoCard >> nth=0 >> [data-clip-pane="b"] pre');
    ok(/Continue directly from Clip A/.test(bText), 'Clip B continues from Clip A');
    await page.click('.videoCard >> nth=0 >> [data-clip-pane="b"] >> [data-act="copy"]');
    ok((await page.evaluate(() => navigator.clipboard.readText())) === bText.trim() || (await page.evaluate(() => navigator.clipboard.readText())).startsWith('/'), 'Clip B copy works');
    await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'e2e-video.png') });

    await page.click('[data-act="tab"][data-tab="story"]');
    await page.click('.storyCard >> nth=1 >> [data-kind="short"]');
    const sc = await page.evaluate(() => navigator.clipboard.readText());
    ok(sc.includes('https://s.shopee.com.my/abc123'), 'Story short copy includes link');
    await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'e2e-story.png') });

    const qa = await page.$$eval('.outputPane.active .result .rh', els => els.map(e => e.innerText).filter(t => /SEMAKAN/.test(t)));
    console.log('QA cards:', qa.join(' | '));
    if (mode === 'badstory') ok(qa.some(t => /STORY[\s\S]*lulus/.test(t)), 'bad first story batch was auto-rewritten and passes QA');

    if (mode === 'badstory') { const lg = await (await fetch(`http://localhost:${MOCK}/__log`)).json(); ok(lg.filter(l => /Story Content/.test(l.task)).length === 3, 'only the offending Story half was rewritten (3 story calls)'); }
    // regenerate one tab only
    const before = (await (await fetch(`http://localhost:${MOCK}/__log`)).json()).length;
    await page.click('[data-act="tab"][data-tab="video"]');
    await page.click('.outputPane.active [data-act="regen"]');
    await page.waitForFunction(() => !document.querySelector('.primary').disabled, null, { timeout: 30000 });
    const after = (await (await fetch(`http://localhost:${MOCK}/__log`)).json()).length;
    ok(after - before === 2, 'regenerating Video tab made exactly 2 AI calls (' + (after - before) + ')');

    // reload restores the session
    await page.reload(); await page.waitForSelector('.videoCard', { state: 'attached', timeout: 10000 });
    ok(await page.locator('.storyCard').count() === 10, 'session restored after reload');
    ok(errors.length === 0, 'no page errors ' + errors.join(';'));
    await browser.close();
  } catch (e) { console.error(e); failed++; }
  mock.kill(); app.kill();
  console.log(failed ? `\n${failed} FAILED` : '\nE2E PASSED');
  process.exit(failed ? 1 : 0);
})();
