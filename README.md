# Veritas — Content Authenticity Checker

An evidence-first tool that checks whether an image or a passage of text
shows signs of AI generation or manipulation, and shows *why* — not just a
score.

Built as a weekend MVP, structured to grow into a full product.

## Why this project (and not another AI wrapper)

Most student AI projects are a thin UI over a single API call. Veritas
deliberately does the opposite: every check runs locally with real,
explainable logic (no third-party "detector" API, no black box), which is
the harder and more defensible thing to talk about in an interview.

- **Image forensics**: re-compresses the image at a known JPEG quality and
  diffs it against the original (Error Level Analysis), then measures how
  *uniform* the error is across an 8×8 grid. A flat error level across the
  whole frame is a known trait of fully synthetic images.
- **Metadata forensics**: parses EXIF/XMP/IPTC for camera identity, capture
  timestamps, and known AI-generator signatures (Midjourney, DALL·E, Stable
  Diffusion, Firefly, C2PA credentials, etc.).
- **Text stylometry**: measures sentence-length "burstiness," vocabulary
  variety (type-token ratio), and density of stock LLM phrasing — the same
  category of signal a human editor would use, made explicit and
  measurable.
- Every result ships as a **breakdown of individual signals** (clear /
  caution / flagged), not just a single number — this is the part worth
  demoing.

## What's new: power-up features

Beyond the weekend-MVP core, the project now includes:

- **Weighted signal-fusion scoring engine** (`lib/scoreEngine.js`) — instead
  of ad-hoc point deductions, every signal carries a weight (how much it
  should move the needle) and the engine combines them into a score *and*
  an explicit **confidence level** (low/medium/high) based on how much
  evidence agrees, plus a plain-language summary of the strongest finding.
- **C2PA / content-provenance manifest detection** — scans the container
  for JUMBF/C2PA structures (the standard Adobe, Leica, and the Content
  Authenticity Initiative use for signed edit history). This is a
  *presence* check, not cryptographic verification of the signing chain —
  said plainly in the signal detail, because overclaiming this is the
  fastest way to lose credibility with a technical interviewer.
- **Perceptual hashing (pHash)** — every image gets a stable 64-bit
  fingerprint that survives recompression. Not used for scoring yet (no
  reference database in this MVP), but it's the foundation for a future
  "this exact image has been checked before" or known-fake index feature.
- **PDF evidence report export** (`lib/generateReport.js`, via `jspdf`) —
  one click turns a result into a shareable, printable report: score,
  confidence, summary, every signal with its verdict, and the fingerprint.
  Runs entirely client-side.
- **Browser extension companion** (`extension/`) — right-click any image
  on any webpage → "Check with Veritas" → a notification with the score,
  full detail in the extension popup. Talks to your deployed instance
  (configurable API URL in the extension's options page). This is the
  single most demo-able addition: checking a random image on Twitter/X in
  two clicks reads very differently in an interview than a localhost form.
- **CORS-enabled API** so the extension (running from a
  `chrome-extension://` origin) can call the same endpoints the web app
  uses — no separate backend needed.

## Requirements this version is designed against

- **Explainability over black-box scoring** — every number on screen must
  trace back to a named, human-readable signal. No signal may silently
  affect the score.
- **Local-first** — no signal in the current build requires an external
  API key or sends content to a third party; everything runs in the
  Node process that already has the file.
- **Graceful degradation** — a failed or inconclusive individual check
  (e.g. corrupt EXIF) should not crash the whole analysis; it should
  either be omitted or reported as low-confidence.
- **Cross-surface reuse** — the same `/api/analyze-image` and
  `/api/analyze-text` endpoints serve the web app *and* the browser
  extension; forensic logic is never duplicated.
- **Size/type limits enforced server-side** (15MB images, 20k-character
  text) regardless of what the client claims about the file.

## Round two: video, visual evidence, and hardening

- **Video authenticity mode — no server-side ffmpeg required.** Sampling
  happens entirely in the browser: an off-screen `<video>` element seeks
  to 5 evenly spaced timestamps, each frame is grabbed onto a `<canvas>`,
  and every frame is run through the *same* `/api/analyze-image`
  pipeline already built for stills. A **temporal-consistency** signal
  then flags videos where some frames score meaningfully worse than
  others — the pattern you'd expect when only part of a clip (e.g. a
  swapped face) was regenerated rather than the whole thing.
