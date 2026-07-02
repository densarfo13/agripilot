# Full App Audit Report

Release-blocker classification across the app. P0 = release blocker · P1 = pilot blocker · P2/P3 =
deferred. Only P0/P1 are in scope; findings map to code, not speculation.

| Area | Status | Class | Note |
|---|---|---|---|
| Scan | **P0 addressed** | P0 | render-crash dead-end → terminal-state machine + result boundary + correlation id (this + 2 prior sprints). Real-image accuracy still needs a device. |
| Home | OK | — | decision-first, no jargon (gated) |
| My Farm / Tasks / Activity | OK | — | token-driven, guarded |
| Funding | OK (P2) | P2 | live program feed external (honest `no_live_feed`) |
| Sell | OK | — | honest sell decision, no fabricated price |
| Notifications / Profile / Settings | OK | — | localized, gated |
| Onboarding | OK | — | location never blocks; fallback to town/ZIP |
| Location | OK | — | GPS denied → manual entry (gated) |
| Language | OK | — | 6-locale parity gated; hi hidden until translated |
| Authentication | OK (P1) | P1 | works in code; device session + brute-force policy need device/pen-test |
| Database | OK | — | Prisma migrations clean-gated |
| API | OK | — | analyze/diagnostics/last-trace present |
| Offline sync | OK | — | queue + backoff + `scan.queued/drained` |
| Telemetry | **P1** | P1 | scan events present; some spec-named events (camera_started/image_upload_started/scan_provider_started) not all wired verbatim; zero live production data (no pilot yet) |
| Security | **P1** | P1 | injection/SSRF/secrets mitigated; **pen-test + dep-scan pending** (public-launch blocker, not pilot) |
| Performance | **P1** | P1 | not runtime-measured; needs a device |

## P0/P1 fixed this sprint
- **P0 — scan never dead-ends**: `resolveScanTerminalState` (11 states + safety lock) + test + gate.
- (Prior sprints, still active) result-scoped boundary + correlation id.

## P1/P0 NOT fixable from code (operator-gated)
Real-image scan accuracy, performance measurement, security pen-test, live telemetry — all require a
real device / real pilot. Reported honestly; not faked.

## No scope expansion
No new engines beyond the terminal-state resolver, no page redesign, no governance. Everything else
above is already built and gated.
