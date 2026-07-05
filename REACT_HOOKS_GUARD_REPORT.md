# React Hooks Guard Report

Repository-wide protection against the Rules-of-Hooks crash class (production root cause,
2026-07-04: PhotoComparisonCard early return between hooks → crash on scan SUCCESS →
"Scan temporarily unavailable").

## Enforcement layers
1. **ESLint config** — `react-hooks/rules-of-hooks: 'error'` + `exhaustive-deps: 'warn'`
   (eslint.config.js; pre-existing, verified). The single rule covers all four demanded shapes:
   conditional hooks, hooks after early returns, hooks in loops, hooks in try/catch.
2. **Build gate** — `check:no-conditional-hooks` (build:safe step 410): ANY rules-of-hooks error in
   src fails every build. Current: **0** (was 5 errors / 4 files, all fixed at source).
3. **exhaustive-deps ratchet** — committed baseline (`scripts/hooks-deps-baseline.json`, currently
   193); the count may only fall; `--update` tightens after cleanup batches. Honest note: flipping
   193 warnings to errors in one day would be churn — the ratchet stops growth today and burns down
   by user impact.
4. **Scan render regression** — `scripts/repro-scan-render-crash.mjs --strict` (run inside the
   gate): Router-wrapped SSR of the full result tree (ScanCommandCard, IntelligentScanResult,
   ScanResultCard, VerificationChecklist, ManualIssuePicker) against **success / lowConf / sparse**
   envelopes — the lowConf one shaped from the real production scan (plant.id 200, candidates=2) —
   plus the exact PhotoComparisonCard **scanId absent→present** transition. Any throw fails the build.
5. **CI merge-block** — new `hooks-guard` job in `.github/workflows/production-safety.yml` (runs on
   every push/PR: npm ci + the gate). Honest caveat: authored this session, not yet observed green
   in Actions — verify on the next PR.

## Fixed at source (this arc)
ScanHub ×3 hook-named helpers · PhotoComparisonCard (THE scan crash) · CommandCenterDeck (Home) ·
LanguageProvider (global) · OnboardingImport. rules-of-hooks: 15 → 0 across src.
