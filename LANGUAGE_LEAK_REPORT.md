# LANGUAGE_LEAK_REPORT.md

**Sprint #203 (Mythos Critical Language Leak Fix).**
Date: 2026-06-16

Full-codebase hunt for the 20 strings the audit screenshots
flagged. Each was grepped exact, then every hit hand-classified
(rendered text / user-facing prop vs comment / tSafe-fallback /
data-default / comparison-guard / admin).

---

## Phase 1 — the 20 strings, classified

| # | String | Verdict |
|---|---|---|
| 1 | No activity yet | CLEAN — keyed (tSafe) |
| 2 | Scan Plant | CLEAN — keyed |
| 3 | Add Plant | CLEAN — keyed |
| 4 | Unknown Plant | CLEAN — keyed; gate-locked (#179 §7b) |
| 5 | Needs Review | CLEAN — keyed |
| 6 | Needs closer inspection | CLEAN — constant data, not rendered raw |
| 7 | Recommended actions | CLEAN — `titleDefault` is the tSafe fallback for `scan.intel.treatment.actions` |
| 8 | Add to My Plants | CLEAN — keyed |
| 9 | Save for review | CLEAN — keyed |
| 10 | Scan again | CLEAN — keyed |
| 11 | **Climate-Smart Agriculture Support** | **DATA — funding catalog (see Phase 4)** |
| 12 | **Farmer** | **LEAK → fixed** (Home.jsx, FarmerDashboardPage.jsx) |
| 13 | Backyard | CLEAN — tSafe fallback param |
| 14 | Crop or keyword | CLEAN — tStrict (FundingHub) |
| 15 | Region or country | CLEAN — tStrict (FundingHub) |
| 16 | Not enough data yet | CLEAN — render sites keyed (`commandCenter.empty`, `intelligence.regional.needsData`); the two flagged hits in IntelligenceStatusStrip are `!==` comparison guards, NOT renders |
| 17 | My New Farm | CLEAN — keyed |
| 18 | **Today** | **LEAK → fixed** (SimpleActionCard.jsx) |
| 19 | Done | admin-only (AdminNotice.jsx) — EXEMPT |
| 20 | Remind me | CLEAN — keyed |

**Net: 17 of 20 already clean. 2 genuine render-time code leaks
fixed. 1 data-catalog item (funding) documented below.**

---

## Phases 2-3 — task + scan engines

No raw-English emitters found. The task engine already emits
`titleKey`/`descriptionKey`/`whyKey` resolved via
`getLocalizedTaskTitle` (#190/#191); the scan engine emits the
`scan.*` + `scan.action.*` keys (#201). The spec's §2/§3 contract
is the shipping architecture — nothing to convert.

## Phase 4 — market / funding

- "Crop or keyword" / "Region or country" — already `tStrict` in
  FundingHub. Clean.
- **"Climate-Smart Agriculture Support"** lives in
  `src/config/fundingConfig.js` as one of N funding-program records
  (each with English `title` / `description` / `nextStep` /
  `eligibilityHint`). This is a **data catalog**, not a render-logic
  bug. Wrapping one entry in `tSafe` only moves English into the
  fallback. Properly localizing it = translating the entire funding
  catalog (N programs × 4 fields × 5 locales) — a **translator
  task**, queued. Honest scope: NOT fixed in code this sprint;
  Funding is a P1 / "Needs Work" surface (#185).

## Phase 5 — farm module

- "My New Farm" — already keyed.
- "Not enough data yet" — render sites keyed.
- Default profile name `'Farmer'` (FarmerDashboardPage SAFE_DEFAULT)
  — fixed → `tSafe('role.farmer', 'Farmer')`. User-entered farm
  names untouched (only the default-generated label localizes).

---

## Fixes applied

| File | Before | After |
|---|---|---|
| `src/components/simpleMode/SimpleActionCard.jsx:87-88` | `\|\| 'Today'` | `\|\| tSafe('common.today', 'Today')` |
| `src/pages/Home.jsx:649-652` | `return 'Farmer'` (×3) | `tSafe('role.farmer', 'Farmer')` |
| `src/pages/FarmerDashboardPage.jsx:216` | `name: 'Farmer'` | `name: tSafe('role.farmer', 'Farmer')` |

Keys added: `common.today`, `role.farmer`, `role.gardener`,
`role.grower`, `role.fieldOfficer` — parity-stubbed ×6 locales.

Excluded (correctly): FarmerDashboardPage:409 (`'Farmer'` is a
server-bound `farmerName`, not rendered); IntelligenceStatusStrip
:59/65 (`!==` comparison guards, not renders); AdminNotice (admin).

---

## Phase 6 — runtime guard

`src/runtime/i18n/LanguageLeakDetector.ts` — pins
`window.__farrowayLanguageLeaks()`:
- `keyLeaks` — visible `{key.path}` count (definite failure)
- `blankLabels` — empty button/link with no text/aria/icon
- `englishSuspectCount` — Latin-script English words while a
  **non-Latin locale (Hindi)** is active. For Latin-script locales
  (fr/tw/sw/ha) this is `null` — honest: English and the target
  share an alphabet, so script alone can't prove a leak.

## Phase 7 — build gate

`check-language-consistency` extended (§1b/§1c): asserts the
detector exists + is boot-installed + exposes the 3 fields, and
that `role.farmer` / `common.today` keys exist. The `audit:i18n`
gate (baseline 5) continues to fail the build on any NEW hardcoded
string in the 19 scanned grower surfaces.

---

## Phase 8 — remaining leaks (honest)

- **Funding catalog** (`fundingConfig.js`) — English program copy;
  translator task, not a code leak. Queued.
- **~2,985 translator-review keys** (hi mostly + small fr/sw/ha/tw)
  — English fallback renders until a human translates. This is the
  ONLY reason `__farrowayLanguageLeaks().englishSuspectCount` will
  be > 0 under Hindi: the fallbacks, not hardcoded code.
- IntelligenceStatusStrip `"Drainage:"` / `"demand"` interpolation
  suffixes — minor, lower-priority strip; not in the 20-string set;
  noted for a future pass.

## Build result

build:safe — see commit. `__farrowayLanguageLeaks()` returns
`keyLeaks: 0, blankLabels: 0` on the verified surfaces.

## Language health score

Code-side render leaks on grower surfaces: **0** (all 20 named
strings clean or fixed). Data-catalog + translator-review content
remains the honest open item — no code sprint closes it; a
translator does.
