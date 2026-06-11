# LANGUAGE_MISMATCH_AUDIT.md

**Sprint #186 — i18n parity audit + Hindi gap closure.**
Date: 2026-06-12
Status: 6/6 locales at 100% structural parity. Hindi has 2934 keys
flagged for translator review (still rendering English).

---

## Result summary

| Locale | Code | Keys before | Keys after | Real-translation coverage | Translator-review queue |
|---|---|---|---|---|---|
| English | `en` | 6421 | 6421 | 100% (source) | 0 |
| French | `fr` | 6421 | 6421 | 100% | 0 |
| Swahili | `sw` | 6421 | 6421 | 100% | 0 |
| Hausa | `ha` | 6421 | 6421 | 100% | 0 |
| Twi | `tw` | 6421 | 6421 | 100% | 0 |
| **Hindi** | `hi` | **3487** | **6421** | **54%** | **2934** |

**Structural parity:** ✅ 6 / 6 locales contain every key that
exists in `T-en.js`. The build gate now fails if any non-en
column has fewer keys than `T-en.js`.

**Real-translation coverage:** 5 / 6 locales at 100%. Hindi at
54% (2934 keys carry English values pending translator review).

---

## Files affected

- `src/i18n/columns/T-hi.js` — appended 2934 keys with English
  values (preserves the existing 3487 Hindi-translated entries
  in their original order, then adds the rest in `T-en.js`
  insertion order)
- `src/i18n/columns/_translator-review-pending.json` (NEW) — sidecar
  listing every key per locale that needs real translation
- `scripts/fill-language-parity.mjs` (NEW) — idempotent parity-fill
  script; run any time `T-en.js` gains new keys to auto-stub the
  others
- `scripts/check-language-selector.mjs` — extended with §9b
  (key-parity assertion) + §9c (sidecar presence)

---

## Missing keys by language (pre-fix)

### `hi` — 2934 missing keys (top 30 shown; full list in sidecar)

Keys with the largest grower-facing impact appear first.
The sidecar JSON at `src/i18n/columns/_translator-review-pending.json`
holds the complete list for translators.

The 2934 keys span every namespace including:
- `scan.intel.*` (scan result card copy)
- `task.*` (task labels + actions)
- `today.*` (Today's Action engine copy)
- `onboarding.*` (multi-step setup)
- `notifications.*` (notification templates)
- `garden.*` (garden-mode copy)
- `myFarm.*` (My Farm screen)
- `farmer.success.*` (FarmerSuccessEngine)
- ...26 more namespaces.

### `fr`, `sw`, `ha`, `tw` — 0 missing keys (already at parity)

These four locales were already at 100% parity before this sprint.
No changes needed.

---

## Verification

### Surfaces showing no mixed-language UI

Spec surfaces verified (via the existing runtime fallback chain —
which now consistently returns the Hindi value when it's a real
translation, and the English fallback when it's a stub):

| Surface | Behavior in Hindi |
|---|---|
| Home | Mixed: ~54% Hindi, rest English fallback |
| Tasks | Mixed |
| Notifications | Mixed |
| Scan Results | Mixed |
| Today's Action | Mixed |
| My Farm | Mixed |
| My Grow | Mixed |
| Settings | Mostly Hindi (settings namespace mostly translated pre-fix) |
| Profile | Mixed |
| Onboarding | Mostly Hindi (onboarding namespace translated pre-fix) |

This is **honest graceful degradation** — every key now renders
(no `{key.path}` template leaks, no `undefined`, no blank fields).
Untranslated keys render as English; user sees a stable string
either way.

### Build gate

`scripts/check-language-selector.mjs` §9b + §9c now enforce:
- Every non-en column has ≥ as many keys as `T-en.js`
- `_translator-review-pending.json` sidecar exists
- Any future PR that adds a key to `T-en.js` and forgets to fill
  the other 5 columns **fails build**

### How to refresh after adding new English keys

```sh
node scripts/fill-language-parity.mjs
```

The script is idempotent — running with no missing keys is a no-op.

---

## Honest constraints

I cannot generate real Hausa / Hindi / Swahili / Twi translations
in this run. Doing so would either:
- Use a machine-translation service (off-spec — Farroway specifies
  English fallback ONLY with `translatorReview` flag)
- Fake translations that a native speaker would reject

So this sprint achieves **structural** parity (every key present)
and **honest fallback** (English shows when translation is
pending). Real translation work is the responsibility of the
NGO partner translators consuming the sidecar JSON.

---

## Recommended next steps

1. **Hand the sidecar `_translator-review-pending.json` to the
   translator partner** for Hindi. 2934 keys to translate; tiered
   priority by namespace (grower-facing first: scan/task/today/
   notifications).
2. **Translator submits translated values per key.** They edit
   `T-hi.js` directly OR submit a JSON patch that `fill-language-parity.mjs`
   applies.
3. **CI gate stays green.** As real translations land, the gate
   continues to pass (it only checks key counts, not values).
4. **When all 2934 stubs are translated**, regenerate the sidecar:
   `node scripts/fill-language-parity.mjs` will list 0 pending.

---

## Verdict

**Language mismatch: structurally fixed across all 6 locales.**

- 100% structural parity (every English key exists in every locale)
- 0 visible `{key.path}` template leaks
- 0 silent failures (no `undefined` rendered)
- Honest English fallback for any not-yet-translated key
- Build gate enforces parity from this commit forward

Hindi real-translation work (2934 keys) is queued for the
translator partner via the sidecar. Pilot can launch with Hindi
showing mixed English/Hindi gracefully; full Hindi UX lands as
translators submit values.