- **Visual ELA heatmap.** The 8×8 error-level grid the analyzer already
  computed is now returned to the client and rendered as a translucent
  overlay directly on the uploaded image — so "unusually uniform
  compression error" stops being a sentence and becomes something a
  recruiter can literally see change color across the frame.
- **API rate limiting.** Both endpoints now enforce a per-IP request cap
  (in-memory token-bucket style) and return `429` with `Retry-After`
  when exceeded. Documented limitation: this is single-instance only —
  a real multi-server deployment needs a shared store (Redis/Upstash)
  instead, which is exactly the kind of tradeoff worth naming out loud
  in an interview rather than glossing over.

## Tech stack

- Next.js 14 (App Router), React 18
- `sharp` for image decoding/re-encoding, `exifr` for metadata parsing
- Tailwind CSS
- No database, no external AI API — everything runs server-side in Node

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Upload a JPEG/PNG, or switch to the Text tab and
paste a passage (a sample AI-style passage is one click away).

## Project structure

```
app/
  api/analyze-image/route.js   → image analysis endpoint (CORS-enabled)
  api/analyze-text/route.js    → text analysis endpoint
  page.js                      → landing + upload UI
lib/
  imageForensics.js            → ELA (+ heatmap grid) + metadata + C2PA + pHash
  textForensics.js             → stylometric heuristics
  videoForensics.js             → browser-side frame sampling + temporal consistency
  scoreEngine.js                → shared weighted signal-fusion + confidence
  generateReport.js             → client-side PDF evidence report
  rateLimit.js                  → per-IP request cap for both API routes
components/
  UploadPanel.js                → Image/Video/Text tabs, API calls, report button
  ElaHeatmap.js                  → canvas overlay visualizing the ELA grid
  ScoreDial.js                  → SVG trust-score gauge + confidence badge
  EvidenceList.js                → signal breakdown cards
extension/
  manifest.json, background.js  → right-click "Check with Veritas" on any image
  popup.html/js, options.html/js → result viewer + API URL configuration
```

### Loading the browser extension (unpacked, for demos)

1. `chrome://extensions` → enable Developer Mode → "Load unpacked" → select
   the `extension/` folder.
2. Open the extension's options page and set the API URL to your deployed
   Veritas instance (or `http://localhost:3000` while `npm run dev` is
   running).
3. Right-click any image on any website → "Check with Veritas".

## Honest limitations (know these before an interview asks)

- These are **heuristic signals, not forensic proof**. Each one is
  individually beatable (metadata can be stripped or faked; ELA can be
  fooled by re-saving through multiple lossy passes; stylometry drifts by
  writer and language). The product is designed around *combining* several
  weak signals with a transparent breakdown, not claiming a single
  infallible verdict — say this explicitly if asked.
- Text stylometry was tuned on English prose; it will misfire on code,
  poetry, or non-English text.
- ELA works on JPEG-based compression artifacts; it's a weaker signal on
  images that started as PNG/lossless.

## Roadmap (if you want to take it further)

1. Reverse-image-search lookup (via a search API) as an additional signal.
2. On-device text perplexity using a small model via WebGPU/WASM
   (transformers.js) so the text check runs with zero server round-trip —
   noted as a roadmap item rather than shipped here, since it depends on
   downloading model weights at runtime and deserves real testing with a
   live connection before it ships as a claimed feature.
3. Real C2PA cryptographic verification against the official trust list,
   not just manifest-presence detection.
4. Native (server-side, ffmpeg-based) video decoding for formats/duration
   the browser's `<video>` element can't seek reliably.
5. Batch mode + a history dashboard using the pHash fingerprint to detect
   "you've checked this exact image before" (would need a database —
   Supabase or Postgres).
6. Swap the in-memory rate limiter for Redis/Upstash before any real
   public traffic.

## How to talk about this on a resume / interview

Suggested resume bullet:

> Built Veritas, a full-stack content-authenticity checker (Next.js,
> `sharp`, `exifr`) that combines Error Level Analysis, EXIF/XMP forensics,
> and text stylometry into a transparent, signal-by-signal trust report —
> no third-party detection API.

Be ready to explain: what Error Level Analysis actually measures and why a
uniform error level is suspicious; why the tool reports multiple weak
signals instead of one score; and what would break each individual check
(this shows judgment, not just implementation).
