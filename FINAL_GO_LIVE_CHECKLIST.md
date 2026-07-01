# Final Go-Live Checklist (RC1)

The single decision list. **Done** = verified in code/gates. **Blocker** = must close before the
stated launch tier. No feature work until the critical blockers are closed (per the mission).

## Done + verified (code)
- [x] `build:safe` 402 gates green; Prisma migrations clean; frozen core hash-verified.
- [x] Safety invariants unit-tested — no failed scan corrupts data; no fabricated diagnosis/price/metric.
- [x] Rule #12 (no engineering wording) gate-locked across all 10 pages.
- [x] Design primitives fully token-driven (no phantom tokens, no hardcoded hex) — gate-locked.
- [x] Failure handling: offline/retry/timeout/provider-down/GPS-denied/camera-denied — code-verified.
- [x] Injection / SSRF / secrets-logging classes mitigated (SECURITY_AUDIT.md).
- [x] Honest go/no-go state machine (launchGateDecision) — advances only on real data.

## Blockers before **public launch** (not the pilot)
- [ ] **CRITICAL — Real-image scan accuracy** unproven → run a real scan → provider cert NOT_CERTIFIED → READY. (FIELD/PILOT)
- [ ] **CRITICAL — Security pen-test + dependency scanning** (SECURITY_AUDIT A06 + pen-test).
- [ ] **HIGH — Performance not measured** — capture Lighthouse / Core Web Vitals / cold-start on device.
- [ ] **HIGH — Observability live data** — wire remaining telemetry events; confirm a full measured session.
- [ ] **MEDIUM — On-device pass** — VoiceOver, dynamic type, responsive across the 6 target devices.

## Blockers before scaling past the pilot
- [ ] Real farmer metrics meeting the READY_FOR_1000 gates (GO_NO_GO_RUNBOOK.md).

## Decision
- **GO** — controlled internal / NGO pilot (all pilot prerequisites are code-complete; run PILOT_CHECKLIST.md #1).
- **NO-GO** — unrestricted public launch, until the CRITICAL + HIGH blockers above are closed with real evidence.

The remaining blockers are **operational and verification** work — a real device, a real scan, a
pen-test, a measured session. **Not more code.** No new features until they're closed.
