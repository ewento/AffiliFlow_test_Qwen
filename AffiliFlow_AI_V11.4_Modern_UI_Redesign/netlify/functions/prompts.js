// AffiliFlow AI V10 — prompt builders, JSON schemas and the slash-command dictionary.
// Runs server-side only (bundled into the Netlify function). The browser sends a task name + form fields,
// never raw prompts, so the Gemini key can't be used as a general-purpose proxy.

/* ------------------------------------------------------------------ schema helpers */
const str = (description) => (description ? { type: "STRING", description } : { type: "STRING" });
const int = () => ({ type: "INTEGER" });
const arr = (items, min, max) => {
  const a = { type: "ARRAY", items };
  if (min) a.minItems = min;
  if (max) a.maxItems = max;
  return a;
};
const obj = (properties) => ({
  type: "OBJECT",
  properties,
  required: Object.keys(properties),
  propertyOrdering: Object.keys(properties),
});

/* ------------------------------------------------------------------ fixed schedules */
// Malaysian posting windows (local time). Starting points to test, not guarantees.
export const STORY_SLOTS = [
  { time: "6:30 AM", mood: "tenang & ringan", angle: "Pemerhatian kecil pagi hari", why: "Selepas subuh, orang scroll sebelum bersiap — feed masih sunyi dan perhatian penuh." },
  { time: "8:00 AM", mood: "praktikal & cepat dibaca", angle: "Soalan jujur seorang pembeli", why: "Waktu ke tempat kerja / hantar anak — puncak buka telefon, ayat perlu pendek." },
  { time: "10:00 AM", mood: "ingin tahu", angle: "Tip pembeli atau kesilapan biasa semasa memilih produk jenis ini", why: "Rehat pagi — mood belajar sesuatu yang berguna." },
  { time: "12:30 PM", mood: "ringan & geli hati", angle: "Humor relatable (pemerhatian, bukan kisah peribadi)", why: "Waktu makan tengah hari — scroll santai, content ringan paling laku." },
  { time: "3:00 PM", mood: "empati", angle: "Perincian visual yang perasan dalam gambar produk", why: "Tenaga petang menurun — orang cari idea dan hiburan ringan." },
  { time: "5:30 PM", mood: "penat tapi lega", angle: "Situasi harian hipotetikal ('Katakan anda…', jelas sebagai senario)", why: "Waktu balik kerja — menunggu/dalam perjalanan, mood mahu rehat." },
  { time: "7:45 PM", mood: "hangat & kasih", angle: "Untuk orang tersayang / hadiah / pertimbangan keluarga", why: "Selepas Maghrib & makan malam — mood keluarga dan kasih sayang." },
  { time: "9:00 PM", mood: "mendalam & bercerita", angle: "Cerita lebih panjang: situasi → pertimbangan → keputusan", why: "Puncak aktiviti media sosial selepas Isyak — orang sanggup baca lebih panjang." },
  { time: "10:00 PM", mood: "reflektif & tenang", angle: "Sesuai untuk siapa dan siapa boleh langkau (jujur)", why: "Sebelum tidur — keputusan membeli dibuat dengan tenang." },
  { time: "11:00 PM", mood: "lembut & tanpa tekanan", angle: "Soft-sell ringkas dengan CTA tenang", why: "Pemburu 'checkout' lewat malam; persaingan content rendah." },
];

export const PROBLEM_SLOTS = ["6:00 AM", "11:00 AM", "1:00 PM", "4:00 PM", "6:00 PM", "9:00 PM"];

const PROBLEM_EMOTIONS = [
  { emotion: "Penat / frustrasi kecil → lega", technique: "Empati cermin: cermin perasaan tepat pembaca dalam satu babak mikro yang konkrit (bunyi, gerak, objek), baru tawarkan jalan keluar." },
  { emotion: "Rindu / kasih keluarga", technique: "Nostalgia umum: pemerhatian yang dikongsi ramai (bukan kenangan peribadi rekaan) yang menyentuh hati, kemudian hubungkan dengan keputusan membeli untuk insan tersayang." },
  { emotion: "Risau → tenang", technique: "Prihatin tanpa menakutkan: tunjuk kebimbangan yang munasabah, kemudian beri langkah semakan yang menenangkan (baca label/butiran, bandingkan)." },
  { emotion: "Segan / malu → yakin", technique: "Normalkan perasaan: 'bukan awak seorang', kemudian bina keyakinan melalui butiran yang boleh dilihat." },
  { emotion: "Geli hati → 'eh, betul juga'", technique: "Humor hangat: ayat lucu yang mesra dan relatable, kemudian tukar tiba-tiba kepada pandangan yang jujur dan berguna." },
  { emotion: "Syukur / bangga memilih bijak", technique: "Rasa puas membuat keputusan baik: bayangkan perasaan selepas memilih dengan teliti, ditutup dengan CTA yang tenang tanpa tekanan." },
];

const MALAY_SETTINGS_A = ["pagi di dapur / meja makan", "dalam kereta / e-hailing / motosikal", "asrama / kolej", "surau / kenduri / majlis keluarga", "kedai makan / mamak"];
const MALAY_SETTINGS_B = ["balik kampung / rumah keluarga", "pasar malam / kedai runcit", "gotong-royong / kemas rumah hujung minggu", "kerja syif / kilang / kedai", "melancong (Cameron / Langkawi) / hotel"];

