# Intelligence Layer v1 — Acceptance Test (§16)

Operator checklist for the production-safe farm decision-support layer.
Every check is **read-only** and runs against a real signed-in session.
Nothing here writes data, prescribes chemicals, or claims certainty.

> All intelligence is **decision support, not a guarantee.**

---

## 0. Pre-conditions

- [ ] App deployed and `https://www.farroway.app` is Online.
- [ ] Signed in as a real grower account with **at least one** scan in
      history (some checks need ≥ 2 scans of the same plant — noted below).
- [ ] DevTools console open.

---

## 1. Composite health probe

Run in the console:

```js
window.__intelligenceHealth()
```

- [ ] Returns a frozen object with `runtimeVersion: 'intelligence-health-v1'`.
- [ ] `verdict` is one of `GOOD` | `NEEDS_DATA` | `BLOCKED`.
- [ ] On a **fresh** account (no/low data) → `NEEDS_DATA` (NOT `BLOCKED`).
- [ ] `verdict` is `BLOCKED` only if **no** engine is wired (a real wiring
      failure) — never just because data is thin.
- [ ] `disclaimer === 'Decision support, not a guarantee.'`
- [ ] Eight readiness booleans present: `cropMemoryReady`, `trendReady`,
      `farmHealthReady`, `weatherRiskReady`, `yieldReadinessReady`,
      `dailyDecisionReady`, `ngoImpactReady`, `buyerTrustReady`.

## 2. Per-engine probes (each returns an explainable envelope)

For each of:

```js
window.__cropMemoryHealth()
window.__trendHealth()
window.__farmHealthScoreHealth()
window.__weatherRiskHealth()
window.__yieldReadinessHealth()
window.__dailyDecisionHealth()
window.__ngoImpactHealth()
window.__buyerTrustHealth()
window.__remoteSensingReadiness()
```

- [ ] Each returns a **frozen** object and never throws.
- [ ] Each data-dependent output carries `{ value, confidence,
      dataSources, explanation, limitations }`.
- [ ] `confidence` is a label `'low' | 'medium' | 'high'` — **never** a
      fabricated percentage.
- [ ] With thin data the value reads **"Not enough data yet"** — no
      invented history, numbers, or agronomy.

## 3. Farm Health Score (§3)

- [ ] `__farmHealthScoreHealth()` value is an integer **0–100** OR
      "Not enough data yet".
- [ ] Label is one of **Excellent / Good / Watch / Needs attention**.
- [ ] `explanation` states which real inputs drove the score; `limitations`
      states it is not a guarantee.

## 4. Trend (§2) — never infer from one scan

- [ ] With **one** scan of a plant → trend value is `UNKNOWN` and the copy
      says a trend needs **at least 2 scans**.
- [ ] With **≥ 2** scans of the same plant → trend reads improving / stable
      / worsening, each with an explanation comparing the scans.

## 5. Yield readiness (§5) — readiness, NOT a forecast

- [ ] `__yieldReadinessHealth()` value is `LOW | MEDIUM | HIGH | UNKNOWN`.
- [ ] **No** tons/acre, bags/acre, kg/acre, or revenue figure anywhere.
- [ ] `limitations` explicitly states it does not predict exact yield.

## 6. Daily decisions (§6)

- [ ] `__dailyDecisionHealth()` returns **at most 3** actions.
- [ ] Each action is grounded in a real signal (scan / task / weather /
      outcome) — none fabricated. With no data → "Not enough data yet".

## 7. Remote sensing (§9) — no fake satellite

- [ ] `__remoteSensingReadiness()` has `activePredictionEnabled: false`.
- [ ] No NDVI / satellite numeric claim is presented as live data.

## 8. Buyer trust (§8) — no private data

- [ ] `__buyerTrustHealth()` surfaces only coarse signals
      (verified / limited / unverified, recency badge, opaque photo ref).
- [ ] **No** farmer id, name, phone, email, coordinates, device id, IP, or
      exact filename anywhere in the envelope.

## 9. OODA is non-blocking (§12)

```js
window.__intelligenceOODAHealth()
```

- [ ] `nonBlocking === true` and `growerSafeOutput === true`.
- [ ] **Scan still works first**: open `/scan`, take/upload a photo — the
      camera/upload renders and analyzes **before** any intelligence runs.
      Intelligence never delays or blocks the scan or the upload.

## 10. Artifacts via ArtifactRuntime only (§11)

```js
window.__intelligenceArtifactHealth()
```

- [ ] `artifactRuntimeOnly === true`, `idempotent`, `offlineSafe` present.
- [ ] `intelligenceEvents` lists the 7 types: FarmHealthCalculated,
      TrendDetected, DailyActionRecommended, WeatherRiskFlagged,
      OutcomeImprovementRecorded, BuyerTrustCalculated,
      NGOImpactSnapshotGenerated.

## 11. Internal QA pages (admin only)

- [ ] `/internal/intelligence` loads for an admin and 404/denies for a
      non-admin.
- [ ] `/internal/ngo-impact` (admin only) renders org-scoped NGO impact.
- [ ] No public investor dashboard was added; no marketplace payments.

## 12. Governance gates (CI)

`npm run build:safe` runs and passes, including:

- [ ] `check:intelligence-safety` — explainable, readiness-not-forecast,
      no fake satellite, no dangerous dosage.
- [ ] `check:no-fake-intelligence` — real data only, honest fallbacks,
      no single-scan trend.
- [ ] `check:ooda-intelligence` — OODA non-blocking + grower-safe; scan
      render decoupled.
- [ ] `check:intelligence-artifacts` — artifacts via ArtifactRuntime only.
- [ ] `check:buyer-privacy` — buyer signals non-identifying, local-only.

---

### Pass criteria

All boxes checked **and** scan/upload/camera behave exactly as before this
wave (no regression). Intelligence is additive, explainable, and honest —
it never blocks the core flow and never claims certainty.
