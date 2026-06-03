# SCAN_PRODUCTION_ROOT_CAUSE.md

**Sprint #179 — Production blocker root-cause trace + fix.**

Date: 2026-06-03
Commit: `fix(scan): eliminate plant dash and unknown fallback`

---

## Symptoms reported

Production still renders, after the Scan Recovery Sprint:

- `Plant: —`
- `Unknown Plant`
- `Needs Review`

---

## Pipeline trace (ONE real scan)

| Stage | Module / endpoint | Output (real scan) |
|---|---|---|
| **Upload** | `POST /api/scan/upload` → Cloudinary | `imageUrl` returned |
| **Plant.id** | `server/src/ml/providers/plantIdProvider.js` | candidates: `Array<{commonName, scientificName, score}>` |
| **PlantNet** | `server/src/ml/providers/plantNetProvider.js` | candidates: `Array<{commonName, scientificName, score}>` |
| **Consensus** | `server/src/ml/scanConsensusEngine.js` → `runConsensus()` | merged + deduped + scored `candidates` |
| **Envelope** | `server/src/ml/scanRecoveryEnvelope.js` v5/v6 | `topCandidates`, `plantName` (with `'Needs confirmation'` / `'Scan unclear'` floor), `nextAction`, `objectType`, `issueType` |
| **API response** | `POST /api/scan/analyze` | v5/v6 envelope mirrored at top level + nested under `scanRecovery` |
| **UI render** | `src/components/scan/ScanCommandCard.jsx` ← consumes `scanRecovery` envelope | **BROKEN** — line 81 read `{plantName || '—'}` and line 73 read `{plantName || tSafe('scanCommand.unknownPlant', 'Plant')}` |

### 6-question answer

| # | Question | Answer |
|---|---|---|
| 1 | Did Plant.id return candidates? | Yes |
| 2 | Did PlantNet return candidates? | Yes |
| 3 | Did consensus receive candidates? | Yes — `candidates` array populated |
| 4 | Did API send candidates? | Yes — `topCandidates` mirrored at response root in `app.js` |
| 5 | Did UI receive candidates? | Yes — `result.topCandidates.length > 0` |
| 6 | **Why did UI render `Plant: —`?** | **`ScanCommandCard.jsx:81` baked `{plantName || '—'}` directly.** When `plantName` arrived empty (because legacy verdict path had not yet been replaced) the JSX expression evaluated the bare em-dash, ignoring the `topCandidates` array entirely. The prior sprint #176 fix patched only `IntelligentScanResult.jsx`; the gate did not extend to `ScanCommandCard.jsx`. |

---

## Root cause

**File:** `src/components/scan/ScanCommandCard.jsx`

**Lines (pre-fix):**

```jsx
// Line 73 — title header
<h2 style={S.title}>{plantName || tSafe('scanCommand.unknownPlant', 'Plant')}</h2>

// Line 81 — Plant row value
<span style={S.rowValue}>
  {plantName || '—'}
  ...
```

**Broken field:** `plantName` — the component derived it only from
`result.plantName || result.commonName`, with no fallback to
`result.topCandidates[0]`. When the envelope's plantName floor
hadn't been applied (legacy code path), the OR-fallback `'—'`
rendered directly to the screen.

The check-scan-detection-permanent gate enforced the rule only on
`IntelligentScanResult.jsx`, so `ScanCommandCard.jsx` shipped to
production with the regression.

---

## Exact fix

**File:** `src/components/scan/ScanCommandCard.jsx`

```jsx
// Resolution ladder — plantName is NEVER empty:
//   1. real plantName (any non-empty species name)
//   2. top candidate common/scientific name (if candidates present)
//   3. 'Needs confirmation' (when candidates exist but no name)
//   4. 'Scan unclear'      (when no signal at all)
const _topCandidates = _arr(result.topCandidates);
const _topCand = _topCandidates[0] || null;
const plantName =
     rawPlantName
  || _str(_topCand && (_topCand.commonName || _topCand.name))
  || _str(_topCand && _topCand.scientificName)
  || (_topCandidates.length > 0 ? 'Needs confirmation' : 'Scan unclear');

// Header — bare value (resolved fallback ladder already applied)
<h2 style={S.title}>{plantName}</h2>

// Plant row — NEVER bare '—' (the resolved ladder is the source of truth)
<span style={S.rowValue}>
  {plantName}
  ...
```

---

## Gate extension (prevents regression)

`scripts/check-universal-scan.mjs` §7b now scans the full set of
grower-facing scan UI files and fails the build if ANY of these
forbidden patterns appears in a non-comment line:

- `plantName || '—'` / `commonName || '—'`
- `plantName || 'Unknown Plant'` / `commonName || 'Unknown Plant'`
- Literal `'Plant: —'` / `"Plant: —"` JSX text

Covered files:
- `src/components/scan/ScanCommandCard.jsx`
- `src/components/scan/ScanResult.jsx` (if present)
- `src/components/scan/IntelligentScanResult.jsx`
- `src/components/scan/NeedsReviewActions.jsx`
- `src/pages/ScanPage.jsx`
- `src/pages/ScanResultPage.jsx`

Admin-only / labelling pages (e.g. `src/pages/admin/ScanLabPage.jsx`)
are excluded — those are reviewer-facing dashboards, not grower UI.

---

## Verification

- [x] `build:safe` — 283 steps green, gate §7b passing
- [x] No file in the protected list contains `plantName || '—'` or
  `plantName || 'Unknown Plant'`
- [x] `ScanCommandCard.jsx` resolved `plantName` ladder verified at
  lines 53-69
- [x] Commit: `fix(scan): eliminate plant dash and unknown fallback`

---

## Lessons

1. **Gate scope follows the spec, not the file.** When a rule says
   "the UI must never render X," the gate must scan **every** UI
   file that participates in that render path — not just the one
   the sprint touched.
2. **Server invariants are not enough.** Even when the envelope
   guarantees a non-empty `plantName`, a UI component that wraps
   that field in `|| '—'` will defeat the invariant on any code
   path that bypasses the envelope. The fallback ladder belongs
   on the UI side too.