/* ------------------------------------------------------------------ slash command dictionary */
// command -> what it must become in plain visual language. Used only by the video task.
const SL = {
  "Lighting & Mood": {
    GoldenHourProduct: "warm low golden-hour sunlight, long soft shadows, amber rim on the product",
    SunsetProductAd: "deep orange-pink sunset glow, warm backlit edges, rich colour grade",
    SunriseProductAd: "fresh pale sunrise light, gentle haze, clean optimistic mood",
    BlueHourProduct: "cool blue twilight ambience with warm practical lights in the background",
    StudioLightingAd: "controlled softbox studio light, clean even highlights, neutral backdrop",
    DramaticLightingAd: "high-contrast directional light, deep shadows, strong shaping highlight",
    SoftLightingAd: "large diffused soft light, gentle shadows, natural flattering look",
    HardLightProduct: "hard direct light, crisp defined shadows, bold graphic look",
    RimLightProduct: "thin bright rim light separating product edges from a darker background",
    BacklightProduct: "backlighting that makes edges glow, subtle atmospheric haze",
    SpotlightProduct: "single focused spotlight on the product with dark falloff",
    VolumetricLightAd: "visible light rays through light haze, atmospheric depth",
    MoonlightProduct: "cool silvery moonlit night mood, soft highlights",
    CandlelightProduct: "warm flickering candle-like glow, intimate low-key mood",
    DiscoLightProduct: "coloured party lights as background accents; product kept evenly lit",
  },
  Transitions: {
    LiquidTransition: "fluid liquid wipe carries the shot into the next view",
    SmokeTransition: "soft smoke sweep passes the lens and reveals the next view",
    FireTransition: "warm ember-flash wipe into the next view (stylised, away from product)",
    IceTransition: "frost wipe across the frame into the next view",
    GlassTransition: "glass refraction wipe into the next view",
    MirrorTransition: "mirror-flip wipe into the next view",
    LightTransition: "bright light bloom washes the frame and resolves into the next view",
    FlashTransition: "quick white flash cut into the next view",
    ParticleTransition: "drifting particles dissolve the shot into the next view",
    EnergyTransition: "subtle energy-pulse wipe into the next view",
    PortalTransition: "circular portal wipe into the next view",
    VortexTransition: "swirling vortex wipe into the next view",
    ZoomTransition: "fast zoom-through into the next view",
    WhipPanTransition: "fast whip-pan with motion blur into the next view",
    MatchCutTransition: "match cut on a similar shape or motion into the next view",
  },
  "Product Reveal & Motion": {
    ProductHeroShot: "centred hero framing of the product, clean and confident",
    LuxuryProductReveal: "slow premium reveal with glossy highlights and controlled reflections",
    CinematicProductReveal: "cinematic reveal: product emerges from shadow or focus into full view",
    Product360Spin: "smooth 360-degree turn showing every visible side",
    ProductSlowMotion: "slow-motion capture of the product moment",
    ProductFloating: "product floating gently, weightless, stable and undistorted",
    ProductGravityDefy: "product hovering in mid-air with subtle motion, shape unchanged",
    ProductLightSweep: "a soft highlight sweeps across the product surface",
    ProductMacroReveal: "macro reveal sliding across visible detail",
    ProductCloseUp: "tight close-up on the product's visible design",
    ProductRotation: "slow steady rotation on a stable base",
  },
  "Camera & Angles": {
    CinematicPushIn: "smooth cinematic dolly push-in",
    CinematicPullOut: "smooth pull-out revealing context",
    FastPushIn: "quick energetic push-in",
    SlowPushIn: "very slow, subtle push-in building focus",
    TopDownProduct: "overhead top-down angle",
    LowAngleProduct: "low angle looking up, product feels prominent",
    HighAngleProduct: "high angle looking down at the product",
    SideProfileProduct: "clean side-profile view",
    FrontProfileProduct: "straight-on front view",
    OverShoulderProduct: "over-the-shoulder view of a person handling the product",
    DroneProductShot: "elevated drone-style move over the scene (only if the setting suits)",
    HandheldProductAd: "handheld camera with natural micro-shake, authentic UGC feel",
    SteadicamProduct: "smooth steadicam glide following the action",
    OrbitReveal: "slow orbit around the product",
    SpiralCameraMove: "gentle spiralling camera move around the product",
  },
  "Materials & Texture": {
    MetallicProductAd: "emphasise metallic sheen and crisp reflections that exist on the real product",
    ChromeProductAd: "mirror-like chrome reflections (only if the product has chrome parts)",
    GoldProductAd: "warm gold tones in lighting and surroundings; product colour unchanged",
    SilverProductAd: "cool silver tones in lighting and surroundings; product colour unchanged",
    CrystalProductAd: "crystal-clear sparkle in the surroundings; product unchanged",
    MarbleProductAd: "marble surface under the product",
    VelvetProductAd: "velvet surface under or behind the product",
    SilkProductAd: "silk fabric flowing in the surroundings",
    LeatherProductAd: "leather surface texture in the surroundings",
    WoodProductAd: "warm wood surface under the product",
    PaperProductAd: "paper/craft textures in the surroundings",
    FabricProductAd: "soft fabric textures in the surroundings",
    ConcreteProductAd: "raw concrete surface, modern industrial feel",
    GlassProductAd: "glass surface/reflections in the surroundings",
    LiquidMetalAd: "liquid-metal accents in the surroundings (away from product)",
  },
  "Nature & Weather": {
    BotanicalGloom: "moody botanical greenery, deep green shadows",
    FlowerExplosion: "a burst of petals in the background; product stays clear",
    PetalStorm: "petals swirling in the air around the scene",
    LeafStorm: "leaves swirling around the scene",
    RainProductAd: "rain falling in the background, wet-surface reflections (only if the product suits)",
    WaterDropMacro: "macro water droplets near the product",
    OceanSplashAd: "ocean splash in the surroundings",
    WaveReveal: "a wave rolls away to reveal the scene",
    BubbleProductAd: "floating bubbles in the surroundings",
    DewDropProduct: "fresh dew drops on nearby leaves/surfaces",
    SnowfallProductAd: "gentle snowfall around the scene",
    SnowStormProduct: "snowstorm atmosphere in the background",
    LightningProductAd: "distant lightning flashes lighting the scene",
    ThunderstormProduct: "stormy sky, dramatic atmosphere",
    WindProductAd: "wind moving hair, fabric and leaves in the scene",
  },
  Environments: {
    ProductInNature: "product placed in a natural outdoor setting",
    ProductInSpace: "stylised outer-space environment",
    ProductOnTheMoon: "stylised lunar surface environment",
    ProductUnderwater: "underwater environment",
    ProductInTheClouds: "soft cloud-top environment",
    ProductInTheDesert: "desert dunes environment",
    ProductInTheJungle: "lush tropical jungle environment",
    ProductInTheOcean: "ocean environment",
    ProductInTheMountains: "mountain environment",
    ProductInTheArctic: "arctic ice environment",
    ProductInVolcano: "volcanic landscape environment",
    ProductInTheSky: "sky-high environment",
    ProductInTheCity: "urban city environment",
    ProductCyberpunkWorld: "neon cyberpunk city environment",
    ProductFantasyWorld: "fantasy world environment",
  },
  "Art & Animation": {
    PixarStyleAd: "3D animated feature-film look", ClaymationAd: "claymation look", WatercolorAd: "watercolour painted look",
    LegoAd: "toy-brick look", MiniatureProductWorld: "tilt-shift miniature-world look", AnimeProductAd: "anime look",
    ComicBookAd: "comic-book look", PopArtProduct: "pop-art look", RetroCartoonAd: "retro cartoon look",
    StopMotionProduct: "stop-motion look", PaperCutoutAd: "paper cut-out look", OrigamiProductAd: "origami look",
    SketchProductAd: "sketch look", InkProductAd: "ink-drawing look", OilPaintingAd: "oil-painting look",
    PencilSketchAd: "pencil-sketch look", NeonAnimationAd: "neon animated look", PixelArtProduct: "pixel-art look",
    RetroGameAd: "retro video-game look", ArcadeProductAd: "arcade look",
  },
};

