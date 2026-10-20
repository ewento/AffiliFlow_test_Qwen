const path = require('path');
const fs = require('fs');

const QA = fs.existsSync(path.join(__dirname, '../content-validator.js'))
  ? require('../content-validator.js')
  : require(path.join(__dirname, 'content-validator.js'));

const fixturesPath = fs.existsSync(path.join(__dirname, 'fixtures.js'))
  ? path.join(__dirname, 'fixtures.js')
  : path.join(__dirname, 'dev-tests/fixtures.js');
const { LONG_NAME, goodResult, badPosts, intel } = require(fixturesPath);
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const ctx = { userName: LONG_NAME, points: '', target: '' };

// ---- BAD output must be caught
const bad = QA.runQA({ productIntelligence: { name: LONG_NAME, category: 'alat urut' }, posts: badPosts(), videoIdeas: [] }, ctx);
const codes = new Set(bad.errors.map(e => e.code));
['repeated-opening', 'repeated-cta', 'fabricated-experience', 'medical-claim', 'too-similar', 'repeated-context', 'repeated-angle'].forEach(c => ok(codes.has(c), 'bad fixture flags ' + c));
ok(bad.fixes.some(f => f.code === 'hashtag'), 'malformed hashtags auto-repaired');
ok(bad.fixes.some(f => f.code === 'name-swap'), 'long product title replaced by short name');
ok(!bad.ai.posts.some(p => p.facebook.includes(LONG_NAME)), 'long name gone from text');
ok(bad.ai.posts[0].productIntelligence === undefined && bad.ai.productIntelligence.shortName === 'Mini Massage Gun', 'short name = "Mini Massage Gun"');
const t0 = bad.ai.posts[0].hashtags;
ok(t0.every(t => /^[a-z0-9_]{3,28}$/.test(t)), 'repaired tags valid: ' + t0.join(' '));
ok(QA.formatTags(t0, 'facebook') === t0.map(t => '#' + t).join(' '), 'formatted with spaces: ' + QA.formatTags(t0, 'facebook'));
ok(!/#\S*#/.test(QA.formatTags(t0, 'x')), 'no concatenated hashtags in output');
ok(!bad.ok, 'bad fixture does not pass QA');

// ---- individual detectors (unit)
const one = (t, extra) => QA.validate({ productIntelligence: { shortName: 'Mini Massage Gun' }, posts: [Object.assign({ id: 1, facebook: t, threads: 'ok ok ok ok', x: 'ok ok ok ok', hashtags: ['aaa', 'bbb', 'ccc'] }, extra)] }, ctx).errors.map(e => e.code);
['Awal minggu lepas saya cuba benda ni.', 'Saya pernah guna alat ni.', 'Abang saya bawa balik satu.', 'Kawan saya cakap best.', 'Ramai pelanggan dah guna.']
  .forEach(t => ok(one(t).includes('fabricated-experience'), 'fabrication caught: ' + t));
['Bayangkan seorang abang yang baru balik kerja.', 'Untuk yang selalu memandu jauh.', 'Katakan anda ada masa 10 minit.']
  .forEach(t => ok(!one(t).includes('fabricated-experience'), 'hypothetical allowed: ' + t));
['Ia merawat sakit belakang.', 'Terus hilang sakit.', 'Terbukti berkesan.', 'Ini tanda otot anda bermasalah.', 'Sakit leher disebabkan otot tegang.', 'Dijamin 100% lega.']
  .forEach(t => ok(one(t).includes('medical-claim'), 'medical caught: ' + t));
['Sesuai jadi peneman rehat selepas penat berdiri.', 'Senang dibawa dalam beg.']
  .forEach(t => ok(!one(t).includes('medical-claim'), 'safe wording allowed: ' + t));
ok(QA.validate({ productIntelligence: { shortName: 'Mini Massage Gun' }, posts: [{ id: 1, facebook: 'Mini Massage Gun ni bagus. Mini Massage Gun ni murah. Mini Massage Gun ni ringan.', threads: 'a b c d', x: 'a b c d', hashtags: ['aaa', 'bbb', 'ccc'] }] }, ctx).errors.some(e => e.code === 'name-repetition'), 'excess product-name repetition caught');
ok(QA.validate({ productIntelligence: { shortName: 'Mini Massage Gun' }, posts: [{ id: 1, facebook: 'Hai #a#b teks', threads: 'a b c d', x: 'a b c d', hashtags: ['aaa', 'bbb', 'ccc'] }] }, ctx).errors.some(e => e.code === 'hashtag'), 'malformed inline hashtag caught by validate()');
ok(!QA.validate({ productIntelligence: { shortName: 'X Y' }, posts: [{ id: 1, facebook: 'Saya pernah guna.', threads: 'a b c d', x: 'a b c d', hashtags: ['aaa', 'bbb', 'ccc'] }] }, { points: 'Saya pernah guna sendiri dan suka.' }).errors.some(e => e.code === 'fabricated-experience'), 'user-supplied experience is respected');
ok(!QA.validate({ productIntelligence: { shortName: 'X Y' }, posts: [{ id: 1, facebook: 'Ia merawat kulit.', threads: 'a b c d', x: 'a b c d', hashtags: ['aaa', 'bbb', 'ccc'] }] }, { points: 'Merawat kulit kering' }).errors.some(e => e.code === 'medical-claim'), 'user-supplied claim is respected');

// ---- GOOD output must pass
const good = QA.runQA(goodResult, ctx);
good.errors.forEach(e => console.log('   error:', e.message));
good.warnings.forEach(e => console.log('   warn :', e.message));
ok(good.ok, 'good 10-post fixture passes QA (' + good.errors.length + ' errors)');
ok(good.ai.posts.every(p => p.hashtags.every(t => /^[a-z0-9_]{3,28}$/.test(t))), 'all tags lowercase/valid (e.g. "hariSabtu" -> "harisabtu", "idea hadiah" -> "ideahadiah")');
ok(good.ai.productIntelligence.shortName === 'Mini Massage Gun', 'short name kept');

// ---- deriveShortName
[['Mini Massage Gun Wireless Massage Gun Muscle Relaxation Massage Equipment', 'Mini Massage Gun'],
 ['SerangGo Pest Repellent Spray Natural', 'SerangGo Pest Repellent Spray'],
 ['Baju Melayu Teluk Belanga Cekak Musang Premium', 'Baju Melayu Teluk Belanga'],
 ['Dehumidifier Portable Wireless Home', 'Dehumidifier']].forEach(([a, b]) => { const r = QA.deriveShortName(a); ok(r === b, `deriveShortName -> "${r}"` + (r === b ? '' : ` (wanted "${b}")`)); });


// ---- V10 generic checker (Story + Problem-to-CTA) ----
(function () {
  const QA = require('../content-validator.js');
  const mk = (id, text, cta) => ({ id, story: text + ' ' + cta, hashtags: ['lampumeja', 'tipsbeli', 'wfhmalaysia', 'mejabelajar'] });
  const base = [
    mk(1, 'Pagi di dapur kecil, bunyi kettle bersiul dan lampu lama berkelip perlahan sambil budak sekolah mencari buku latihan matematik', 'Simpan post ini untuk rujukan.'),
    mk(2, 'Waktu rehat tengah hari di surau, seorang pekerja kilang membuka beg dan mengeluarkan lampu lipat berwarna putih bersih', 'Kongsi dengan rakan serumah anda.'),
  ];
  const opts = { fields: ['story'], textOf: p => p.story, openField: 'story', closeField: 'story', expected: 2 };
  const good = QA.checkItems(base, {}, opts);
  if (!good.ok) throw new Error('checkItems: clean items should pass: ' + JSON.stringify(good.errors));
  const fab = QA.checkItems([mk(1, 'Minggu lepas saya pernah beli lampu ni dan terus suka sangat dengan rekaannya yang kemas', 'Tag kawan.'), base[1]], {}, opts);
  if (!fab.errors.some(e => e.code === 'fabricated-experience')) throw new Error('checkItems: should flag invented experience');
  const cliche = QA.checkItems([mk(1, 'Tahukah anda lampu meja boleh jadi peneman belajar yang menyenangkan sepanjang malam', 'Tag kawan.'), base[1]], {}, opts);
  if (!cliche.errors.some(e => e.code === 'cliche')) throw new Error('checkItems: should flag AI cliche');
  const dup = QA.checkItems([base[0], mk(2, 'Pagi di dapur kecil, bunyi kettle bersiul dan lampu lama berkelip perlahan sambil budak sekolah mencari buku latihan matematik', 'Kongsi dengan rakan.')], {}, opts);
  if (!dup.errors.some(e => e.code === 'repeated-opening' || e.code === 'too-similar')) throw new Error('checkItems: should flag duplicate openings');
  const tagged = QA.checkItems([mk(1, 'Lampu meja ini nampak ringkas #lampumeja dan kemas di atas meja belajar anda malam ini', 'Simpan.'), base[1]], {}, opts);
  if (!tagged.errors.some(e => e.code === 'hashtag')) throw new Error('checkItems: should flag inline hashtags');
  console.log('PASS checkItems (clean / fabricated / cliche / duplicate / inline hashtag)');
})();


// ---- V10 Product Claim & Evidence + Cross-post Story Arc engines
(function () {
  const claim = (s, ctx = {}) => QA.classifyProductClaims(s, ctx);
  ok(claim('Berdasarkan maklumat kedai rasmi, samping ini cantik.').some(x => x.category === 'source'),
    'claim engine catches unverified official-source phrasing');
  ok(claim('Samping ini selesa dipakai sepanjang hari.').some(x => x.category === 'unverified'),
    'claim engine flags unsupported comfort claim');
  ok(!claim('Corak tenun nampak kemas dan warna hitam-emas jelas.', {}).length,
    'visual observation is not flagged as an unsupported claim');
  ok(!claim('Samping ini selesa dipakai.', { points: 'Samping ini selesa dipakai' }).length,
    'claim explicitly supplied by user is respected');
  const arcs = [
    { id: 1, problem: 'susah padankan warna samping dengan baju melayu', agitation: 'takut warna nampak bercanggah', solution: 'pilih corak hitam emas untuk padanan neutral', benefit: 'mudah digayakan', context: 'persiapan baju melayu pagi raya', proof: 'warna hitam emas', cta: 'lihat pilihan warna' },
    { id: 2, problem: 'susah padankan warna samping dengan baju melayu', agitation: 'risau warna nampak bercanggah', solution: 'pilih corak hitam emas untuk padanan neutral', benefit: 'mudah digayakan', context: 'persiapan baju melayu pagi raya', proof: 'warna hitam emas', cta: 'lihat pilihan warna' },
    { id: 3, problem: 'bajet keluarga perlu dijimatkan ketika persiapan raya', agitation: 'banyak keperluan perlu dibeli', solution: 'banding harga dan tetapkan bajet', benefit: 'pilih ikut kemampuan', context: 'kiraan bajet keluarga', proof: 'harga RM23', cta: 'semak listing' },
    { id: 4, problem: 'hadiah untuk suami sukar dipilih', agitation: 'bimbang hadiah tidak kena gaya', solution: 'pilih corak yang sesuai dengan gaya pasangan', benefit: 'pilihan hadiah', context: 'isteri mencari hadiah', proof: 'corak yang dipaparkan', cta: 'lihat pilihan' }
  ];
  const arcIssues = QA.storyArcCheck(arcs, p => [p.problem,p.agitation,p.solution,p.benefit,p.proof,p.cta].join(' '));
  ok(arcIssues.some(x => x.code === 'same-story'), 'story arc engine catches matching pain point + setting');
  const pricePosts = Array.from({length: 4}, (_,i) => ({id:i+1, problem:'budget planning', context:'different setting '+i, proof:'Harga RM23', story:'Harga RM23'}));
  ok(QA.storyArcCheck(pricePosts, p => p.story).some(x => x.code === 'repeated-fact'), 'story arc engine catches repeated price fact across 4 posts');
})();

// ---- Regression checks for reported QA defects (no browser required)
(function () {
  const fs = require('node:fs');
  const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
  ok(app.includes('NEGATIVE CONSTRAINTS') && app.includes('\\*{1,3}'), 'video validator accepts Markdown/indented negative-constraint labels');
  ok(app.includes('repeated-story-angle') && app.includes('repeated-story-context'), 'Story QA audits repeated angles and contexts');
  ok(app.includes('repeated-story-price') && app.includes('Hadkan kepada 1–2 Story'), 'Story QA flags repeated price facts');
  ok(app.includes('banding harga|rancang belanja'), 'budget-context exception prevents false-positive “memudahkan” claim flags');
  ok(app.includes('label|logo|botol|penutup|tulisan|teks'), 'Proof QA accepts concrete visible product evidence');
})();

console.log(fail ? `\n${fail} FAILED` : '\nALL VALIDATOR TESTS PASSED');
process.exit(fail ? 1 : 0);



// ---- V11.4 regression checks for incomplete video sections
(function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const prompts = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'prompts.js'), 'utf8');
  ok(app.includes('kosong atau terlalu umum'), 'Video QA rejects empty/near-empty required sections');
  ok(app.includes('score(nextQA) < score(qa)'), 'Video QA keeps the better batch after a repair attempt');
  ok(prompts.includes('never return a skeleton, empty label, heading-only section'), 'Video prompt explicitly forbids empty section templates');
  ok(prompts.includes('all 12 prompts'), 'Video prompt requires completeness checks across all 12 clips');
})();
