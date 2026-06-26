# FARROWAY OS 1.0 — Engineering Review & Next-Sprint Backlog

Six-lens review (CTO · Chief Agronomist · Staff Security · Senior PM · SRE Lead · UX
Researcher) of the deployed platform. Every finding is grounded in real code
(file:line). Ranked by **Impact × Likelihood ÷ Effort**. No new features — only
fixes that measurably improve reliability, performance, security, clarity, scale,
recommendation quality, and accessibility. Speculative complexity is explicitly
rejected at the end.

Scoring key — Impact/Likelihood/Effort each H/M/L.

---

## P0 — Do this sprint (high impact, cheap, likely)

### 1. [SECURITY] Six admin/scan routes have auth but NO role check
**Impact H · Likelihood H · Effort L (~20 min)** — *Staff Security*
`server/src/app.js` lines **792, 876, 892, 922, 935, 2005** (`/api/admin/scan/certify`,
`/reliability`, `/scan-credits`, `/scan-observability`, `/scan-observability/export.csv`,
`/scan/trace/:scanId`) are gated by `authenticate` only. Any authenticated **farmer**
can read provider reliability/credits, **export the full per-scan observability CSV**
(data exposure), pull scan traces, and **trigger a production certification that makes
real provider calls (burns credits)**. The `/scan-validation/*` routes (2352+) already
do this correctly via `_requireAdmin(req,res)` (defined at line 2344).
**Fix:** add `if (!_requireAdmin(req, res)) return;` as the first line of each of the 6
handlers. **Measure:** the 6 routes return 403 to a non-admin token; add one auth test.

### 2. [A11Y] Touch targets + contrast on the core scan/nav surfaces
**Impact H · Likelihood H · Effort L** — *UX Researcher / Chief Agronomist*
Farmer-critical controls are below the 44px minimum and below 4.5:1 contrast — fatal
for thick fingers in bright sun. Concrete offenders:
- `src/components/scan/ScanResultCard.jsx` confidence pills/buttons `padding:'3px 8px'`
  (~28–36px) and `metaLabel color rgba(255,255,255,0.55)`.
- `src/components/language/LanguageSwitcher.jsx:164` trigger `minHeight:36`, icon-only
  in compact mode → farmer can't switch out of the wrong language.
- `src/components/farmer/BottomTabNav.jsx:446` inactive label `rgba(234,242,255,0.55)`
  (~3:1) → invisible nav in sunlight.
**Fix:** bump interactive targets to `minHeight:44` + ≥0.85 opacity / darker tokens.
**Measure:** axe-core / Lighthouse a11y score on Home + Scan; every tap target ≥44px.

### 3. [RELIABILITY] Parallelize + defer the 204-import boot block
**Impact H · Likelihood H · Effort M** — *CTO / SRE*
`src/App.jsx` awaits **204 dynamic `import()` calls** in the boot effect, mostly
**serially** inside individual try/catch (confirmed: 204 `await import`; only ~4
`Promise.all` groups). On a cold cache / slow Android this keeps the JS thread busy and
delays time-to-interactive (the worst-case "tens of seconds" some tooling estimates is
overstated because Vite bundles these into far fewer chunks — but the serial main-thread
cost and delayed interactivity are real). Most installs are non-critical health probes.
**Fix:** (a) batch the early installs into a few `Promise.all` groups; (b) move all
`__*Health` installs (v7→v15, farmos*) into a `requestIdleCallback`/post-first-paint
effect; (c) keep only migrations + auth + core runtime on the critical path.
**Measure:** Lighthouse TTI on a throttled "Slow 4G / low-end" profile, before/after.

---

## P1 — Should do this sprint

### 4. [RELIABILITY] Swallowed-error telemetry (392 silent catches)
**Impact M-H · Likelihood H · Effort L-M** — *SRE*
~392 `catch {}` / `_safe` swallows across `src/runtime` + the boot block. Swallowing is
correct for boot resilience, but **nothing counts what failed** — in a live pilot a
broken health install or runtime is invisible. **Fix:** route swallowed boot/runtime
errors through a single counter exposed as `window.__bootErrors()` (module + message,
no PII). **Measure:** a non-zero `__bootErrors()` surfaces a regression the gates can't.

### 5. [A11Y/RELIABILITY] Scan "analyzing" needs aria-live + a duplicate-tap guard
**Impact M-H · Likelihood H (on 3G) · Effort L** — *UX / SRE*
`src/components/scan/ScanAnalyzing.jsx` shows a spinner with no `role="status"
aria-live`; on slow networks the farmer assumes a freeze and **taps capture again →
duplicate scan → burns a provider credit**. **Fix:** add an `aria-live="polite"` status
region and disable the capture/submit button while a scan is in flight.
**Measure:** no duplicate scan rows for one capture under throttled network; SR announces
progress.

