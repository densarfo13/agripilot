# Known Limitations

Honest, verified limitations as of this certification. None are hidden; each has a disposition.
These are why the verdict is **PILOT READY**, not PRODUCTION READY.

## Not yet measurable from the build (need a real device / live data)
1. **Real-image scan accuracy** — the benchmark proves the pipeline never drops a good match; it
   does **not** prove the CV providers identify real photos at ≥95%. Measured via one real scan
   → `/api/admin/scan/last-trace`. The live provider cert (PRODUCTION_CERTIFICATION.md) reads
   **NOT_CERTIFIED — all providers DEGRADED until a real scan**, by design.
2. **Performance** — cold start, navigation, API/scan latency, memory, battery: no runtime capture.
3. **On-device accessibility** — VoiceOver, dynamic type, reduced motion, outdoor readability.
4. **On-device GPS** — real Android + iPhone permission timing.
5. **Observability live data** — only 2/10 spec-named telemetry events confirmed wired; **zero
   production events recorded**, so a pilot is not yet fully measurable.

## Known product limitations (by design, honest)
6. **No live market price feed** — sell decision is demand-driven; says NEED_MORE_PRICE_DATA rather
   than inventing a price.
7. **No live funding program feed** — funding surfaces are present; real program data is external.
8. **Hindi hidden** — `enableHindiLocale=false` until ~3k keys translated (intentional). Active
   locales fr/tw/sw/ha are 95–97% translated; the remainder falls back to English (honest, not mixed).
9. **CV field-intelligence** (counts/canopy/ripeness score) — honest advisor only; needs a CV model.

## Verification gaps (missing checks, not known defects)
10. **No independent security pen-test / dependency scanning in CI.** Blocks external exposure.
11. **Screen migration to the design system** is in progress (inline-color debt ratcheting to 0);
    Home is decision-first, other screens not yet fully migrated.

## Not limitations (verified safe)
- A failed/unknown scan **cannot** corrupt farm data (unit-tested).
- No fabricated diagnosis / confidence / price / metric (gated).
- No secrets or image bytes logged; coarse coordinates only (tested).