// Everyday-realism commands the AI can pick for UGC / lifestyle ads (not in the button library; always allowed).
const SL_ADAPTIVE = {
  ugcHandheld: "authentic phone-filmed feel: handheld micro-shake, natural focus breathing, real-room light",
  productInUse: "the product is visibly being handled/used in a normal, honest way (no performance claims)",
  lifestyleMoment: "candid everyday moment where the product simply belongs in the scene",
  problemMoment: "a small relatable everyday frustration shown through action and expression only",
  unboxingReveal: "hands open or take the product out and present it to camera",
  handsOnInspect: "hands turn the product to examine its visible design, label and parts",
  macroDetail: "extreme close-up of real visible details: texture, edges, label, printed text",
  rackFocus: "focus pulls from foreground/background onto the product",
  sliderMove: "smooth lateral slider move with parallax",
  heroEndFrame: "final steady, well-composed hero frame with clean negative space (for text added later in editing)",
};

// Categories the AI may pick from automatically (realistic, product-faithful). Others only when the user types them.
const AUTO_OK = ["Lighting & Mood", "Product Reveal & Motion", "Camera & Angles"];

function slashDictionaryText() {
  const lines = [];
  for (const [cat, items] of Object.entries(SL)) {
    const auto = AUTO_OK.includes(cat) ? "AUTO-OK" : cat === "Transitions" ? "only if the clip actually changes shot" : "only if the user typed it, or it clearly fits the scene";
    lines.push(`## ${cat} (${auto})`);
    for (const [k, v] of Object.entries(items)) lines.push(`/${k} = ${v}`);
  }
  lines.push("## Everyday realism (AUTO-OK, preferred for UGC / lifestyle)");
  for (const [k, v] of Object.entries(SL_ADAPTIVE)) lines.push(`/${k} = ${v}`);
  return lines.join("\n");
}

export const KNOWN_SLASH = new Set([
  ...Object.values(SL).flatMap((o) => Object.keys(o)),
  ...Object.keys(SL_ADAPTIVE),
]);

