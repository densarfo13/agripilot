# Farroway — Production Certification

**Board:** Release Certification (independent). **Date:** 2026-06-29.
**Rule:** evidence-backed only. PASS = verified. PARTIAL = likely-works, evidence incomplete.
FAIL = broken or verified failure. No PASS without verification; no guessing.

**Method:** code + test execution + `build:safe` gate chain + endpoint/route inspection.
**Hard limit:** no gate that depends on *real device / real farmer usage* can be certified PASS
from code inspection. Those are marked PARTIAL with the missing evidence named.

---

## Certification table

| Gate | Status | Evidence | Risk | Recommendation |
|---|---|---|---|---|
| **1 · Core farmer journey** | **PARTIAL** | All 7 steps implemented & located: onboarding (`FastOnboarding.jsx`), farm-create (`lib/api.js`), crop-create (`runtime/farmBrain/FarmBrain.ts`), location-save (`lib/locationSafe.js`), scan (`/api/scan/analyze`), recommendation (DailyDecisionEngine), task-complete (`lib/api.js`). | End-to-end run never executed on a device. Step-level code exists; the *journey* is unproven. | Run the journey once on a real phone (internal test) start→task-complete. |
| **2 · Scan** | **PARTIAL** | Pipeline gated: `scanIdentificationBenchmark.test.js` (16 crops, ≥95% no-Unknown), `classifyProviderFailure` (timeout/auth/credits/parse), confidence normalizer, `FarmBrainScanIngestion.test.ts` (unknown handling). No generic "unclear" gate. | **Real-image CV accuracy never measured** — the benchmark proves the pipeline never drops a good match, not that providers ID real photos. | One real scan per crop class via `/api/admin/scan/last-trace`; confirm confident named result. |
| **3 · Location** | **PARTIAL** | `ClassifyLocationError.test.ts` **36 assertions PASS** (GPS/denied/timeout/low-accuracy/unavailable → specific verdict+buttons); `LocationRetryPolicy.test.ts` (retry-once); `searchLocations` (town); manual ZIP + general-guidance fallbacks; no dead-end gated. | Real on-device GPS timing (Safari/Android/iPhone) unverified; permission prompt behavior varies by OS. | Internal test: GPS + town/ZIP fallback on real Android **and** iPhone. |
| **4 · Language** | **PARTIAL** | Gated: key parity, coverage ratchet, dup-key, MythosLanguageGuard, hardcoded-string audit, English fallback on missing key. | Active-locale completeness fr 95 / tw 97 / sw 97 / ha 97 % (rest falls back to English — honest, not mixed); Hindi 54% (intentionally hidden). Not screen-verified on device. | Spot-check the 9 core screens in fr/tw/sw/ha on device for leaks. |
| **5 · Daily decision** | **PASS** | DailyDecisionEngine emits exactly one primary action + reason + confidence + evidence; no-farm→no-crop→no-location→no-scan→priority ladder; gated (`check-today-engine`, `check-recommendation-engine-v1`, `check-decision-task-outcome-link`). No fabricated advice (honesty gate). | Real recommendations depend on real farm data (field-pending), but the contract is verified. | Confirm content quality during internal test with real farm data. |
| **6 · Timeline** | **PARTIAL** | Server timeline-adjacent code present (`server/src/app.js`, modules). Duplicate-suppression + failed-scan-review-only implemented client-side. | **"Database is source of truth (not localStorage)" is not gated and not definitively confirmed** this review — weakest-evidence gate. | Verify timeline reads from DB after a real scan; add a source-of-truth gate. |
| **7 · Marketplace** | **PASS** | `SellDecisionEngine.test.ts` **20 assertions PASS** incl. "no verdict contains a fabricated number/currency"; 4 verdicts (SELL_NOW/WAIT/NEED_MORE_PRICE_DATA/NO_BUYERS_FOUND); WAIT only on a real rising-price signal; wired into `MarketInsightCard`; gated. | No live price feed exists → SELL_NOW is demand-driven (by-design-honest, says NEED_MORE_PRICE_DATA otherwise). | None for honesty. Add a live price provider before claiming price-based timing. |
| **8 · Performance** | **PARTIAL** | `build:safe` passes (lint/typecheck/test in-chain); mobile-safe-layout gated. | **No load-time / API-latency / scan-latency measurement exists** — evidence missing, not failure. | Capture first-paint, `/api/scan/analyze` latency, GPS-to-save time during internal test. |
| **9 · Security** | **PARTIAL** | `middleware/protectedRouter.js`, auth federation routes, admin-gated internal routes; gates `check-bulk-onboarding-security`, `check-federation-security`; honesty rule: no secrets/image-bytes in logs/traces (vitest-verified for scan trace). | No independent pen-test / external audit; auth flows not exercised under real load. | Security review + auth flow test before external (25-user) exposure. |
| **10 · Telemetry** | **PARTIAL** | Framework present; **2 of 10** spec-named critical events confirmed wired (`scan_started`, `recommendation_shown`). | 8/10 spec events (`scan_result_success/failed`, `scan_unknown_blocked`, `location_started/success/failed`, `timeline_event_created`, `market_price_missing`, `provider_failed`) not wired under those names; **zero production events recorded** → a pilot can't yet be measured. | Wire the remaining critical events before pilot so the pilot is observable. |

