# PRODUCTION_RUNTIME_FAILURE.md

Evidence-only root-cause of the "Scan temporarily unavailable" screen that persisted
**after** the previous fix. No speculation — every claim below is backed by the deployed
bundle, Railway production logs, or a faithful client render of the exact production envelope.

---

## Deployed commit / bundle (STEP 1 — production IS current)

| Fact | Value | Source |
|---|---|---|
| Live deployment | `e819cdce-a1bb-4dd6-b592-f535907836a6` — SUCCESS, 2026-07-04 20:29 EDT | `railway status` / `railway deployment list` |
| Deployed commit | `81b8cabf` (hooks guard), on top of `87da3e4b` (previous "fix") | `git log` |
| Entry HTML bundle | `assets/index-Cq3xIKib.js` (1.24 MB) | fetched `https://www.farroway.app/` |
| Scan route chunk | `assets/ScanPage-BlWOG5AS.js` (199 KB) — **the founder's device loaded this exact file** | Railway log, 2026-07-05T00:35:57Z |
| Founder scans | 2026-07-05T00:37 & 00:38 UTC (= 20:37/20:38 EDT) — **after** the 20:29 deploy | Railway log |

**Production is NOT running an old bundle.** The founder scanned on the current deploy and it still failed.

---

## Why the previous fix changed nothing

The previous session declared `PhotoComparisonCard.jsx:43` (an early return between hooks) the
root cause and fixed it. **That component is dead code.** Nothing imports it; it is tree-shaken
entirely out of the deployed output:

- `grep` for any importer of `PhotoComparisonCard` in `src` → **zero** hits.
- Deployed bundle scan for its endpoint `/api/outcomes/photo-pair` and `recordPhotoPair` → **absent**.

A hook-order bug in a component that never mounts cannot produce a production crash. The previous
fix corrected code that is not in the render path — which is exactly why the fallback persisted.

---

## The exact exception (STEP 2 & 3)

```
ReferenceError: STYLES is not defined
    at AddPlantConfirmationCard (src/components/plants/AddPlantConfirmationCard.jsx:110:19)
    at renderWithHooks (react-dom/cjs/react-dom.development.js:15486)
    at mountIndeterminateComponent (react-dom …:20103)
    at beginWork (react-dom …:21626)
```

Captured by client-rendering the **exact live scan result subtree** (`ScanCommandCard` +
`ScanResultErrorBoundary`>`IntelligentScanResult` + `AddPlantConfirmationCard`, wrapped in the real
`LanguageProvider`) against the **real production envelope** — the same `/api/scan/analyze` 200
response the founder received (`conf=low`, 4–5 candidates). Repro:
`scripts/repro-live-result-tree.mjs`.

- **file:** `src/components/plants/AddPlantConfirmationCard.jsx`
- **line:** `110` (and 111, 112, 113, 115, 120 — the whole low-confidence branch)
- **component:** `AddPlantConfirmationCard`, rendered unconditionally by `ScanPage` for every
  `phase === 'result'` as a **sibling** of the result boundary — so its throw bubbles past the
  result-scoped boundary to the page-level `ScanErrorBoundary` → "Scan temporarily unavailable".

### Proof the broken code is in the RUNNING bundle
`assets/ScanPage-BlWOG5AS.js` (the deployed chunk the device loaded) contains, verbatim:
```js
…Review:r}){if(!ls(e))return null;if(Ja(e))return t.jsxs("div",{style:STYLES.card,"data-testid":"add-plant-unconfirmed",…
```
`Ja(e)` is the minified `isUnconfirmedScan(scanResult)`. `STYLES` survives minification as a literal
identifier **because it was never declared** — a minifier cannot rename a free variable. The real
style constant in that file is `S` (defined at line 47). So:

> low-confidence scan → `isUnconfirmedScan` true → this branch renders → `STYLES.card` reads a
> property off an undefined global → `ReferenceError` thrown during render → fallback screen.

This matches the founder's telemetry exactly: `plantid HTTP 200 conf=low` → `POST /api/scan/analyze
200` → analytics `scan_completed` fires (it runs right after `setPhase('result')`, before the crash)
→ then a hard reload of `/scan?mode=camera` (server-served HTML, = `ScanErrorBoundary`'s
`window.location.reload()`).

---

## One-line fix

`src/components/plants/AddPlantConfirmationCard.jsx`, lines 110–121: `STYLES` → `S` (6 references).
`S` already defines every key the branch uses (`card`, `header`, `meta`, `actions`, `btnPrimary`,
`btnSecondary`). Verified: re-running `scripts/repro-live-result-tree.mjs` after the change renders
the low-confidence tree **CLEAN** — no throw, no boundary trip.

---

## Why the 410-gate build:safe never caught it

ESLint `no-undef` was disabled (`eslint.config.js:16` — deferred "broaden the lint surface" TODO).
The rules-of-hooks guard added last session is the wrong guard for a free-variable ReferenceError.
Permanent fix: `scripts/check-no-undef-render.mjs` (wired into `build:safe`) runs `no-undef` and
ratchets — any NEW undefined identifier fails the build; would have caught `STYLES`.

### Residual (same crash class — honest ledger)
`no-undef` finds **41** remaining offenders repo-wide, including farmer-facing render-path
ReferenceErrors that will crash their screens the same way: `plant` undefined in
`src/pages/PlantProfile.jsx` (357/409/452), `lang` undefined in `CropSelect.jsx`,
`FarmerDetailPage.jsx`, `FarmersPage.jsx`, `AdminControlPage.jsx`, `ApplicationDetailPage.jsx`,
`setForm` in `NewApplicationPage.jsx`. The ratchet baseline is 41 (can only fall); these are the
next burn-down, prioritised by user impact.