/* ------------------------------------------------------------------ shared rules */
const CORE = `You are the content engine of AffiliFlow AI, used by a Malaysian affiliate marketer. You are given product reference image(s) plus form fields. You write social content in natural Bahasa Melayu Malaysia and prompts for Google Flow / Veo.

SOURCE OF TRUTH
- Facts = (a) what the user typed, (b) legible text printed on the product/packaging in the images. Everything else is a visual OBSERVATION ("nampak", "kelihatan") or a hypothetical scenario.
- Be bold with emotion and storytelling, strict with product facts. Never invent: specifications, battery, power, speeds, size, weight, material, waterproofing, safety, certification, ingredients, results, warranty, discounts, stock levels, ratings, sales numbers. Do not turn a routine or cosmetic product into a promise of an outcome; avoid claims like "bantu kembalikan kesegaran", "buat kulit lebih cerah", "hilangkan bintik", or "nampak hasil" unless that exact claim is explicitly supplied and appropriate.
- Never turn how something LOOKS into proof of how it WORKS. Never invent feature or mode names.
- No health, medical or pest-efficacy promises (no merawat, menyembuhkan, berkesan, mujarab, terbukti, dijamin, 100%, "selamat untuk anak/haiwan", "tanpa bahan kimia") unless the user typed that exact claim.
- No invented personal experience or real events. Do NOT write "saya/aku pernah…", "kawan saya…", "mak saya…", fake reviews, or "ramai pelanggan dah guna". Use second person, shared observations, or clearly hypothetical scenes. If a creator nickname is supplied, use that exact nickname naturally at least once in EACH finished post (for example, "Pagi ni, Abu July terfikir...") but never imply the described event really happened to the creator. Do not repeat the nickname in every sentence.
- OCR noise or unreadable text in images is ignored, never repeated.
- CONTEXT COHERENCE IS MANDATORY: identify the single most plausible primary context from target + product category, then keep every post inside that context. The setting ideas below are optional inspiration, NOT a checklist. Never randomly jump between kolej, surau, mamak, kereta, kilang, travel or family events unless each is genuinely relevant to the stated buyer and product. If context is unclear, use a neutral home / daily routine scene instead of inventing a location.
- TIME-OF-DAY COHERENCE: match the story opening, actions, lighting and routine to the exact publishing slot. For early morning, plausible openings include waking up, a thought from last night, a clearly hypothetical dream, preparing for the day, or a plan for later. Do not start a 6:00 AM post in a band studio already rehearsing unless the product/audience makes that genuinely plausible. Midday can use a break or practical check; afternoon can use a task after daily errands; evening/night can use home routines, reflection, or calm purchase consideration. Do not force a time cue into every sentence. Vary story action and angle before location.
- PRODUCT FACT LOCK: only repeat a size, volume, price, material, ingredient, model, specification or result if it is explicitly supplied by the user or clearly legible on the reference image. A marketplace title, guessed packaging, product category or visual scale is not proof. If sources conflict or the fact is uncertain, omit it and tell the reader to check the listing/label; never silently choose one value.
- Do not add unrelated festivals or occasions.

LANGUAGE & VOICE
- Write like a friend typing on WhatsApp, not like an advertisement: mix short and medium sentences, one idea per sentence, everyday words, light particles (lah, kan, je, tau) where natural, "awak/korang/kita".
- Concrete beats abstract: name the object, the sound, the moment. Specific micro-scenes create emotion; adjectives don't. Avoid fake scene narration such as "pagi tadi" or "malam tadi" unless the post is explicitly framed as hypothetical. Do not invent a first-person or real-time event just to make copy vivid.
- Banned clichés: "Tahukah anda", "Dalam dunia yang serba", "Jangan lepaskan peluang", "Wajib ada", "Anda tidak akan menyesal", "Revolusi", "Solusi terbaik", "Hadir untuk anda", "Mengapa pilih", "Rebut sekarang", "stok terhad" (unless user supplied), "Pernah tak korang" (max once in total, prefer never).
- Correct spelling and idiomatic Malaysian Malay. Proofread before answering. No machine-translated phrasing.
- Use the SHORT product name (intel.shortName), at most twice per post. Otherwise "benda ni", "yang ni", "ia".
- Never write the affiliate URL and never write hashtags inside text; the app appends both. Provide hashtags only in the "hashtags" array: 4-6 lowercase tags, no # sign, each one word (max 24 chars), relevant to the product, buyer and context. No year numbers.
- A CTA is one clear, relevant next action (comment a specific answer, save, share, tag a specific person, compare, open the listing and check the photos/label/options, A-or-B poll, or a calm no-pressure decision cue). It must relate to this product. Never an unrelated question.

Return ONLY JSON matching the schema.`;

function describeFields(f = {}) {
  const lines = [
    `Product name typed by user: ${f.name || "(not given — infer from images)"}`,
    `Creator nickname to humanize the narration: ${f.creatorName || "(not given)"}`,
    `Product description pasted by user (seller claims may be unverified; do not present as proven fact without support): ${f.productDescription || "(not provided)"}`,
    `Price: ${f.price ? "RM" + f.price : "(not given — never invent)"}`,
    `Target buyer: ${f.target || "(not given — infer carefully from the product)"}`,
    `Affiliate/listing URL supplied by user (URL text only; do not claim to have opened it): ${f.affiliateUrl || "(not given)"}`,
    `Selling points typed by user (the ONLY allowed product claims besides printed text): ${(f.points || []).length ? f.points.join(" | ") : "(none)"}`,
    `Writing style requested: ${f.style || "Santai / kawan"}`,
  ];
  return lines.join("\n");
}

function intelBlock(intel) {
  return "PRODUCT INTELLIGENCE (already established; reuse, do not change shortName):\n" + JSON.stringify(intel || {});
}

/* ------------------------------------------------------------------ TASK: intel */
export function buildIntel(f) {
  return {
    system: CORE,
    text: `TASK: Study the product reference images first, then fill the schema.\n\n${describeFields(f)}\n\nRules:
- shortName: 2-4 words a person would say aloud (never the keyword-stuffed marketplace title).
- primaryContext: the single strongest buyer context supported by the user input and images. secondaryContexts: 2-4 compatible ones.
- verifiedFacts: only user-typed facts and clearly legible printed text. visualIdentity: shape, colour, finish, parts, accessories, packaging, printed text/logo you can actually see.
- productLock: ONE English sentence (max 300 characters) describing exactly how the product looks, for a video model to reproduce it faithfully (colours, shape, proportions, visible logo/label text, visible parts). No marketing words, no unverified function.
- uncertain: claims people might assume but that are NOT verified.
- humanTensions: 4-6 short Malay phrases describing real small feelings or frictions of this buyer around this kind of product (e.g. a worry, an embarrassment, a small daily annoyance, a thing they secretly want). Framed as general observations, not as one person's story.`,
    schema: obj({
      shortName: str(),
      category: str(),
      audience: str(),
      primaryContext: str(),
      secondaryContexts: arr(str(), 1, 5),
      verifiedFacts: arr(str(), 0, 10),
      visualIdentity: arr(str(), 1, 10),
      productLock: str("English, max 300 characters"),
      uncertain: arr(str(), 0, 8),
      humanTensions: arr(str(), 3, 6),
    }),
    maxTokens: 3000,
    thinking: 0,
    temperature: 0.4,
  };
}