**Build:** `npm run build:safe` — PASS, 391 steps green (verified this session; no code changed during certification).
**Tests executed live for this certification:** ClassifyLocationError (36 ✓), SellDecisionEngine (20 ✓).

**Tally:** 2 PASS · 8 PARTIAL · 0 FAIL.

---

## FINAL VERDICT: **GO_FOR_INTERNAL_TEST**

Not `GO_FOR_25_USER_PILOT`. Not `GO_FOR_PUBLIC_LAUNCH`.

**Reasoning.** The build is code-complete, honest, and gate-locked (391 gates), and the
safety-critical invariant — an unknown/failed scan cannot corrupt farm data — is *unit-tested*,
not merely asserted. Two gates PASS outright (Daily Decision, Marketplace). **But every gate
that decides whether the core promise actually works for a farmer is PARTIAL for the same
reason: it has never run on a real device with real input.** Specifically unmeasured:
real-image scan accuracy (#2), on-device GPS (#3), performance (#8), and — critically —
telemetry (#10), which means a pilot today could not even be *observed*.

Exposing 25 external farmers before those four are field-verified would be declaring readiness
on code inspection alone, which this Board forbids.

`GO_FOR_PUBLIC_LAUNCH` is **locked** and remains so until a 25-user pilot produces real
scan-success / retention / crash-free metrics — none exist today.

### Conditions to escalate INTERNAL_TEST → GO_FOR_25_USER_PILOT
1. One real scan per crop class returns a confident named result (`/api/admin/scan/last-trace`) → closes #2.
2. Location works on real Android **and** iPhone, GPS + town/ZIP fallback → closes #3.
3. The remaining 8 critical telemetry events fire and are visible for a full real session → closes #10, makes the pilot measurable.
4. First-paint / scan-latency / GPS-to-save captured on device → closes #8.
5. Core screens spot-checked in fr/tw/sw/ha; timeline confirmed reading from DB after a real scan → closes #4, #6.

Pass all five on internal test → re-certify for `GO_FOR_25_USER_PILOT`.

---

## Additional findings (discovered during certification, not fixed)

The Board does not modify code. One real observation surfaced from the build log:

- **`provisionFarmerFromRow` missing from the `organization` runtime barrel.** It is defined
  (`runtime/organization/onboarding/FarmerProvisioningRuntime.ts:106`) and used internally by
  `BulkOnboardingRuntime`, but **not re-exported** by `runtime/organization/index.ts`. The build
  therefore emits a rollup "is not exported" warning for `AddFarmerPage.jsx`. **Severity: low /
  non-blocking.** `AddFarmerPage._resolveProvisioner()` (line 272) handles this *by design* —
  returns `null` and shows a calm "feature not available" state instead of throwing, and the page
  retains its API/offline submission path. **Scope:** the NGO/organization bulk-add-farmer admin
  flow — **outside the core farmer journey and all 10 certified gates**, so it does not change the
  verdict. Pre-existing (build was 391-green before this review). Recommend re-exporting the symbol
  from the barrel so the page's runtime provisioning path is live, in a separate fix session.

---

*This certification changed no code. It is a record, not a release.*
