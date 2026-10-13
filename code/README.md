# SOLPOP

> Photovoltaic intelligence for humans who own panels and don't want to climb on the roof to check them.

Drop a photo of a solar panel. SOLPOP looks at it the way a 20-year inspector would, finds every crack, hotspot, smudge, and bird-mess, then writes you a report that tells you what's broken, how much money it's quietly costing you, and what to do about it, by Tuesday.

It works for one panel or twenty-four at once. It takes about a minute.

---

## The idea

Solar farms lose roughly 5 to 15% of their output every year to stuff that's visible from the ground: dust, micro-cracks, hotspots, leaves, the occasional pigeon. Diagnosing it usually means a thermal-imaging drone, a specialist, and a PDF that arrives a month later.

SOLPOP skips that.

A frontier vision model (Gemini) inspects each image against a 21-defect taxonomy, microcracks, snail-trails, PID, delamination, encapsulant yellowing, shading, soiling, the works, and emits structured JSON. A reasoning model (Llama 3.3 70B on Groq) then aggregates every finding into an executive O&M report: a fleet health score, severity heatmap, ranked risks, quantified energy loss in kWh/kW, and a 7/30/90-day action ladder.

The whole pipeline runs as a streaming API. You watch panels light up green one by one as their analysis lands, and the dashboard assembles itself live.

That's the whole product. Two models, in series, doing what one model can't.

---

## What it actually does

**Upload.** Drag a single photo or batch up to 24. JPEG, PNG, WebP, HEIC. Drone shots, ground shots, phone shots, anything where the cells are visible.

**Inspect.** Each image gets pushed through Gemini with a prompt that turns it into a senior PV inspector. Output is a strict JSON object: panel type guess, cell count, cleanliness score, condition score, defect list (each with severity, location, confidence, estimated efficiency loss, notes), immediate actions, image-quality grade.

**Synthesize.** Once every panel finishes, the array of inspection JSONs gets handed to Llama 3.3 with a different prompt, this one a principal O&M engineer. Output is a fleet-level report: health score weighted by per-panel condition, severity distribution, top risks with affected panel IDs, prioritized recommendations with expected impact, annual kWh/kW loss estimate, qualitative revenue-at-risk band, maintenance window, next inspection date.

**Drill down.** The dashboard renders as a bento grid. Click any panel card or any panel ID inside the risks list, a full-screen sheet flies in from the right with the deep dive: hero image, calibrated metrics, every defect as its own card, the inspector's narrative, every recommended action.

**Export.** One-click JSON export of the full report, per-panel JSON export from inside the sheet, and `window.print()` styled for a clean PDF.

---

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript** end-to-end with **Zod** validating every model response before it touches state
- **Tailwind v4** + a custom design system (industrial-brutalist meets editorial, Geist mono ticks, Instrument Serif display, warm-amber accent on near-black)
- **Framer Motion** for spring sheets, scroll-linked parallax (`useScroll` + `useSpring`), `whileInView` reveals, hover lifts, count-ups
- **Lenis** smooth-scroll for that Apple/Framer-site momentum
- **Gemini** (`@google/genai`) for vision, primary model from env, automatic fallback to `gemini-2.5-flash` → `gemini-2.0-flash` if the primary 404s
- **Groq SDK** for synthesis on `llama-3.3-70b-versatile`, JSON-mode forced
- **react-dropzone** for drag/drop/paste, **lucide-react** for icons

The route handler runs on Node and streams **NDJSON** events (`start`, `progress`, `panel`, `synthesizing`, `report`, `error`, `done`) so the UI can light up panels the instant each one finishes, no waiting for the slowest image.

---

## How it feels

- Drop 8 panels → first card flips to "Complete" in ~5s, all done in ~30s, exec report in another 5.
- Scroll is silky (Lenis-tuned, `lerp: 0.1`, `duration: 1.2`).
- Sheet opens as a spring (`stiffness: 220`, `damping: 32`). Esc closes.
- Numbers count up when they enter the viewport.
- The hero parallaxes against scroll progress through a `useSpring` lerp, so it tracks the wheel without the jitter of raw `scrollY`.
- Reduced-motion preference is respected; Lenis auto-disables and Framer falls back to instant transitions.

---

## File map

```
solpop/
├── app/
│   ├── layout.tsx          # fonts (Geist, Geist Mono, Instrument Serif), SmoothScroll mount
│   ├── page.tsx            # root composition: Header → Hero → HowItWorks → SolpopApp → Footer
│   ├── globals.css         # design system: tokens, severity palette, motion utils
│   └── api/
│       └── analyze/
│           └── route.ts    # POST /api/analyze, multipart in, NDJSON stream out
│
├── components/
│   ├── Header.tsx              # frosted blur ramp on scroll-y, anchor nav
│   ├── Hero.tsx                # scroll-linked parallax headline, count-up stat row
│   ├── HowItWorks.tsx          # 3-step explainer cards
│   ├── UploadZone.tsx          # drag/drop + paste, batch preview grid, queue header
│   ├── AnalysisCard.tsx        # per-panel result card (hover lift, click → sheet)
│   ├── PanelReportSheet.tsx    # right-side full report drill-down (spring entry)
│   ├── ReportDashboard.tsx     # bento exec dashboard: fleet score, severity, risks, recs, ledger
│   ├── SolpopApp.tsx          # client state machine: queue, streaming, sheet routing
│   ├── SmoothScroll.tsx        # Lenis instance + RAF + anchor-link hijack + ResizeObserver
│   ├── CountUp.tsx             # animated number on enter-view (framer animate)
│   └── Footer.tsx
│
├── lib/
│   ├── schema.ts           # Zod schemas for PanelAnalysis, SystemReport, FullAnalysis
│   ├── prompts.ts          # SOLPOP-VISION + SOLPOP-ANALYST system prompts
│   ├── gemini.ts           # vision client w/ JSON salvage + model fallback chain
│   ├── groq.ts             # synthesis client, JSON mode, schema-validated
│   └── utils.ts            # cn(), severity helpers, uid()
│
├── public/                 # next scaffold assets
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── .env.local              # NOT committed, keys live here
└── README.md
```