/* ------------------------------------------------------------------ TASK: story (two halves of 5) */
const storyItem = obj({
  id: int(),
  mood: str("main feeling of this story, 1-3 words (Malay)"),
  angle: str(),
  context: str("the Malaysian setting used"),
  hookType: str(),
  ctaType: str(),
  visualDetail: str("one concrete visible or user-supplied product detail used"),
  story: str("90-170 words, ready to post"),
  short: str("Threads/X version, max 230 characters, different first sentence"),
  hashtags: arr(str(), 4, 6),
});

export function buildStory(f, intel, half, feedback) {
  const start = half === 2 ? 5 : 0;
  const slots = STORY_SLOTS.slice(start, start + 5);
  const pool = half === 2 ? MALAY_SETTINGS_B : MALAY_SETTINGS_A;
  const table = slots
    .map((s, i) => `#${start + i + 1} | ${s.time} | feeling: ${s.mood} | angle: ${s.angle}`)
    .join("\n");
  return {
    system: CORE,
    text: `TASK: Write Story Content posts #${start + 1}-#${start + 5} of 10 (this call only writes these five; the other five are written separately, so make yours clearly distinctive).

${describeFields(f)}

${intelBlock(intel)}

SLOTS (each post will be published at its time, so match the feeling to that time of day):
${table}

OPTIONAL SETTING IDEAS (not a required rotation; reuse a fitting setting when natural, and reject any setting that does not match the product / target buyer / time slot): ${pool.join("; ")}.

FUNNEL STRATEGY — USE A DELIBERATE MIX, NOT SIX/TEN SALES PITCHES
- Across all 10 posts, distribute angles across TOFU (attention/relatable problem), MOFU (useful evaluation/comparison/how-to-check), and BOFU (decision support and listing CTA). Across this five-post batch, aim for at least 2 TOFU, 2 MOFU and 1 BOFU; the other batch must also be varied.
- TOFU: lead with an observable micro-moment, question, light humour or shared tension; product mention may be subtle and CTA should invite a comment/save/share, not always a purchase.
- MOFU: teach one practical buying check or explain one visible/verified feature; help the reader compare, inspect or decide. Do not invent expertise or specs.
- BOFU: state the supplied price only if provided, explain who may consider it and who may want to compare further; use a calm listing-check CTA, never false urgency.
- Make the funnel intent visible in angle/hookType/ctaType metadata, but never print labels like TOFU/MOFU/BOFU inside the ready-to-post story.

WHAT MAKES A GOOD STORY POST
- A complete mini-story the reader can post as-is, 90-170 words. If a creator nickname was supplied, include it naturally at least once in the public story, not only in metadata: a specific opening observation or moment (never a generic hook) → the situation → the product enters naturally → ONE grounded benefit or visible detail → an honest note (who it may suit / what to check) → a clear CTA.
- Emotion first. Each post carries one named feeling (the slot's feeling) shown through a concrete moment, not announced. Not every post may be sad, dramatic or salesy.
- Posts must differ in opening words, central idea, emotional beat, how the product enters and CTA action. No two posts may start with the same three words. Assign each post a different concrete setting/persona when plausible; do not reuse the same context metadata across the batch. If a context warning is returned, rewrite the affected posts with a genuinely different situation, not a renamed version of the same dressing-table scene. Change the setting only when it is plausible; continuity and relevance are more important than forcing five different locations. Do not make every post a question. Do not default to "3 perkara" lists; use a list only if it truly fits.
- "short": a fresh, punchy 1-3 sentence version for Threads/X, max 230 characters. Not just a truncation.
- Do not put schedule text, platform names, numbering or hashtags inside "story" or "short".
- Set id to ${start + 1}..${start + 5} in order.${feedback ? `\n\nYOUR PREVIOUS ATTEMPT FAILED THESE CHECKS. Rewrite the affected posts and fix every issue:\n${feedback}` : ""}`,
    schema: obj({ stories: arr(storyItem, 5, 5) }),
    maxTokens: 7000,
    thinking: 512,
    temperature: 0.85,
  };
}

/* ------------------------------------------------------------------ TASK: problem-to-CTA */
const problemItem = obj({
  id: int(),
  funnel: str("TOFU, MOFU, or BOFU"),
  focus: str("distinct editorial focus for this post"),
  emotion: str("main emotion, Malay, 2-4 words"),
  emotionTechnique: str("name of the emotional technique used"),
  context: str("Malaysian setting used"),
  hook: str("8-22 words"),
  problem: str("20-40 words"),
  agitation: str("20-40 words"),
  solution: str("20-35 words"),
  benefit: str("20-40 words"),
  proof: str("12-30 words"),
  cta: str("12-30 words"),
  visualDetail: str("one visible or user-supplied product detail used"),
  hashtags: arr(str(), 4, 6),
});