### 6. [SCALABILITY] Retention + time-window indexes on high-write tables
**Impact M · Likelihood M (slow burn) · Effort M** — *SRE / CTO*
Unbounded append tables (`ScanProviderMetric`, `AnalyticsEvent`, `V2AnalyticsEvent`,
`EventLog`, `AuditLog`, `FarmerActionLog`) grow per-scan/per-event with no pruning.
`getReliabilityScorecard()` filters `ScanProviderMetric` by `createdAt >= cutoff` — verify
a `@@index([createdAt])` (or `([provider, createdAt])`) exists so it doesn't full-scan as
rows accumulate. **Fix:** add the composite index + a scheduled prune (e.g. keep raw
metrics 90d, roll up older to daily aggregates). **Measure:** `EXPLAIN` uses the index;
row count bounded by the retention job.

### 7. [SECURITY] Tighten the scan body limit
**Impact M · Likelihood L · Effort L** — *Staff Security*
`express.json({ limit: '2mb' })` is fine for JSON, but base64 images can reach the
preprocess cap (~10MB) and are buffered before `preprocessImage` validates. **Fix:** add
a dedicated tighter limit (e.g. 6MB) on the scan route, or reject oversize bodies before
parse. (Image validation itself — magic-byte sniff, SSRF guard, fetch timeout — is
already solid; this is just the pre-parse buffer.) **Measure:** oversize body → 413 at
the parser, not after buffering.

---

## P2 — Backlog (real, but not pilot-blocking)

### 8. [RECO QUALITY] Make "unknown" legible to a low-literacy farmer
**Impact M · Likelihood M · Effort L-M** — *Chief Agronomist / UX*
The honesty doctrine is correct, but the farmer hits ~79 honest-null surfaces, and the
copy ("POSSIBLE ISSUE" 11px uppercase muted; "We're not confident enough.") reads as
jargon. **Fix (copy + icon, not logic):** replace with a plain phrase + icon ("Not sure —
check the leaf yourself 👀") at ≥13px/0.85 contrast. **Measure:** pilot comprehension;
no change to thresholds (`AGRI_CONFIDENCE_MIN=70` stays). *Do not weaken the honesty —
only its presentation.*

### 9. [QUALITY] Behavioral tests for the ~10 core engines
**Impact M · Likelihood M · Effort M-H** — *CTO*
15 `.test.ts` for ~600 runtime files. The build:safe gates verify **structure**, not
**behavior**, for most engines. **Fix:** add focused behavioral tests for the engines a
pilot actually exercises (classifier, FarmBrain ingestion gate, scan consensus, decision
engine, farm agent, copilot). **Measure:** behavioral test count on the core-10; a
deliberate logic bug fails a test, not just a gate.

### 10. [PERF] Memoize Home cards; virtualize scan history *only if* >30 items
**Impact L-M · Likelihood L · Effort M** — *CTO*
`src/pages/Home.jsx` renders heavy composites without `React.memo`; scan history isn't
virtualized. For a 10-farmer pilot the lists are short, so **virtualization is premature**
— gate it on real data. **Fix now:** memoize the 2–3 heaviest Home cards. **Defer:**
`react-window` until a farmer actually has 30+ history items. **Measure:** React Profiler
re-render count on Home.

---

## Rejected as speculative (not worth next-sprint effort)
- **OpenTelemetry / Prometheus / Grafana / Sentry stack** — real value at scale, zero
  measurable value for a 10-farmer pilot; the in-app `__*Health()` probes + reliability
  scorecard already cover what we need to watch. Revisit at 1k+ farmers.
- **Refactoring the farmos13/14/15 namespaces** — cosmetic; no user or reliability impact.
- **Virtualizing every list / aggressive code-split of the health chunk** — micro-wins
  dwarfed by #3; don't pre-optimize.
- **Building any "declared" capability** (market/financial/soil-lab/satellite) — needs a
  model/feed, out of scope by doctrine.
- **Distributed-tracing / load / chaos test harnesses** — infra programs, not a sprint
  item at current scale.

---

## One-line sprint plan
Land **#1 (security, 20 min)** and **#2 (a11y, ~half day)** immediately — both are cheap
and directly affect the pilot. Then **#3 (boot perf)** and **#5 (scan duplicate-tap)** as
the substantive reliability work. **#4/#6/#7** harden for the pilot's tail. Everything in
P2 waits for real pilot data to justify it.
