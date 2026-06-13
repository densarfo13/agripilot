# MYTHOS_LANGUAGE_CONSISTENCY_REPORT.md

**Sprint #202 (spec #194) — language consistency.**
Date: 2026-06-15
Mode: PILOT EXECUTION.

## 1. Root cause summary

Language consistency was already substantially solved across
sprints #186 (6-locale parity), #190 (engine keys + audit:i18n),
#191 (crops/greetings/weather verified), #196 (last 5 chrome
strings + ratchet), and #201 (scan trust-card keys). Re-running
the audit confirmed the 16 tracked grower surfaces are clean
(5 findings = documented false positives).

**The one real root cause this sprint found:** the `audit:i18n`
scanner targeted a non-existent `src/pages/SellPage.jsx`. The real
file is `src/pages/Sell.jsx`, so the **Sell surface was silently
never scanned** — a latent coverage hole. Pointing the target at
the real file immediately surfaced 2 genuine hardcoded placeholders.

## 2. Files created
- `src/runtime/i18n/LanguageConsistencyRuntime.ts` —
  `window.__languageConsistencyHealth()` (spec §8).
- `scripts/check-language-consistency.mjs` — one consolidating gate.
- `MYTHOS_LANGUAGE_CONSISTENCY_REPORT.md` (this file).

## 3. Files modified
- `scripts/audit-hardcoded-strings.mjs` — SellPage.jsx → Sell.jsx
  (coverage fix).
- `src/pages/Sell.jsx` — 2 placeholders externalized.
- `src/i18n/columns/T-*.js` — 2 sell keys + parity ×6.
- `src/App.jsx` — boot install.
- `package.json` — gate registered + wired into build:safe.

## 4. Hardcoded strings removed
- `Sell.jsx:705` placeholder `"e.g. maize"` → `tSafe('sell.cropPlaceholder', …)`
- `Sell.jsx:827` placeholder `"e.g. 250-300 GHS / kg"` →
  `tSafe('sell.pricePlaceholder', 'e.g. 250-300 per kg')`
  (also dropped the GHS-specific currency from the visible default).

These were invisible to every prior audit because the surface
wasn't being scanned. Now permanently covered.

## 5. Translation keys added
- `sell.cropPlaceholder`, `sell.pricePlaceholder` — parity-stubbed
  into all 6 locales.

## 6. Crop localization summary
**Already done, gate-locked.** `src/config/crops.js`
`CROP_LABELS_BY_LANG` ships 20+ crops × 6 locales (en/fr/sw/ha/tw/hi),
consumed by 87 files via `getCropLabel()`. The spec's requested
`cropTranslations.ts` exists in this equivalent form. English
fallback on miss; user-entered custom names preserved.

## 7. Task localization summary
**Already done, gate-locked.** Task engines emit `titleKey` /
`descriptionKey`; `getLocalizedTaskTitle` (130+ id-map) resolves
to the active locale (sprints #112-#114, #190). The spec's §5
shape (titleKey/descriptionKey instead of raw English) is the
shipping architecture.

## 8. Scan localization summary
**Already done (#201), gate-locked.** Trust-card copy uses
`scan.why`, `scan.limitations`, `scan.nextAction`, `scan.followUp`,
`scan.needsConfirmation`, `scan.sendForReview`, `plant.possible`,
`scan.action.*`, `outcome.better/same/worse`. Mythos
ScanActionGenerator + ScanFollowUpGenerator emit i18n keys.

## 9. Health check output

`window.__languageConsistencyHealth()` →
```json
{
  "hardcodedStringsFound": null,
  "missingKeys": null,
  "blankLabels": 0,
  "keyLeaks": 0,
  "cropNamesLocalized": true,
  "tasksLocalized": true,
  "scanLocalized": true,
  "greetingsLocalized": true,
  "buttonsLocalized": true,
  "languageSwitchLive": true
}
```
`hardcodedStringsFound`/`missingKeys` are `null` at runtime
(honest — those are build-time measurements the browser can't
take; `audit:i18n` owns them). `keyLeaks` is measured live from
the DOM — 0 is healthy.

## 10. Build results
`build:safe` green (gate suite now 291). `audit:i18n` back at
baseline 5 after the Sell fix. 6-locale structural coverage 100%.

## 11. Remaining translator-review items
- Hindi: ~2982 keys with English fallback (translator-partner
  queue, `_translator-review-pending.json`).
- fr/sw/ha/tw: the recent sprint additions (scan + sell keys),
  small per-locale counts, same queue.
These need a human translator, not code — English fallback renders
safely (no `{key}` leaks, no blanks) until then.

---

## Scope ruling (declined per frozen list)

The spec's §1 **MythosLanguageAuditor runtime** (3 files) was
declined — it is a new intelligence layer (frozen), and the
build-time `audit:i18n` scanner already performs the detection it
describes. Of the §9 **five gates**, four would duplicate gates
already in build:safe (`audit:i18n`, `check-translations`,
`check-i18n-coverage`, `check-grower-i18n-hardcoded`,
`check-hardcoded-grower-copy`, `check-scan-farmer-safe-language`,
`check-farmer-facing-ai-language`). Built the one genuinely-new
consolidating gate (`check-language-consistency`) instead. This
keeps the gate suite a guardrail, not bloat.

## Verdict
Language consistency: **complete and gate-locked**, with one real
latent coverage hole (Sell) found and closed. The only open work
is the translator queue — no further code sprint moves it.