export function buildProblem(f, intel, feedback) {
  const slotContexts = ["pagi awal: persediaan atau rutin sebelum hari bermula", "rehat menjelang tengah hari: tip mudah dan perhatian ringkas", "waktu makan tengah hari: semakan praktikal yang boleh dibaca santai", "petang: masalah berulang atau pertimbangan selepas urusan harian", "awal malam: rutin rumah/keluarga jika relevan dengan produk", "malam: penceritaan lebih mendalam dan pertimbangan pembelian"];
  const plan = PROBLEM_SLOTS.map((t, i) => `#${i + 1} | ${t} | time context: ${slotContexts[i]} | emotion: ${PROBLEM_EMOTIONS[i].emotion} | technique: ${PROBLEM_EMOTIONS[i].technique}`).join("\n");
  const postArchetypes = [
    { id: 1, angle: 'Dilema pilihan/padanan', purpose: 'bantu pembeli memilih antara pilihan yang benar-benar tersedia', proof: 'pemerhatian visual atau pilihan variasi yang disahkan' },
    { id: 2, angle: 'Pertimbangan bajet', purpose: 'bantu pembeli menilai harga secara neutral tanpa mendakwa murah/berbaloi tanpa bukti', proof: 'harga tepat jika dibekalkan, atau arahan menyemak harga/variasi' },
    { id: 3, angle: 'Keputusan saat akhir', purpose: 'ringkaskan perkara yang patut diperiksa sebelum membuat keputusan; jangan cipta urgensi atau stok terhad', proof: 'checklist pembeli atau butiran listing yang boleh diperiksa' },
    { id: 4, angle: 'Pemerhatian produk', purpose: 'fokus pada rupa/ciri yang jelas kelihatan sahaja', proof: 'butiran visual yang benar-benar nampak; jangan simpulkan fungsi atau kualiti' },
    { id: 5, angle: 'Persona/penerima berbeza', purpose: 'gunakan perspektif pembeli/penerima lain jika relevan; jika tidak, pilih keperluan pembeli lain yang masuk akal', proof: 'fakta produk yang sesuai dengan keperluan itu atau soalan semakan' },
    { id: 6, angle: 'Perbandingan cara guna/gaya/keputusan', purpose: 'tunjukkan satu pertimbangan atau cara menilai produk yang berbeza daripada post lain', proof: 'perbandingan yang disokong input, atau ajakan pembeli menyemak sendiri' }
  ];
  return {
    system: CORE,
    text: `TASK: Write exactly SIX ready-to-publish affiliate posts. Each post is one complete, coherent mini-story with the seven sales functions below woven together naturally. The reader must NOT see section headings, numbered frameworks, or a checklist. The app joins the seven fields in order, so write each field as the next sentence/paragraph of the same story, with natural transitions and no repeated setup.

${describeFields(f)}

${intelBlock(intel)}

THE SEVEN STORY BEATS (return each in its own field, in this exact order):
1. hook (12-20 words): a specific, believable micro-moment or sharp observation that earns attention. Do not use "Pernah tak korang…", "Bila tengok…", "Kadang-kadang kita…", or generic question openers. Start all six posts differently.
2. problem (30-45 words): explain one concrete buyer tension or decision difficulty in natural spoken Malay. Do not restate the hook.
3. agitation (30-45 words): show the small emotional or practical consequence. Keep it relatable, not dramatic, shame-based, fear-based, or medically framed.
4. solution (25-35 words): introduce the product as one option to consider, not a miracle and not as something the narrator has personally used.
5. benefit (30-45 words): explain a useful decision-making benefit based only on supplied facts or visible details. A product's colour, bottle or label is not proof that it works. Do not repeat the same packaging description already used in another beat.
6. proof (20-30 words): use only verifiable evidence: a clearly supplied specification, readable label detail, supplied price, or an honest limitation/check. If there is no real efficacy evidence, say what the buyer can verify; never imply a label proves results. No fabricated testimonials, ratings, sales numbers or before/after results.
7. cta (15-25 words): one clear, low-pressure action. Vary the action across six posts. Do not paste the URL or hashtags into the fields.

LENGTH AND FLOW
- Aim for 200-300 words per finished post after the seven fields are joined. If a creator nickname was supplied, include it naturally at least once in the final joined post, but avoid repeating it unnaturally: Each post must have enough narrative depth to develop the problem, insight and buying consideration; do not pad with filler or repeat ideas.
- Make the seven beats feel like ONE story: each beat adds new information and follows from the previous sentence. No abrupt jump from emotion to a product description, no repeated summaries, no filler sentences.
- Use 3-5 short/medium paragraphs in the final joined text where the app supports paragraph breaks. Use conversational Bahasa Melayu Malaysia, not formal brochure language or awkward literal translations.
- Use concrete details sparingly: at most ONE small scene detail and ONE product-detail mention per post unless a second detail is essential to the buying decision. Do not spend the whole post describing the bottle.
- Do not invent a real person, personal experience, event, testimonial, skin reaction, or product result. If using a scenario, clearly frame it as a general/hypothetical situation.
- For skincare, never diagnose skin, induce insecurity, or claim the product improves skin, removes spots, restores freshness or produces results unless that exact claim is explicitly supplied. Avoid unsupported benefit verbs such as “memudahkan”, “menjadikan lebih selesa”, “menjimatkan”, “praktikal”, or “sesuai” when describing product performance; replace them with visible observations or a buyer-check instruction such as “Rujuk spesifikasi dan ulasan pembeli di listing.” Prefer helping readers check label, ingredients (only if supplied), suitability notes (only if supplied), price/variation, and listing details.

EMOTION PLAN — one different technique per post:
${plan}

SIX-POST ARCHETYPE MATRIX — ASSIGN EXACTLY ONE DISTINCT ARCHETYPE TO EACH POST:
${postArchetypes.map(a => `Post ${a.id}: ${a.angle} | purpose: ${a.purpose} | proof angle: ${a.proof}`).join("\n")}
- Treat these as distinct editorial roles, not mandatory physical locations. Adapt to the actual product and buyer; never force a gifting, outfit, workplace or family scenario if it does not fit.
- Do not reuse the same core pain point AND setting in more than one post. Across the six posts vary problem, persona/setting, solution mechanism, proof angle and CTA action. Each post must add a different decision insight.
- A different emotion, time slot, opening sentence or CTA alone does NOT make a post unique.
- If product facts are limited, vary buyer questions and useful verification steps; do not invent product benefits to fill an archetype.

CONTENT AND FUNNEL MIX
- Assign a funnel and a distinct focus to every post in the structured metadata: Post 1 TOFU relatable routine/problem; Post 2 TOFU awareness/tip; Post 3 MOFU verified product detail and buying check; Post 4 MOFU problem-solution story; Post 5 MOFU comparison/consideration; Post 6 BOFU decision support and calm listing CTA. Do not print funnel labels in the public post.
- The six posts must have different central ideas, emotional movement, opening syntax, sentence rhythm, product entry point, and CTA action. Vary the idea, not by forcing six unrelated locations.
- Keep one plausible context for the product and audience. Reuse a fitting home/vanity/daily-routine context when appropriate; never force travel, workplace, family, college, surau, or other locations merely to create variety.
- Use the assigned publishing slot as a context cue: ${PROBLEM_SLOTS.map((t,i)=>`${t} (${slotContexts[i]})`).join(", ")}. Match the content angle and reader situation to that time when relevant, but do not falsely narrate that a real event happened at that time or print the time/number inside the post. Treat timing as a hypothesis to test, not a performance guarantee.
- Hashtags must fit the actual product and buyer intent; do not use generic or misleading tags just to fill the list.
- Treat price/specification/size/volume/colour count as facts only when supplied by the user or clearly visible and legible in references. A URL slug alone is not verification. If facts conflict or are uncertain, omit the number and invite the reader to check the exact listing variation.
- SIX-POST DIVERSITY CHECK: Before returning the six posts, compare their core problem, agitation, solution, proof, opening scene and CTA. Treat QA warnings as real rewrite requirements, not optional suggestions. Each post must have a meaningfully different buyer question or decision angle; changing only emotion, location wording or CTA is not enough.
- Do not repeat the same setting/context metadata in more than two posts unless the product genuinely requires it. Do not repeat a price in more than two posts; reserve it for posts where price directly supports a buying decision.
- FACT DISCIPLINE: Do not write “berdasarkan maklumat kedai rasmi”, “menurut penjual”, “terbukti”, or similar source claims unless that source text was actually supplied and checked. A product photo can support only visible appearance (e.g. colour/pattern), not comfort, fit, fabric quality, durability or performance.
- When no verified proof exists, make the proof beat a transparent buyer-check (e.g. ask the reader to inspect size, material, variation, return terms or listing details only if those details are available), not a fabricated claim. Price alone does not prove that a product is cheap, affordable or good value.
- Do not assert comfort, fit, durability, ease of matching, time saved, suitability for beginners, fabric feel/length, noise level, effectiveness, or value-for-money as product facts unless explicitly supported by supplied specifications or clearly verifiable reference details. Avoid presenting imagined problems (e.g. a loose tie, slippery/rough fabric, colour mismatch) as problems this product solves. Phrase uncertain points as buyer checks, not benefits.
- QA-sensitive claims must remain grounded: a visible colour/pattern proves only its visible appearance, not comfort, quality, durability or performance. Price alone does not prove that an item is cheap, affordable, worth it or good value.
- Set id 1-6 in order and include the appropriate funnel and distinct focus metadata. Do not write the URL or hashtags inside any field.
${feedback ? `\n\nYOUR PREVIOUS ATTEMPT FAILED THESE CHECKS. Rewrite and fix every issue:\n${feedback}` : ""}`,
    schema: obj({ problemPosts: arr(problemItem, 6, 6) }),
    maxTokens: 9000,
    thinking: 512,
    temperature: 0.72,
  };
}

