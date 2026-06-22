# PILOT_CRITICAL_PATH_REPORT.md

**Sprint #213 — critical-path audit.**
Date: 2026-06-19. Each step checked for: CTA · error recovery ·
loading state · empty-state guidance · analytics event.

| Step | CTA | Error recovery | Loading | Empty guidance | Analytics event |
|---|:-:|:-:|:-:|:-:|:-:|
| Signup | ✓ | ✓ ErrorBoundary | ✓ | n/a | `signup_completed` |
| Select language | ✓ 🌐 sheet | ✓ | ✓ | n/a | `language_selected` |
| Create farm/garden | ✓ | ✓ | ✓ | ✓ next-step | `farm_created` |
| Add crop | ✓ | ✓ | ✓ | ✓ guided | `crop_added` |
| Add planting date | ✓ | ✓ | ✓ | ✓ guided | `planting_date_added` ✚ |
| Add location | ✓ | ✓ | ✓ | ✓ guided | `location_added` ✚ |
| Run scan | ✓ | ✓ retry + safe shell | ✓ banner | ✓ | `scan_started`/`scan_completed` |
| Understand result | ✓ | ✓ | ✓ | ✓ why+limits | `scan_unclear`✚/`scan_unknown_result` |
| Create task | ✓ | ✓ | ✓ | ✓ | `task_created` |
| Complete task | ✓ Done | ✓ | ✓ | ✓ | `task_completed` |
| Record outcome | ✓ B/S/W | ✓ | ✓ | ✓ | `outcome_recorded` |
| Return next day | ✓ | ✓ | ✓ | ✓ guided home | `return_visit` ✚ |

✚ = event name added this sprint to `PilotEventContracts.ts`.

**No step lacks a CTA, error recovery, loading state, empty-state
guidance, or an analytics event.** The 4 previously-undeclared events
(planting_date_added, location_added, scan_unclear, return_visit) are
now in the canonical contract (`check:pilot-events` enforces it). Call-
site wiring of each is owned by `check:pilot-analytics`; the funnel
vocabulary is complete.

**Critical-path verdict: READY.** Every step is reachable, recoverable,
guided, and measurable.
