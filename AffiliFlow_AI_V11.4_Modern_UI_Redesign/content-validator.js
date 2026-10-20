/* AffiliFlow AI V9 — Content QA (sanitize + validate)
 * Works in the browser (window.AffiliQA) and in Node (module.exports) so it can be smoke-tested.
 *
 * Pipeline used by index.html:
 *   runQA(rawAI, ctx) -> { ai, fixes, errors, warnings, ok }
 *     1. sanitize: derive short product name, swap long name for short name,
 *        strip/repair hashtags (spaces between tags, no concatenation)
 *     2. validate: repeated openings/CTAs, fabricated first-person experience,
 *        unsupported medical claims, malformed hashtags, product-name repetition, sameness
 *   `errors` should trigger a regeneration; `warnings` are shown but never block.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AffiliQA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Tags we always add on top of the AI's own (empty by default: tags should be product/audience specific).
  var BRAND_TAGS = [];
  var TAG_MIN = 3, TAG_MAX = 28;
  var TAG_LIMITS = { facebook: 6, threads: 4, x: 3 };

  /* ------------------------------------------------------------------ helpers */
  var STOP = new Set(('yang dan atau untuk dengan dalam pada dari ini itu ada tak tidak boleh akan juga lebih sangat nak dah lagi ' +
    'kita korang anda awak kalau bila sebab tapi pun saja lah kan nya the and for that with sama mana mungkin ' +
    'masih sebelum selepas setiap semua satu dua tiga orang ialah adalah jadi buat bagi pula hanya cuma sini situ ' +
    'dekat kat atas bawah pun macam supaya apa siapa bukan').split(' '));

  function words(s) {
    return String(s || '').toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ').replace(/#\S+/g, ' ')
      .replace(/[^a-z0-9À-ɏ\s]/g, ' ').split(/\s+/).filter(Boolean);
  }
  function contentWords(s) {
    var set = new Set();
    words(s).forEach(function (w) { if (w.length > 3 && !STOP.has(w)) set.add(w); });
    return set;
  }
  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    var inter = 0; a.forEach(function (x) { if (b.has(x)) inter++; });
    return inter / (a.size + b.size - inter);
  }
  function stripUrlsAndTags(s) {
    return String(s || '').replace(/https?:\/\/\S+/g, ' ').replace(/#\S+/g, ' ').replace(/[ \t]+/g, ' ').trim();
  }
  function sentences(s) {
    var m = stripUrlsAndTags(s).match(/[^.!?\n…]+[.!?…]*/g) || [];
    return m.map(function (x) { return x.trim(); }).filter(function (x) { return words(x).length > 0; });
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim(); }
  function snippet(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > (n || 70) ? s.slice(0, n || 70) + '…' : s; }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ------------------------------------------------------------ short name */
  var NAME_STOP = new Set(('wireless portable professional newest new hot sale 2023 2024 2025 2026 for with and muscle relaxation ' +
    'equipment premium original high quality multifunctional rechargeable usb cordless ready stock murah viral baru ' +
    'popular best terbaik panas jualan khas free percuma shipping').split(' '));

  // "Mini Massage Gun Wireless Massage Gun Muscle Relaxation Massage Equipment" -> "Mini Massage Gun"
  function deriveShortName(full, max) {
    max = max || 4;
    var toks = String(full || '').replace(/[|,;/()\[\]\-–—_+:]+/g, ' ').split(/\s+/).filter(Boolean);
    var out = [], seen = new Set();
    for (var i = 0; i < toks.length; i++) {
      var k = toks[i].toLowerCase();
      if ((out.length >= 1 && NAME_STOP.has(k)) || (out.length >= 2 && seen.has(k))) break;
      out.push(toks[i]); seen.add(k);
      if (out.length >= max) break;
    }
    return out.join(' ').trim() || String(full || '').trim();
  }
  function shortNameOk(s) {
    s = String(s || '').trim();
    var n = s.split(/\s+/).filter(Boolean).length;
    return n >= 1 && n <= 4 && s.length <= 32;
  }
  function resolveShortName(ai, ctx) {
    var intel = (ai && ai.productIntelligence) || {};
    var fromAI = String(intel.shortName || '').trim();
    if (shortNameOk(fromAI)) return fromAI;
    return deriveShortName((ctx && ctx.userName) || intel.name || '');
  }

  /* --------------------------------------------------------------- hashtags */
  function cleanTag(t) {
    return String(t || '').replace(/^#+/, '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '');
  }
  function tagValid(t) { return t.length >= TAG_MIN && t.length <= TAG_MAX && !/^\d+$/.test(t); }
  // One array item may be "#a", "a b" (-> "ab") or a concatenated "#a#b" (-> a, b)
  function tagsFromItem(item) {
    return String(item || '').split('#').map(cleanTag).filter(Boolean);
  }
  // Pull hashtags out of free text. Returns {tags:[clean], bad:[raw tokens], text:stripped}
  function extractInlineHashtags(text) {
    var bad = [], tags = [];
    var tokens = String(text || '').match(/\S*#\S*/g) || [];
    tokens.forEach(function (tok) {
      var ok = /^#[A-Za-z0-9_]{2,28}$/.test(tok);
      if (!ok) bad.push(tok);
      String(tok).split('#').map(cleanTag).filter(Boolean).forEach(function (t) { tags.push(t); });
    });
    var stripped = String(text || '').replace(/\S*#\S*/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return { tags: tags, bad: bad, text: stripped };
  }
  function compact(s) { return cleanTag(String(s || '').replace(/\s+/g, '')); }
  function uniq(arr) { var s = new Set(), o = []; arr.forEach(function (x) { if (!s.has(x)) { s.add(x); o.push(x); } }); return o; }

  function formatTags(tags, platform) {
    var lim = TAG_LIMITS[platform] || 5;
    return (tags || []).filter(tagValid).slice(0, lim).map(function (t) { return '#' + t; }).join(' ');
  }

  /* -------------------------------------------------------------- sanitize */
  function sanitize(rawAI, ctx) {
    ctx = ctx || {};
    var ai = JSON.parse(JSON.stringify(rawAI || {}));
    var fixes = [];
    ai.productIntelligence = ai.productIntelligence || {};
    var intel = ai.productIntelligence;
    var shortName = resolveShortName(ai, ctx);
    if (intel.shortName !== shortName) fixes.push({ code: 'short-name', message: 'Short product name set to "' + shortName + '".' });
    intel.shortName = shortName;

    var longNames = uniq([ctx.userName, intel.name].filter(Boolean).map(function (x) { return String(x).trim(); }))
      .filter(function (n) { return n.toLowerCase() !== shortName.toLowerCase() && n.split(/\s+/).length > shortName.split(/\s+/).length; });

    var posts = Array.isArray(ai.posts) ? ai.posts : [];
    posts.forEach(function (p, idx) {
      var label = 'Post ' + (p.id || idx + 1);
      var collected = [];
      var hadBad = false, swapped = false;
      ['facebook', 'threads', 'x'].forEach(function (f) {
        var t = String(p[f] || '');
        longNames.forEach(function (n) {
          var re = new RegExp(esc(n).replace(/\s+/g, '\\s+'), 'ig');
          if (re.test(t)) { t = t.replace(re, shortName); swapped = true; }
        });
        var ex = extractInlineHashtags(t);
        if (ex.bad.length) hadBad = true;
        collected = collected.concat(ex.tags);
        p[f] = ex.text;
      });
      if (swapped) fixes.push({ code: 'name-swap', post: p.id || idx + 1, message: label + ': long product name replaced with "' + shortName + '".' });

      var arrTags = [];
      var arr = Array.isArray(p.hashtags) ? p.hashtags : (typeof p.hashtags === 'string' ? [p.hashtags] : []);
      arr.forEach(function (it) {
        var s = String(it || '').trim();
        var parts = tagsFromItem(s);
        var innerHash = s.replace(/^#/, '').indexOf('#') >= 0;           // "#a#b"
        var multi = s.indexOf('#') >= 0 && /\s/.test(s);                 // "#a #b" crammed into one item
        if (innerHash || multi || parts.some(function (x) { return !tagValid(x); })) hadBad = true;
        arrTags = arrTags.concat(parts);
      });
      var all = uniq(arrTags.concat(collected)).filter(tagValid);

      var fallback = [compact(shortName), compact(intel.category), compact(p.context)].concat(BRAND_TAGS.map(cleanTag));
      fallback.forEach(function (t) { if (all.length < 4 && tagValid(t) && all.indexOf(t) < 0) all.push(t); });
      if (hadBad) fixes.push({ code: 'hashtag', post: p.id || idx + 1, message: label + ': malformed hashtags repaired (each tag separated by a space, none concatenated).' });
      p.hashtags = all.slice(0, 6);
    });
    return { ai: ai, fixes: fixes };
  }

  /* ----------------------------------------------------------- pattern sets */
  // First-person / invented personal experience and invented social proof.
  var FABRICATION = [
    /\b(saya|aku|sy|gua)\s+(?:\w+\s+){0,2}?(pernah|dah pernah|baru\s+(?:je\s+)?(?:beli|cuba|guna|try|dapat|jumpa)|cuba|try|beli|guna|pakai|jumpa|dapat|alami|alaminya|tengok sendiri|rasa sendiri|test|uji)\b/i,
    /\b(pernah)\s+(saya|aku|sy)\b/i,
    /\b(awal minggu lepas|minggu lepas|semalam|tadi|hari tu|bulan lepas|tahun lepas|baru-baru ini|dulu)\s*,?\s*(saya|aku|sy)\b/i,
    /\b(saya|aku|sy)\s+(?:\w+\s+){0,3}?(minggu lepas|semalam|tadi pagi|tadi|hari tu|bulan lepas)\b/i,
    /\b(abang|kakak|kak|along|angah|adik|mak|emak|ayah|abah|bapa|ibu|suami|isteri|bini|laki|kawan|rakan|jiran|bos|sepupu|anak|nenek|atuk|pakcik|makcik|cikgu|rakan sekerja)\s+(saya|aku|sy)\b/i,
    /\b(pengalaman|testimoni|review)\s+(saya|aku|sy|sendiri)\b/i,
    /\b(kami|kitorang)\s+(dah|telah|pernah)\s+(guna|cuba|beli|try|pakai)\b/i,
    /\bi\s+(tried|used|bought|tested|have been using|had)\b/i,
    /\b(ramai|ribuan|ratusan|berpuluh)\s+(pelanggan|pembeli|pengguna|orang)\s+(dah|telah|yang dah|yang telah)\b/i,
    /\b(pelanggan|pembeli)\s+(kami\s+)?(cakap|kata|puas hati|suka)\b/i
  ];
  // Health / efficacy claims that need explicit support from the user.
  var MEDICAL = [
    /\b(merawat|rawat|dirawat|mengubati|ubati|menyembuhkan|sembuh|sembuhkan|penyembuhan|memulihkan|pulihkan|pemulihan)\b/i,
    /\b(terus|cepat|automatik)\s+(hilang|lega|sembuh|pulih)\b/i,
    /\b(hilang(?:kan)?|lenyap(?:kan)?|buang)\s+(sakit|lenguh|sengal|lenguh-lenguh|kejang|tegang|kekejangan)\b/i,
    /\b(melegakan|legakan|mengurangkan|kurangkan|mengatasi|atasi|menghilangkan)\s+(sakit|lenguh|sengal|kejang|tegang|otot|saraf|urat|stres|stress)\b/i,
    /\b(terbukti|dibuktikan|bukti klinikal|klinikal|clinically|kajian (?:menunjukkan|mendapati)|disahkan (?:doktor|pakar))\b/i,
    /\b(doktor|pakar|ahli fisioterapi|fisioterapi)\s+(?:\w+\s+){0,2}?(syor|cadang|sahkan|recommend|guna)\b/i,
    /\b(dijamin|jaminan|jamin|pasti (?:hilang|sembuh|berkesan)|mujarab|ajaib)\b|\b100\s?%/i,
    /\b(berkesan|keberkesanan)\b/i,
    /\b(punca|disebabkan|akibat)\b[^.!?\n]{0,50}\b(sakit|lenguh|sengal|otot|saraf|urat|tulang|sendi|postur|leher|belakang|bahu|pinggang)\b/i,
    /\bsebab\b[^.!?\n]{0,25}\b(otot|saraf|urat|tulang|sendi|postur)\b/i,
    /\b(ini|itu)\s+(tanda|petanda|simptom|gejala)\b/i,
    /\b(ganti|pengganti|gantikan)\s+(fisioterapi|rawatan|ubat|doktor|urut)/i,
    /\b(sakit saraf|saraf terhimpit|slip disc|sciatica|arthritis|sakit sendi kronik)\b/i
  ];
  var BANNED_OPENERS = [/^pernah tak (korang|kawan|anda|awak)\b/i];
  var BANNED_CTA = /\b(link|pautan)\s+(dekat|kat|di|dalam|pada)\s+(ruangan\s+)?(komen|komen)\b|\bruangan komen\b/i;
  var OFFICE = /\b(pejabat|office|laptop|meja kerja|komputer|9\s?(?:to|-)\s?5)\b/i;
  var SPORT = /\b(badminton|futsal|gym|bola sepak|jogging|berlari|marathon|sukan|squash|tenis)\b/i;

  // A matched phrase is tolerated only if the user typed that exact phrase (whole words) in name/target/points.
  function allowedByUser(rx, ctx) {
    var userText = [ctx.userName, ctx.points, ctx.target, ctx.extra].filter(Boolean).join(' \n ');
    return function (match) {
      return !!userText && new RegExp('(^|[^a-z0-9])' + esc(match).replace(/\s+/g, '\\s+') + '([^a-z0-9]|$)', 'i').test(userText);
    };
  }

  function findPattern(patterns, text, ctx) {
    var allowed = allowedByUser(null, ctx || {});
    for (var i = 0; i < patterns.length; i++) {
      var m = String(text || '').match(patterns[i]);
      if (m && !allowed(m[0])) return m[0];
    }
    return null;
  }

  function userSuppliedExperience(ctx) {
    var t = [ctx.points, ctx.target, ctx.extra].filter(Boolean).join(' ');
    return FABRICATION.slice(0, 8).some(function (rx) { return rx.test(t); });
  }


  /* ---------------- Product claim + cross-post evidence engines (V10) */
  var PRODUCT_CLAIM_RULES = [
    { category: 'source', type: 'rujukan sumber rasmi', rx: /\b(berdasarkan maklumat (?:kedai|laman|listing|penjual) rasmi|menurut (?:kedai|laman|penjual) rasmi|disahkan oleh (?:kedai|penjual)|diperakui secara rasmi|official store confirmed)\b/i },
    { category: 'unverified', type: 'keselesaan/kesesuaian', rx: /\b(selesa(?: dipakai| digunakan| sepanjang hari)?|nyaman|ergonomik|terletak elok|kemas dipakai|fit(?:ting)? yang bagus|tak panas|tidak panas)\b/i },
    { category: 'unverified', type: 'ketahanan/kualiti', rx: /\b(tahan lama|tahan lasak|tidak mudah rosak|berkualiti tinggi|kualiti premium|kain tebal|fabrik tebal|jahitan kukuh)\b/i },
    { category: 'unverified', type: 'fungsi/manfaat', rx: /\b(memudahkan|mempercepat|menjimatkan masa|melancarkan|lebih praktikal|pasti berbaloi|sangat berbaloi|meningkatkan keyakinan|confirm nampak)\b/i },
    { category: 'unverified', type: 'bahan/fabrik', rx: /\b(?:kain|fabrik|material|bahan)\s+(?:jenis\s+)?(?:cotton|kapas|sutera|silk|linen|polyester|chiffon|premium|tebal|lembut)\b/i },
    { category: 'visual', type: 'pemerhatian visual', rx: /\b(nampak|kelihatan|corak|warna|rekaan|design|jahitan|butang|potongan|labuh|paras|motif|geometri)\b/i }
  ];
  function claimIsUserSupported(match, ctx) {
    ctx = ctx || {};
    var userText = [ctx.userName, ctx.points, ctx.target, ctx.extra, ctx.verifiedFacts, ctx.productFacts]
      .filter(Boolean).join(' \n ');
    return !!userText && new RegExp('(^|[^a-z0-9])' + esc(match).replace(/\s+/g, '\\s+') + '([^a-z0-9]|$)', 'i').test(userText);
  }
  function classifyProductClaims(text, ctx) {
    var found = [];
    PRODUCT_CLAIM_RULES.forEach(function (rule) {
      var m = String(text || '').match(rule.rx);
      if (!m || rule.category === 'visual') return;
      if (rule.category === 'unverified' && claimIsUserSupported(m[0], ctx)) return;
      if (!found.some(function (x) { return x.match.toLowerCase() === m[0].toLowerCase(); }))
        found.push({ category: rule.category, type: rule.type, match: m[0] });
    });
    return found;
  }
  function storyArcCheck(items, textOf) {
    items = Array.isArray(items) ? items : [];
    textOf = typeof textOf === 'function' ? textOf : function (p) { return [p.hook, p.problem, p.agitation, p.solution, p.benefit, p.proof, p.cta].join(' '); };
    var issues = [];
    function setOf(s) { return contentWords(String(s || '')); }
    items.forEach(function (p, i) {
      for (var j = 0; j < i; j++) {
        var q = items[j];
        var painA = setOf([p.problem, p.agitation].join(' '));
        var painB = setOf([q.problem, q.agitation].join(' '));
        var settingA = setOf([p.context, p.setting, p.persona].join(' '));
        var settingB = setOf([q.context, q.setting, q.persona].join(' '));
        var solutionA = setOf([p.solution, p.benefit].join(' '));
        var solutionB = setOf([q.solution, q.benefit].join(' '));
        var pain = jaccard(painA, painB), setting = jaccard(settingA, settingB), solution = jaccard(solutionA, solutionB);
        if (pain > 0.60 && setting > 0.60) {
          issues.push({ code: 'same-story', post: p.id || i + 1, severity: 'error',
            message: 'Post ' + (p.id || i + 1) + ' terlalu hampir dengan Post ' + (q.id || j + 1) +
              ' pada sudut masalah (' + Math.round(pain * 100) + '%) dan situasi (' + Math.round(setting * 100) +
              '%). Tukar masalah pembeli atau persona/setting; jangan hanya ubah emosi dan CTA.' });
        } else if (pain > 0.70 && solution > 0.60) {
          issues.push({ code: 'same-arc', post: p.id || i + 1, severity: 'warning',
            message: 'Post ' + (p.id || i + 1) + ' berkongsi masalah dan penyelesaian yang hampir sama dengan Post ' + (q.id || j + 1) + '. Bezakan mekanisme penyelesaian.' });
        }
      }
    });
    var factCounts = {};
    items.forEach(function (p) {
      var t = String(textOf(p) || '');
      (t.match(/\bRM\s?\d+(?:[.,]\d{2})?\b/gi) || []).forEach(function (x) {
        var k = x.replace(/\s+/g, '').toUpperCase(); factCounts[k] = (factCounts[k] || 0) + 1;
      });
    });
    Object.keys(factCounts).forEach(function (fact) {
      if (factCounts[fact] >= 4) issues.push({ code: 'repeated-fact', post: 0, severity: 'error',
        message: 'Fakta harga "' + fact + '" berulang dalam ' + factCounts[fact] + ' post. Hadkan kepada 1–2 post; gunakan sudut bukti berbeza untuk post lain.' });
    });
    return issues;
  }

  /* --------------------------------------------------------------- validate */
  function validate(ai, ctx) {
    ctx = ctx || {};
    var errors = [], warnings = [];
    var posts = Array.isArray(ai && ai.posts) ? ai.posts : [];
    var shortName = (ai && ai.productIntelligence && ai.productIntelligence.shortName) || deriveShortName(ctx.userName || '');
    var skipFab = userSuppliedExperience(ctx);
    function err(code, post, msg) { errors.push({ code: code, post: post, message: (post ? 'Post ' + post + ': ' : '') + msg }); }
    function warn(code, post, msg) { warnings.push({ code: code, post: post, message: (post ? 'Post ' + post + ': ' : '') + msg }); }

    if (posts.length < 10) err('count', 0, 'Expected 10 posts, got ' + posts.length + '.');

    var platforms = ['facebook', 'threads', 'x'];
    var longNameTokens = String(ctx.userName || (ai.productIntelligence && ai.productIntelligence.name) || '').split(/\s+/).filter(Boolean);

    posts.forEach(function (p, idx) {
      var id = p.id || idx + 1;
      platforms.forEach(function (f) {
        var t = String(p[f] || '');
        var label = f === 'x' ? 'X' : f.charAt(0).toUpperCase() + f.slice(1);
        if (!t.trim()) { err('missing', id, label + ' version is empty.'); return; }

        // fabricated experience
        if (!skipFab) {
          var fab = findPattern(FABRICATION, t, ctx);
          if (fab) err('fabricated-experience', id, label + ' contains invented personal experience / social proof: "' + fab + '". Use audience-focused or hypothetical wording ("Bayangkan…", "Untuk yang…").');
        }
        // medical
        var med = findPattern(MEDICAL, t, ctx);
        if (med) err('medical-claim', id, label + ' contains an unsupported health/efficacy claim: "' + med + '".');

        // hashtags inside text
        var tokens = t.match(/\S*#\S*/g) || [];
        tokens.forEach(function (tok) {
          if (!/^#[A-Za-z0-9_]{2,28}$/.test(tok)) err('hashtag', id, label + ' has malformed hashtag "' + snippet(tok, 40) + '".');
        });
        if (/\S#/.test(t)) err('hashtag', id, label + ' has concatenated hashtags.');

        // product-name repetition
        var count = (t.match(new RegExp(esc(shortName), 'ig')) || []).length;
        var maxN = f === 'x' ? 1 : 2;
        if (count > maxN) err('name-repetition', id, label + ' repeats the product name "' + shortName + '" ' + count + 'x (max ' + maxN + '). Use "ni", "benda ni", "yang kecil ni" etc.');
        if (longNameTokens.length >= 6) {
          var lw = words(t).join(' ');
          for (var i = 0; i + 5 <= longNameTokens.length; i++) {
            var run = longNameTokens.slice(i, i + 5).join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            if (run && lw.indexOf(run) >= 0) { err('name-repetition', id, label + ' contains the long raw product title. Use the short name only.'); break; }
          }
        }
      });

      // hashtag array (what the UI will print)
      var tags = Array.isArray(p.hashtags) ? p.hashtags : [];
      if (tags.length < 3) err('hashtag', id, 'Needs at least 3 hashtags in the hashtags array.');
      tags.forEach(function (t) {
        if (!tagValid(String(t).replace(/^#/, '')) || String(t).replace(/^#/, '').indexOf('#') >= 0) err('hashtag', id, 'Invalid hashtag "' + t + '".');
      });
      ['angle', 'context', 'hookType', 'ctaType'].forEach(function (k) {
        if (!String(p[k] || '').trim()) warn('field', id, 'Missing "' + k + '".');
      });
      if (!String(p.visualDetail || '').trim()) warn('product-specific', id, 'No "visualDetail" (visible product detail) declared.');
      if (String(p.x || '').length > 280) warn('x-length', id, 'X version is over 280 characters (' + String(p.x).length + ').');
      var fbWords = words(p.facebook).length;
      if (fbWords && fbWords < 50) warn('length', id, 'Facebook version is very short (' + fbWords + ' words).');
    });

    /* ---- cross-post sameness ---- */
    platforms.forEach(function (f) {
      var label = f === 'x' ? 'X' : f.charAt(0).toUpperCase() + f.slice(1);
      // repeated openings
      var seenOpen = {}, openSets = [];
      posts.forEach(function (p, idx) {
        var id = p.id || idx + 1;
        var s = sentences(p[f])[0] || '';
        var w = words(s);
        var key = w.slice(0, 3).join(' ');
        if (key) {
          if (seenOpen[key]) err('repeated-opening', id, label + ' opening repeats Post ' + seenOpen[key] + ' ("' + snippet(s, 50) + '").');
          else seenOpen[key] = id;
        }
        openSets.push({ id: id, set: contentWords(s), text: s });
      });
      for (var i = 0; i < openSets.length; i++) for (var j = i + 1; j < openSets.length; j++) {
        if (words(openSets[i].text).slice(0, 3).join(' ') === words(openSets[j].text).slice(0, 3).join(' ')) continue;
        if (openSets[i].set.size >= 4 && jaccard(openSets[i].set, openSets[j].set) >= 0.6) err('repeated-opening', openSets[j].id, label + ' opening is nearly the same as Post ' + openSets[i].id + '.');
      }
    });

    var pernah = 0, ctaKomen = 0, closers = [];
    posts.forEach(function (p, idx) {
      var id = p.id || idx + 1;
      var fb = String(p.facebook || '');
      var first = sentences(fb)[0] || '';
      BANNED_OPENERS.forEach(function (rx) { if (rx.test(first)) pernah++; });
      if (BANNED_CTA.test(fb)) ctaKomen++;
      var sn = sentences(fb);
      var last = sn[sn.length - 1] || '';
      closers.push({ id: id, text: last, key: words(last).slice(0, 4).join(' '), set: contentWords(last) });
    });
    if (pernah > 1) err('repeated-opening', 0, '"Pernah tak korang…" is used to open ' + pernah + ' posts (max 1).');
    if (ctaKomen > 1) err('repeated-cta', 0, 'The "link dekat ruangan komen" CTA is used in ' + ctaKomen + ' posts (max 1).');
    var seenClose = {};
    closers.forEach(function (c, i) {
      if (c.key && seenClose[c.key]) err('repeated-cta', c.id, 'Closing line repeats Post ' + seenClose[c.key] + ' ("' + snippet(c.text, 50) + '").');
      else if (c.key) seenClose[c.key] = c.id;
    });
    for (var a = 0; a < closers.length; a++) for (var b = a + 1; b < closers.length; b++) {
      if (closers[a].key === closers[b].key) continue;
      if (closers[a].set.size >= 4 && jaccard(closers[a].set, closers[b].set) >= 0.6) err('repeated-cta', closers[b].id, 'Closing line is nearly the same as Post ' + closers[a].id + '.');
    }

    // overall body similarity (Facebook)
    var bodies = posts.map(function (p) { return contentWords(p.facebook); });
    for (var x = 0; x < bodies.length; x++) for (var y = x + 1; y < bodies.length; y++) {
      var sim = jaccard(bodies[x], bodies[y]);
      if (sim >= 0.5) err('too-similar', posts[y].id || y + 1, 'Facebook text is ' + Math.round(sim * 100) + '% similar to Post ' + (posts[x].id || x + 1) + ' — different angle/situation needed.');
    }

    // labels
    ['angle', 'context'].forEach(function (k) {
      var seen = {};
      posts.forEach(function (p, idx) {
        var v = norm(p[k]); if (!v) return;
        if (seen[v]) err('repeated-' + k, p.id || idx + 1, k + ' "' + p[k] + '" duplicates Post ' + seen[v] + '.'); else seen[v] = p.id || idx + 1;
      });
    });
    ['hookType', 'ctaType'].forEach(function (k) {
      var cnt = {};
      posts.forEach(function (p) { var v = norm(p[k]); if (v) cnt[v] = (cnt[v] || 0) + 1; });
      Object.keys(cnt).forEach(function (v) { if (cnt[v] > 2) err('repeated-' + k, 0, k + ' "' + v + '" used in ' + cnt[v] + ' posts (max 2).'); });
    });

    // overused Malaysian contexts
    [['office/laptop', OFFICE], ['sport', SPORT]].forEach(function (g) {
      var n = posts.filter(function (p) { return g[1].test(String(p.facebook || '')); }).length;
      if (n > 2) err('repeated-context', 0, 'The ' + g[0] + ' context appears in ' + n + ' posts (max 2). Vary the Malaysian situations.');
    });

    var details = uniq(posts.map(function (p) { return norm(p.visualDetail); }).filter(Boolean));
    if (posts.length >= 10 && details.length < 4) warn('product-specific', 0, 'Only ' + details.length + ' distinct visualDetail values — anchor posts to more visible product details.');

    return { errors: errors, warnings: warnings, ok: errors.length === 0 };
  }

  function runQA(rawAI, ctx) {
    var s = sanitize(rawAI, ctx);
    var v = validate(s.ai, ctx);
    return { ai: s.ai, fixes: s.fixes, errors: v.errors, warnings: v.warnings, ok: v.ok };
  }

  /* ------------------------------------------------ V10 generic checker (Story + Problem-to-CTA) */
  var CLICHES = /\b(tahukah anda|dalam dunia yang serba|jangan lepaskan peluang|wajib ada|anda tidak akan menyesal|revolusi|solusi terbaik|hadir untuk anda|mengapa pilih|rebut sekarang|stok terhad|stock terhad)\b/i;

  // items: array of objects; opts: { fields:[text fields scanned], textOf(item)->string (optional),
  //   openField, closeField, expected, minWords, maxWords, shortName }
  function checkItems(items, ctx, opts) {
    ctx = ctx || {}; opts = opts || {};
    items = Array.isArray(items) ? items : [];
    var errors = [], warnings = [];
    function err(code, id, msg) { errors.push({ code: code, post: id, message: (id ? 'Item ' + id + ': ' : '') + msg }); }
    function warn(code, id, msg) { warnings.push({ code: code, post: id, message: (id ? 'Item ' + id + ': ' : '') + msg }); }
    var skipFab = userSuppliedExperience(ctx);
    var shortName = opts.shortName || '';
    if (opts.expected && items.length !== opts.expected) err('count', 0, 'Expected ' + opts.expected + ' items, got ' + items.length + '.');

    var bodies = [], opens = [], closes = [];
    items.forEach(function (p, idx) {
      var id = p.id || idx + 1;
      var fields = opts.fields || [];
      fields.forEach(function (f) {
        if (!String(p[f] || '').trim()) err('missing', id, 'Field "' + f + '" is empty.');
      });
      var full = opts.textOf ? opts.textOf(p) : fields.map(function (f) { return p[f]; }).join(' ');
      bodies.push(contentWords(full));
      var wc = words(full).length;
      if (opts.minWords && wc < opts.minWords) err('length', id, 'Too short (' + wc + ' words, need at least ' + opts.minWords + ').');
      if (opts.maxWords && wc > opts.maxWords) warn('length', id, 'Long (' + wc + ' words).');

      if (!skipFab) { var fab = findPattern(FABRICATION, full, ctx); if (fab) err('fabricated-experience', id, 'invented personal experience / social proof: "' + fab + '". Use second person, shared observation or a clearly hypothetical scenario.'); }
      var med = findPattern(MEDICAL, full, ctx); if (med) err('medical-claim', id, 'unsupported health/efficacy claim: "' + med + '".');
      var cl = full.match(CLICHES); if (cl) err('cliche', id, 'AI-sounding cliché "' + cl[0] + '". Rewrite in natural friend-to-friend Malay.');
      if (/https?:\/\/|www\./i.test(full)) err('url', id, 'contains a URL; the app appends the real link.');
      if (/#\w/.test(full)) err('hashtag', id, 'hashtags inside text; use the hashtags array only.');
      if (shortName) {
        var cnt = (full.match(new RegExp(esc(shortName), 'ig')) || []).length;
        if (cnt > 2) err('name-repetition', id, 'product name "' + shortName + '" repeated ' + cnt + ' times (max 2).');
      }
      var tags = Array.isArray(p.hashtags) ? p.hashtags : [];
      if (tags.filter(function (t) { return tagValid(cleanTag(t)); }).length < 3) err('hashtag', id, 'needs at least 3 valid hashtags.');

      var openText = opts.openField ? String(p[opts.openField] || '') : full;
      var closeText = opts.closeField ? String(p[opts.closeField] || '') : full;
      var os = sentences(openText)[0] || '';
      var cs = sentences(closeText); cs = cs[cs.length - 1] || '';
      opens.push({ id: id, text: os, key: words(os).slice(0, 3).join(' '), set: contentWords(os) });
      closes.push({ id: id, text: cs, key: words(cs).slice(0, 4).join(' '), set: contentWords(cs) });
      if (BANNED_OPENERS[0].test(os)) warn('opener', id, '"Pernah tak korang…" opener.');
    });

    function dupes(list, label, code) {
      var seen = {};
      list.forEach(function (c) {
        if (!c.key) return;
        if (seen[c.key]) err(code, c.id, label + ' repeats item ' + seen[c.key] + ' ("' + snippet(c.text, 50) + '").'); else seen[c.key] = c.id;
      });
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        if (list[i].key && list[i].key === list[j].key) continue;
        if (list[i].set.size >= 4 && jaccard(list[i].set, list[j].set) >= 0.6) err(code, list[j].id, label + ' is nearly the same as item ' + list[i].id + '.');
      }
    }
    dupes(opens, 'Opening', 'repeated-opening');
    dupes(closes, 'Closing/CTA', 'repeated-cta');
    for (var x = 0; x < bodies.length; x++) for (var y = x + 1; y < bodies.length; y++) {
      var sim = jaccard(bodies[x], bodies[y]);
      if (sim >= 0.45) err('too-similar', items[y].id || y + 1, 'text is ' + Math.round(sim * 100) + '% similar to item ' + (items[x].id || x + 1) + '; needs a different angle/situation.');
    }
    return { errors: errors, warnings: warnings, ok: errors.length === 0 };
  }

  // Text fed back to the model when regenerating.
  function buildFeedback(errors) {
    return errors.slice(0, 25).map(function (e, i) { return (i + 1) + '. ' + e.message; }).join('\n');
  }

  return {
    runQA: runQA, sanitize: sanitize, validate: validate, buildFeedback: buildFeedback, checkItems: checkItems,
    deriveShortName: deriveShortName, resolveShortName: resolveShortName,
    extractInlineHashtags: extractInlineHashtags, tagsFromItem: tagsFromItem, formatTags: formatTags,
    classifyProductClaims: classifyProductClaims, storyArcCheck: storyArcCheck,
    _patterns: { FABRICATION: FABRICATION, MEDICAL: MEDICAL }
  };
});
