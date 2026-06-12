# LANGUAGE_CONSISTENCY_REPORT.md

**Sprint #196 (spec #191) — Language Consistency Hardening.**
Date: 2026-06-13 · Mode: PILOT EXECUTION (P0: localization completion)

## KPI Impact

Improves: **D7 Retention %** (non-English farmers — Twi/French/
Swahili/Hausa/Hindi users no longer hit untranslated chrome labels)
and reduces mixed-language screens that depress trust. Expected
change: marginal but real for the ~80% of pilot users outside
English.

## Consistency scorecard

| Check | Result |
|---|---|
| Structural key coverage (vs en, 6433 keys) | **100% all 6 locales** (gate-enforced ≥98%) |
| Hardcoded user-facing strings | **0 true positives** (was 5; baseline ratcheted 10 → 5, remaining 5 are verified false positives) |
| Crop names (20 spec crops × en/fr/tw/sw/hi + ha) | **20/20 present** in `CROP_LABELS_BY_LANG` (`src/config/crops.js`) |
| Greetings (morning/afternoon/evening) | keyed (`home.header.*`), both Standard + Simple Home |
| Language caching violations | **0** — every `getCurrentLang()` call site resolves at call time; no module-scope capture |
| Live-switch (no reload) | verified in-browser #182 (en→ha flipped Login instantly via `farroway:langchange`) |

## Phase 1 — audit (fixed this sprint)

| File | Line | Was | Now |
|---|---|---|---|
| `src/components/simpleMode/SimpleHome.jsx` | 66 | `ariaLabel="Notifications"` | `tSafe('header.actions.notifications', …)` |
| `src/components/simpleMode/SimpleHome.jsx` | 69 | `aria-label="Menu"` | `tSafe('header.actions.menu', …)` |
| `src/components/system/SettingsDrawer.jsx` | 85 | `aria-label="Close settings"` | `tSafe('settings.close', …)` |
| `src/pages/Login.jsx` | 359 | `Two-Factor Authentication` | `tSafe('login.mfa.title', …)` |
| `src/pages/Login.jsx` | ~433 | `aria-label="Sign-in method"` | `tSafe('login.method.label', …)` |

Remaining 5 scanner findings are false positives the regex cannot
distinguish (4 are the `titleDefault` second-arg of an inner
`tSafe(titleKey, titleDefault)` component in IntelligentScanResult;
1 is a sliced `0 && w` logic fragment in ScanPage). Documented in
HARDCODED_STRINGS_AUDIT.md; baseline now 5 so any NEW hardcoded
string fails the build.

## Phase 2 — single source of truth (already exists; no duplicate built)

The spec asks for `languageService.ts`. That service already exists
as `AppPrefsContext.setLanguage` → `setLanguageAtomic()` →
`farroway:langchange` broadcast → every `useTranslation`/`tSafe`
consumer re-resolves. Components verified NOT to cache: the one
prior offender (scanResultLanguage.js frozen label map) was
converted to lookup-time getters in #190. Building a parallel
languageService.ts would create the dual-source problem the spec
is trying to prevent — skipped per the frozen-list / DRY rule.

## Phases 3–4 — crops + greetings

All 20 spec crops present across locales (plus ~10 more);
partner-verified overlays for Twi/Hausa. Greetings keyed in both
home renderers. No changes needed.

## Phase 5 — switch test

In-browser proof from #182: `en → ha` flipped `documentElement.lang`
and all visible copy instantly, no reload. The broadcast path is
shared by every surface listed in the spec (nav, home, tasks, scan,
weather, crops, notifications, profile, settings).

## Phase 6 — build gate

`npm run audit:i18n` (in build:safe via check:language-selector
parity + standalone): fails on (a) any locale < 98% structural
coverage, (b) > 5 findings (any NEW hardcoded string), (c) missing
parity sidecar. Plus the 8 pre-existing i18n gates
(check:translations, check:i18n-coverage, check:i18n-compliance,
check:grower-i18n-hardcoded, check:hardcoded-grower-copy,
check:entity-localization, check:message-template-locales,
check:language-persistence).

## Coverage summary

| Locale | Structural | Real translation | Pending |
|---|---:|---:|---:|
| en | 100% | 100% | 0 |
| fr / sw / ha / tw | 100% | 99.8% | 12 each |
| hi | 100% | 54.2% | 2946 |

**Language Consistency ≥ 98%: MET** for structural coverage on all
locales and real-translation coverage on 5 of 6. Hindi remains the
honest exception — English fallback (stable strings, no key leaks)
until the translator partner processes the sidecar queue. Screens
clean: all (chrome + engine surfaces externalized). Screens
failing: none at the gate level.
