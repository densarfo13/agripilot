# Farroway Intelligence Layer v1 — Output Report (§17)

**Scope:** production-safe agricultural decision-support, built **only**
from real, already-stored pilot data. Additive over the now-stable pilot
platform. Nothing here breaks scan, blocks upload/camera, fabricates
agronomy, auto-prescribes chemicals, claims certainty, adds marketplace
payments, adds a public investor dashboard, or removes existing fallbacks.

> Every farmer-facing output carries: **"Decision support, not a guarantee."**

---

## What shipped

### Engines (pure, read-only compositions — `src/runtime/intelligence/`)

| # | Engine | Global | Output contract |
|---|--------|--------|-----------------|
| 1 | CropMemoryEngine | `__cropMemoryHealth` | per-plant memory from scan history |
| 2 | TrendEngine | `__trendHealth` | improving/stable/worsening — **needs ≥ 2 scans**, never inferred from 1 |
| 3 | FarmHealthScoreEngine | `__farmHealthScoreHealth` | **0–100** + label Excellent/Good/Watch/Needs attention |
| 4 | WeatherRiskEngine (existing) | `__weatherRiskHealth` | weather-driven risk flags |
| 5 | YieldReadinessEngine | `__yieldReadinessHealth` | **LOW/MEDIUM/HIGH/UNKNOWN** readiness — *not* a yield/revenue forecast |
| 6 | DailyDecisionEngine | `__dailyDecisionHealth` | **max 3** grounded daily actions |
| 7 | NGO Impact (existing) | `__ngoImpactHealth` | org-scoped impact analytics |
| 8 | BuyerTrustEngine (existing) | `__buyerTrustHealth` | verified/limited/unverified — **no private data** |
| 9 | RemoteSensingReadiness | `__remoteSensingReadiness` | `activePredictionEnabled: false` — no NDVI claim without a real API |

Each data-dependent engine:
- reads **only** real sources (localStorage scan history / managed plants /
  event log / active farm / cached tasks; `window.__farrowayLastWeather`
  read-only; sibling health probes by name) — **no deep imports**, so a bad
  path can never break the build;
- emits an explainable envelope `{ value, confidence, dataSources,
  explanation, limitations }` with a `'low'|'medium'|'high'` confidence
  **label** (never a fabricated percentage);
- degrades honestly to **"Not enough data yet"** — no invented history,
  numbers, or agronomy.

### Composite + integration

- **`IntelligenceHealthRuntime.ts`** installs:
  - `__intelligenceHealth()` — composes the 8 engine probes + OODA +
    artifacts into a verdict **GOOD / NEEDS_DATA / BLOCKED** (BLOCKED only
    on a real wiring failure, never on thin data).
  - `__intelligenceOODAHealth()` — §12 OODA wiring, `nonBlocking: true`,
    `growerSafeOutput: true`.
  - `__intelligenceArtifactHealth()` — §11, lists the 7 intelligence event
    types, `artifactRuntimeOnly: true`, `idempotent`, `offlineSafe`.
- Boot wiring in `src/App.jsx` (inside the async boot IIFE, each install in
  its own `try/catch` so it **never blocks boot**); composite installed
  **last** so it reads the engine probes by name.

### Artifact events (§11 — via ArtifactRuntime only, no UI DB writes)

`FarmHealthCalculated`, `TrendDetected`, `DailyActionRecommended`,
`WeatherRiskFlagged`, `OutcomeImprovementRecorded`, `BuyerTrustCalculated`,
`NGOImpactSnapshotGenerated`.

### Internal QA surfaces (admin only)

- `/internal/intelligence` — executive intelligence dashboard (existing).
- `/internal/ngo-impact` — admin, org-scoped NGO impact (NGOHealthPage).

### Governance gates (wired into `build:safe`)

| Gate | Enforces |
|------|----------|
| `check:intelligence-safety` | explainability; yield is readiness-not-forecast (no tons/bags/acre/revenue); RemoteSensing keeps `activePredictionEnabled:false`; disclaimer present; no hardcoded chemical dosage |
| `check:no-fake-intelligence` | no `Math.random`; honest "Not enough data yet" fallback; real-source reads only; **TrendEngine ≥ 2 scans**; label confidence not numeric |
| `check:ooda-intelligence` | OODA `nonBlocking:true` + grower-safe; **no scan-render component imports the intelligence/OODA engines** |
| `check:intelligence-artifacts` | ArtifactRuntime present; 7 events declared; `artifactRuntimeOnly`; engines perform **no direct fetch/localStorage writes** |
| `check:buyer-privacy` | buyer signals read **no PII**; local-only (no fetch); read-only (no store writes) |

---

## Explicit non-goals (honored)

- ❌ No exact yield prediction (no tons/acre, bags/acre, kg/acre, revenue).
- ❌ No NDVI / satellite claim — readiness flag only until a real API stores data.
- ❌ No marketplace payments. ❌ No public investor dashboard.
- ❌ No auto-prescribed chemicals / dosages.
- ❌ No certainty claims — confidence is a label and the disclaimer is everywhere.
- ❌ No removed fallbacks; scan/upload/camera unchanged and never blocked.

## How to verify

`docs/INTELLIGENCE_ACCEPTANCE_TEST.md` (operator checklist) +
`window.__intelligenceHealth()` in the console. CI: `npm run build:safe`.
