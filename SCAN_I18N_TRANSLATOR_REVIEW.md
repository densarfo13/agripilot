# SCAN_I18N_TRANSLATOR_REVIEW.md

**Native-speaker review request** — 65 scan-result keys registered + first-pass
translated in sprint #222 (Phase-1 acceptance). Date: 2026-06-24.

## Why this exists
These 65 keys (`scan.intel.*`, `scanCommand.*`, and legacy `scan.button.*`/
`scan.section.*`/`scan.toast.*`/`scan.recovery.*`) were previously **unregistered**
— the production scan cards rendered the hardcoded English default in every
locale. They are now registered in `T-en.js` and translated into tw/fr/sw/ha/hi
so the parity gate + `check:scan-i18n-registered` pass and the Twi pilot no
longer sees English on the primary scan card.

## Confidence by locale (please review in this order)
| Locale | Confidence | Action |
|--------|-----------|--------|
| **tw (Twi/Akan)** | **First pass — review REQUIRED** | Pilot language. Verify agronomy terms (Afifideɛ, Dɔteɛ, Ayaresa, Mmoawa) read naturally to a farmer. |
| **ha (Hausa)** | First pass — review recommended | Check diacritics (Ƙasa, ɗaukar) + agronomy terms. |
| fr (French) | Higher confidence | Spot-check. |
| sw (Swahili) | Higher confidence | Spot-check. |
| hi (Hindi) | Hidden locale (`enableHindiLocale=false`) | Lowest priority; not user-visible. |

## How to review
1. Keys + all six values live in `src/i18n/columns/T-{en,tw,fr,sw,ha,hi}.js`
   (grep `scan.intel.` / `scanCommand.` / `scan.section.` etc.).
2. Edit the value in the relevant column only; keep the key identical across
   columns.
3. Re-run `node scripts/check-translations.mjs` (parity) +
   `node scripts/check-scan-i18n-registered.mjs` (registration) — both must pass.

## Not in scope here (tracked separately)
- ~38 **pre-existing** `scan.*` Twi values that are byte-identical to English
  (defect M3 in SCAN_PRODUCTION_CERTIFICATION.md) — covered by the existing
  Translation Completion Program (sprint #211), not this batch.
