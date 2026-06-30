# Go / No-Go Decision

**Date:** 2026-06-30 · **Build:** `build:safe` 399 gates green · **Defects found:** 0 critical, 0 high.

## FINAL VERDICT: ⚠ PILOT READY

Not ❌ NOT READY. Not ✅ PRODUCTION READY.

## Why PILOT READY (evidence)
- The build is **code-complete and gate-locked** (399 gates), with the safety-critical invariants
  **unit-tested, not just asserted**: a failed/unknown scan cannot corrupt farm data; no fabricated
  diagnosis/confidence/price; no secrets/image-bytes logged; failures never dead-end. 4 of those
  suites ran green live this session (96 assertions).
- **0 critical / 0 high defects** surfaced across the 12 workstreams (RELEASE_READINESS.md).
- The product can safely be put in front of a **controlled pilot** today.

## Why NOT ✅ PRODUCTION READY (honest, evidence-based)
The spec says *use only verified evidence*. The evidence that would clear full production
**does not exist yet** — it requires a real device + live data:
- **Scan accuracy** — the live provider cert (PRODUCTION_CERTIFICATION.md) reads **NOT_CERTIFIED;
  all providers DEGRADED until a real scan**. Machine-confirmed, by design.
- **Performance** — no runtime measurement (cold start / latency / memory).
- **Security** — no independent pen-test.
- **Observability** — only 2/10 telemetry events wired; **zero production events** → a pilot isn't
  yet fully measurable.
- **On-device** — camera, GPS, VoiceOver, responsive layouts unverified on real hardware.

Calling this PRODUCTION READY would be certifying on code inspection alone — which this
certification forbids. The scan lifecycle engine agrees automatically: `certifyScanLifecycle`
returns **DEVELOPMENT** (zero real volume).

## Conditions to escalate ⚠ PILOT READY → ✅ PRODUCTION READY
1. Run the internal pilot checklist (PILOT_CHECKLIST.md #1) — real scan + real GPS on real devices.
2. Wire the remaining 8 telemetry events; capture a full measured session.
3. Capture performance (first-paint / scan latency / cold start).
4. Independent security pen-test + dependency scanning.
5. Real-image scan accuracy ≥ threshold via `/api/admin/scan/last-trace` → flips the provider cert
   DEGRADED → READY and advances the lifecycle ladder past STAGING.

When these produce real metrics meeting the thresholds, `certifyScanLifecycle` will report
PRODUCTION_CERTIFIED on its own — no manual flag. **The blocker is operational, not code.**

## Recommendation
**GO for a controlled internal/NGO pilot. NO-GO for unrestricted public launch** until the five
conditions above produce real evidence.
