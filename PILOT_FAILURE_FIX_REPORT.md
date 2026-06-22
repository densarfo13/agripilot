# PILOT_FAILURE_FIX_REPORT.md

**Sprint #213 — premortem hardening, what changed.**
Date: 2026-06-19. Audit-only sprint: no new features; failure
prevention + verification only.

## Built this sprint

| File | Purpose |
|---|---|
| `src/runtime/premortem/PilotPremortemRuntime.ts` | `__pilotPremortemHealth()` — 8-dimension launch verdict composed over 7 existing probes |
| `scripts/check-premortem-critical-path.mjs` | gate: composite wired + 8 dims + reads all protection probes |
| `scripts/check-pilot-events.mjs` | gate: 14 critical-action events declared |
| `scripts/check-mobile-safe-layout.mjs` | gate: bottom nav + shell respect safe-area inset (notch/clip) |
| `PREMORTEM_RISK_REGISTER.md` / `PILOT_CRITICAL_PATH_REPORT.md` / this file | the audit |

## Modified

- `PilotEventContracts.ts` — +4 events (planting_date_added,
  location_added, scan_unclear, return_visit) so every funnel step is
  trackable.
- `App.jsx` — boot-install `__pilotPremortemHealth` (last, so it can
  read the probes it composes).
- `package.json` — 3 gates wired into `build:safe`.

## Fixes applied vs. verified-already-shipped

The premortem found **no new code defect** in failure modes 1-17/19.
Each already had a shipping protection + gate (see the register). The
genuine deltas were: the **composite that proves they're all green at
once**, the **4 missing analytics events**, and **3 gates** that lock
the premortem findings so they can't silently regress.

## Health check results (structural / build-time)

`__pilotPremortemHealth()` composes:
```
criticalPathReady   ✓ (farmerCompletion)
mobileReady         ✓ (safe-area + premium-mobile gate)
languageLeaks       [] (runtime guard; 0 key/blank leaks)
scanNoDeadEnds      ✓ (scan-mythos + no-dead-ends gate)
tasksNoDuplicates   ✓ (task + notification dedupers)
emptyStatesGuided   ✓ (completion + timeline)
analyticsReady      ✓ (events wired; values NEEDS_DATA pre-pilot)
errorRecoveryReady  ✓ (10 boundaries + SafeLoader + chunk recovery)
```

## Remaining accepted risks

1. **Adoption (risks 18 + 20)** — the only High/High risks; not code.
   Analytics stay NEEDS_DATA and the first-journey is unproven until
   farmers use the app.
2. **Hindi 54%** — hidden by design.
3. **Translator gap (Twi/regional)** — English-fallback safe (#211).
4. **On-device mobile** — gated structurally; needs a real-device
   smoke test before launch (preview tooling times out in this env).

## Final verdict

### ✅ READY_FOR_PILOT (engineering)

Zero preventable code-side blockers; all 8 premortem dimensions green
and gate-locked. The residual risk is adoption, which only onboarding
the Phase-1 cohort resolves.