/* ------------------------------------------------------------------ TASK: video recommendation + one two-clip video */
const clipObj = obj({ slashStack: arr(str("e.g. /ugcHandheld"), 2, 5), prompt: str("labelled prompt body, max 1900 characters") });
const videoItem = obj({
  id: int(), title: str("short Malay title"), concept: str("one Malay sentence: hook through CTA across 16 seconds"),
  endFrameA: str("English, max 25 words: exactly how Clip A's final frame looks"), clipA: clipObj, clipB: clipObj,
});
const recommendationSchema = obj({
  title: str("short Malay concept title"), concept: str("distinctive, product-specific video concept"), rationale: str("why the concept is relevant and creatively differentiated"),
  clipASlash: arr(str("slash command"), 2, 5), clipBSlash: arr(str("slash command"), 2, 5),
});
export function buildRecommendation(f, intel) {
  return {
    system: `${CORE}

You are an AI Creative Director for Malaysian affiliate product videos. Recommend six distinctive, practical video concepts from the supplied product image(s) and facts. Each concept must have a different hook, visual approach and story angle. Do not claim a concept is trending now unless current trend evidence is supplied. Avoid generic unboxing/rotation/hero-shot clichés unless unusually justified. Preserve product identity; do not infer unverified product performance. Slash commands must be meaningful visual shorthand and each must be explained by the later video prompt.`,
    text: `Recommend SIX distinctly different video concepts for this product. Each becomes two connected 8-second clips (16 seconds per idea): Clip A covers Hook + relatable tension/curiosity; Clip B continues into product presentation/value and CTA. Be surprising but physically plausible and suitable for the product.

${describeFields(f)}
${intelBlock(intel)}
Requested style: ${f.videoStyle || 'Natural UGC'}; scene type: ${f.sceneType || 'Product Demo'}; background: ${f.background || 'Modern Malaysian home'}.
Return 2-5 slash commands for Clip A and 2-5 for Clip B. Prefer a differentiated combination of camera, lighting, reveal and storytelling; avoid changing the product itself.`,
    schema: recommendationSchema, maxTokens: 1800, thinking: 256, temperature: 0.85,
  };
}
export function buildVideo(f, intel, hasCharacter, feedback, recommendations) {
  const rec = recommendations && typeof recommendations === 'object' ? recommendations : {};
  const suggestedA = Array.isArray(rec.clipASlash) ? rec.clipASlash : [];
  const suggestedB = Array.isArray(rec.clipBSlash) ? rec.clipBSlash : [];
  const recManual = Array.isArray(rec.manualSlash) ? rec.manualSlash.filter(x => /^\/[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 12) : [];
  const manual = recManual.length ? recManual : (f.manualSlash || []);
  return {
    system: `${CORE}

VIDEO PROMPT SPECIALIST MODE — SIX IDEAS, TWELVE COMPLETE CLIPS
Create exactly SIX video concepts for the uploaded product. Output six video items, each with clipA and clipB. Each clip is exactly 8 seconds, vertical 9:16, copy-ready for Google Flow/Veo. Across the two clips the story must progress from Hook to CTA. Completeness is more important than decorative wording: never return a skeleton, empty label, heading-only section, or unfinished sentence.
SLASH COMMANDS: each clip gets 2-5 slashStack commands; commands are printed before the prompt body and must not be repeated in the body. Explain them as natural-language visual instructions. Use user-selected commands when supplied and compatible; otherwise use recommended stacks. Do not pretend slash syntax is a native Veo feature; it is an AffiliFlow shorthand expanded into the prompt.
REQUIRED PROMPT LABELS IN EVERY SINGLE CLIP, EACH WITH SPECIFIC NON-EMPTY CONTENT (not just a heading): REFERENCE; OPENING SHOT AND STORY; PRODUCT IDENTITY LOCK; ACTION AND BLOCKING; CAMERA PLAN; LIGHTING AND ART DIRECTION; COMPOSITION AND END FRAME; AUDIO; NEGATIVE CONSTRAINTS. If a label is present, write at least one concrete sentence after its colon. Never leave "OPENING SHOT AND STORY:" or any other label blank. Do not put all instructions in REFERENCE and leave other sections empty.
Clip A: hook in first 1-2 seconds, establish a specific relatable/curiosity moment, introduce the product naturally, and finish on a precise stable frame. Clip B: start with the exact final frame of Clip A, continue the action, present only verified/visible product details, then close with a gentle CTA. CTA can be a short spoken line only when natural; otherwise end on a clear product-presenting action with negative space for CTA added in editing. Do not render text overlays.
PRODUCT IDENTITY LOCK: use uploaded reference image(s) as source of truth; preserve visible shape, colour, parts, logos, label and proportions. Never invent specs or effects. ${hasCharacter ? 'Use uploaded character reference consistently across both clips.' : 'If a person is needed, use the same realistic Malaysian adult, wardrobe and location across both clips.'}
Continuity is mandatory: Clip B's first sentence must be exactly: Continue directly from Clip A's final frame: <endFrameA>. Do not change camera viewpoint, product position, pose, background or light at the cut. Clip B must then advance the story, not repeat Clip A.
Each prompt body should target 1050-1450 characters and remain under 1850 characters; final prompt including slash stack under 2500. Keep each required section concise but specific: action must be timed across 0–2s, 2–5s and 5–8s; camera must state angle and movement; lighting must state source and mood; composition must describe the final frame; audio must specify ambience/dialogue/music; negative constraints must protect product identity. No subtitles, floating text, watermarks, invented brand marks, fake claims, product deformation, colour changes, malformed hands, flicker or impossible motion. ${String(feedback || '')}`,
    text: `TASK: Create exactly SIX distinct video concepts, each with two connected 8-second clips. Full story arc: Hook → problem/curiosity → product/value → CTA.

${describeFields(f)}
${intelBlock(intel)}
Concept recommendation: ${rec.title || 'Use the strongest product-specific creative idea'} — ${rec.concept || ''}
Creative rationale: ${rec.rationale || ''}
Clip A recommended slash commands: ${(suggestedA).join(' ') || '(choose automatically)'}
Clip B recommended slash commands: ${(suggestedB).join(' ') || '(choose automatically)'}
User-selected slash commands (prioritise if relevant): ${manual.join(' ') || '(none)'}
Style: ${f.videoStyle || 'Natural UGC'}; scene type: ${f.sceneType || 'Product Demo'}; background: ${f.background || 'Modern Malaysian home'}.
Background cleanup: ${f.removeBgText ? 'remove promotional text in background; ' : ''}${f.removeBgGraphics ? 'remove background graphics; ' : ''}${f.protectProductText ? 'preserve product-embedded text/logo/design exactly' : ''}
Return schema fields: videos with exactly six items, ids 1–6, each with a distinct title in Malay, concept in Malay, endFrameA, clipA {slashStack,prompt}, clipB {slashStack,prompt}. Before returning, internally verify all nine required labels have meaningful non-empty text in all 12 prompts. Clip A hook and curiosity; Clip B continuation, grounded value and CTA. For Clip B, after the continuity sentence, fill every required section with new action that advances the story; never stop at "OPENING SHOT AND STORY:".`,
    schema: obj({ videos: arr(videoItem, 6, 6) }), maxTokens: 8500, thinking: 256, temperature: 0.68,
  };
}

export function buildTask(task, p) {
  switch (task) {
    case "intel": return buildIntel(p.fields);
    case "story": return buildStory(p.fields, p.intel, p.half, p.feedback);
    case "problem": return buildProblem(p.fields, p.intel, p.feedback);
    case "recommend": return buildRecommendation(p.fields, p.intel);
    case "video": return buildVideo(p.fields, p.intel, p.hasCharacter, p.feedback, p.recommendations);
    default: return null;
  }
}
