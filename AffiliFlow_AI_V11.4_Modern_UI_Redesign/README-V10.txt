AffiliFlow AI V10 — Netlify-ready

WHAT CHANGED (independent-tab build)
- Product details, affiliate URL and 1–5 product reference images are entered once in the product form.
- Tab 1, Tab 2 and Tab 3 are generated independently. Switching tabs never starts an AI request and does not erase other tab outputs.
- The first main-form action generates Tab 1 only: 10 short Story Content posts, full Facebook version plus short Threads/X version, with time-of-day context cues.
- Tab 2 generates six complete Problem → CTA posts only when requested. The six posts have different editorial roles across TOFU/MOFU/BOFU, use time-of-day as a creative cue, target 200–300 words, and retain seven internal story beats without visible headings.
- Tab 3 first offers a separate “Cadangkan konsep & /” action. This analyses the product and recommends one differentiated concept plus slash stacks for Clip A and Clip B. It does not generate video prompts.
- After reviewing the recommendation, the user clicks “Jana Tab 3” to generate exactly one video concept with two connected prompts: Clip A (8 seconds, Hook/curiosity) and Clip B (8 seconds, product/value through CTA). Each prompt includes product identity lock, camera, lighting, audio, continuity and negative constraints.
- Users can accept the recommended slash stacks or add/select alternative slash commands in the Slash Prompt Shortcuts field before generating. Slash syntax is an AffiliFlow shorthand expanded into natural-language directions, not a claim that it is a native Veo command.
- Trend freshness is not asserted without current trend evidence; concepts prioritize distinctiveness and product relevance, and must not fabricate product facts.
- Added a final-priority mobile header fix so the title, donation button/text and Reset control wrap within narrow phone widths.
- Preserved Netlify Functions, Gemini server-side API usage, access-code support, AdSense metadata/public pages, session persistence, Copy buttons and JSON export.

VALIDATION
- JavaScript syntax checks pass for app.js, netlify/functions/ai.js and netlify/functions/prompts.js.
- `npm test` validator suite passes.
- Backend prompt-builder smoke test passes for intel, story, problem, recommend and video tasks; video schema is constrained to one concept with two clips.
- Browser E2E could not run because Playwright is not installed in this environment. Live Gemini generation has not been executed here; test through Netlify Deploy Preview before production.

DEPLOY TO NETLIFY
1. Push this folder to GitHub and link it in Netlify (or use the Netlify CLI). Build command: none. Publish directory: .
2. Site configuration -> Environment variables:
     GEMINI_API_KEY     (required)
     GEMINI_MODEL       (optional, default gemini-2.5-flash)
     GEMINI_FALLBACK_MODEL (optional, default gemini-3.5-flash-lite)
     APP_ACCESS_CODE    (optional but recommended for a public site: users are asked for this code once)
3. Redeploy after adding variables. Test on a Deploy Preview first.
Note: use Git-based deploy or `netlify deploy --prod` (Netlify CLI) so the function is built; plain drag-and-drop of a folder may skip functions.
      Netlify synchronous functions stop at ~60s; each V10 call is sized to finish well inside that.

LOCAL
  GEMINI_API_KEY=xxxx npm start        -> http://localhost:3000
  npm test                              -> validator tests (no key)
  NODE_PATH=<playwright> npm run test:e2e   -> full UI test against a fake Gemini (no key)

Video prompt quality update (V10):
- Clip B opening is anchored to Clip A's exact endFrameA description.
- Server-side cleanup repairs common section-label typos and restores the continuity anchor when missing.
- Prompt instructions emphasize plausible physical continuity, stable product identity, and no unsupported product details.
- Prompt bodies target <=1900 characters; copied prompts including slash commands target <2500 characters.
