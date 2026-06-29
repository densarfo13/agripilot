# Farroway — Pilot Gate

Release to pilot farmers only when **all** are true. Each item names how it is enforced and
its honest current status. "Code-green" = verified by gates/tests in `build:safe`.
"Field-pending" = cannot be proven from CI; needs a real device / real scan.

| # | Gate | Enforced by | Status |
|---|---|---|---|
| 1 | **Scan reliable** | scan-id benchmark (`check:scan-id-benchmark`, ≥95% supported crops, no Unknown-collapse) + candidate/sort/confidence gates | Code-green. **Field-pending:** real-image CV accuracy needs a production scan + `GET /api/admin/scan/last-trace`. |
| 2 | **GPS reliable** | location classifier + retry policy + onboarding UX gates (`check:location-error-classify`, `check:location-retry-policy`) | Code-green. **Field-pending:** on-device GPS timing (Safari/Chrome/Android/iPhone). |
| 3 | **Language complete** | coverage ratchet, duplicate-key, hardcoded-string, MythosLanguageGuard gates (fail build on regression) | Code-green for active locales (fr/tw/sw/ha). Hindi intentionally hidden until translated. |
| 4 | **Crash free** | error boundaries + chunk-recovery + startup-health gates | Code-green. **Field-pending:** real crash-free-session rate from the pilot. |
| 5 | **Recommendations evidence-backed** | DailyDecisionEngine (action/reason/confidence/evidence); never fabricated; weak evidence creates no task | Code-green. |
| 6 | **Timeline persists correctly** | Farm timeline persistence + dedup; failed scan = review-only, never updates plant/crop health | Code-green. |
| 7 | **Tests green** | `npm run build:safe` ends `PASS — N steps green` | Code-green at each release. |

## Go / No-Go

- **GO** only when items 1–7 are code-green **and** the two field-pending items (1, 2) have
  passed a one-time real-world acceptance: one real scan of a supported crop returns a
  confident named result, and a 15-minute onboarding→location→scan→recommendation→task
  smoke passes on a real Android **and** a real iPhone.
- Until that acceptance run: **GO-pending-acceptance**, not a blind GO. The only residual
  risk is exactly what CI cannot measure — so we measure it on a device before flipping.