---

## Getting it running locally

```bash
git clone https://github.com/ShAuRyA-Noodle/Solpop.git
cd Solpop
npm install
```

Create `.env.local` in the project root:

```bash
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000`. Drag a solar panel image into the dropzone. Hit Analyze. Watch it work.

Get keys at:
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey

---

## What's next (the upgrades I'm building)

The current build is v1, vision inspection for stills. The roadmap is a lot bigger.

**1. Cell-level bounding boxes.** Use Gemini's grounding/spatial-understanding mode to draw boxes directly on each defect inside the image. Hover a defect chip in the sheet → that cell highlights on the photo. Inspectors live for this.

**2. Thermal IR + EL imagery support.** Auto-detect capture modality and switch the prompt accordingly. Hotspots in IR look different from hotspots in RGB; treating them the same wastes signal. Also: EL (electroluminescence) imaging unlocks micro-crack detection that's literally invisible in daylight photos.

**3. Time-series re-inspection diff.** Re-upload the same panel three months later → diff view shows new vs. healed defects, condition delta, hotspot creep. This is where O&M teams actually live: "is it getting worse?"

**4. Drone GPS metadata clustering.** EXIF lat/lon → automatic string/row reconstruction. Upload a folder from a drone flight, get back not just per-panel reports but heatmap overlays on a satellite view of the array.

**5. Persistent fleet history.** Right now every session is fresh. Add Supabase/Postgres + auth → asset owners get a persistent dashboard, inspection history, year-over-year trend lines on health score and energy loss.

**6. Webhook + Slack integration.** When a critical defect lands during a scheduled drone-flight upload, ping the O&M team in Slack with the panel ID, image, and recommended action.

**7. Multi-language reports.** Vision stays in English (the technical taxonomy is universal); synthesis prompt switches based on user locale. Spanish, Portuguese, Hindi, Mandarin priority, those are the markets where solar is exploding hardest.

**8. PDF export with proper layout.** Browser-print works, but `react-pdf` would let us ship a real branded report, cover page, exec summary, per-panel appendix, sign-off line for the inspector.

**9. Mobile capture flow.** Tap "inspect" on a phone → camera opens with a guide overlay (frame the panel like this), shutter, instant analysis, push to fleet history. Field-tech mode.

**10. Cost-of-replacement estimator.** Tie defect severity + panel type → ballpark $ to replace vs. clean vs. ignore. Asset owners think in dollars, not condition scores.

**11. White-label mode.** Solar installers want to hand SOLPOP to their customers under their own brand. Tenanted logo + color override + custom domain.

**12. Self-host vision.** When the volume justifies it, swap Gemini for a fine-tuned open vision model (LLaVA-Next, Idefics-3) on dedicated GPU, eliminates per-call cost and lets us train on PV-specific defect data we accumulate.

That's the long roadmap. v1 is the foundation: prove that a two-model pipeline with strict schemas can give an inspector-grade answer in under a minute. Everything above stacks on top of that.

---

## A note on accuracy

SOLPOP is decision-support, not a substitute for a licensed PV engineer. The model is good enough to triage, prioritize, and catch things humans miss in a quick visual sweep, but for warranty claims, replacement decisions, or anything safety-critical, the report should be reviewed by someone with a clipboard and a multimeter.

That's not a hedge. That's just where current vision models actually sit. The point of SOLPOP is to make the inspector's job 10× faster, not to replace them.

---

## Security

This is an anonymous demo surface that calls paid vision and reasoning models, so the routes are written defensively:

- Every model-calling API route enforces per-IP rate limiting (token bucket), an explicit body or file-size cap, and strict MIME validation. The image inspection route caps file count, file size, and decoded pixel count to blunt cost-drain and decompression-bomb abuse.
- No API keys ship to the client. Gemini and Groq keys are read from server-only env and never exposed via `NEXT_PUBLIC_`.
- Share links persist to a Drizzle-backed SQL row keyed by a sanitized random ID, not raw filesystem writes.
- CodeQL `security-extended` runs on every push, PR, and weekly. Dependabot weekly security and version updates keep dependencies advisory-clean, with `npm overrides` pinning transitive packages.

Found something? See [SECURITY.md](./SECURITY.md). Please do not open a public issue for vulnerabilities.

---

## License

MIT. Use it, fork it, ship it.


