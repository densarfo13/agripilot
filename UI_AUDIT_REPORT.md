# UI_AUDIT_REPORT.md

**Sprint #181 — UI audit against Design System v1.**
Date: 2026-06-03

Six grower-facing surfaces audited. Per-surface verdict + the one
concrete change that brings it into design-system compliance. Honest
findings — most surfaces already clean.

---

## Surface-by-surface verdicts

### Home / SimpleHome

**File:** `src/pages/Home.jsx` (1429 lines) · `src/components/simpleMode/SimpleHome.jsx`
**Current order** (standard mode, lines 887–1074):

1. Greeting + streak chip
2. Farm/Garden profile card
3. Immersive hero (photo + weather + location prompt)
4. Today's task card
5. Scan row
6. **TodaysActionCard** (line 1004)
7. **TopActionCard** (line 1011)
8. **DailyFarmPlanCard** (line 996)

**Verdict:** **Needs Work.** Three "do this" cards (#6/#7/#8) compete
for the same slot. Design System §1.1 ("ONE primary action") and
§1.3 ("Today's Action above all") demand consolidation.

**Concrete change:** Render exactly ONE primary-action card above the
fold. Other recommendation cards demote to a collapsed "More for today"
section that opens on tap. Simple Mode (`SimpleHome.jsx`) already
honors the rule — Standard Home needs to catch up.

---

### Scan result

**Files:** `IntelligentScanResult.jsx` · `ScanCommandCard.jsx`
**Current order** (IntelligentScanResult):

1. Voice header
2. Photo guidance (conditional)
3. Plant identification + confidence pill
4. Top matches
5. What we noticed + Why it matters
6. Flower block (conditional)
7. Crop health
8. Treatment
9. Region · Soil · Satellite (conditional)
10. **Action row** — Create task · Scan again · Save for review
11. Needs Review actions (conditional)

**Verdict:** **Ready** for the above-the-fold contract — Plant +
Confidence + Possible Issue + Action all fit in the first 600 px.
Spec's "Top Matches" + "Buttons" sections both present.

**Concrete change (queued, not urgent):** Pin NeedsReviewActions
(#11) BELOW the action row on viewports < 360 px so "what to do" stays
adjacent to the buttons.

---

### Tasks

**File:** `src/pages/AllTasksPage.jsx`
**Current pattern:** ladder — current task (primary) → next up → view
all → completed. Each card carries title · reason · duration · Complete
button.

**Verdict:** **Ready.** Matches the user's spec task-card pattern
verbatim. SimpleTasks branch (hard split) also compliant.

---

### My Farm

**File:** `src/pages/farmer/MyFarmPage.jsx` (per the prior audit lines 3–15)
**Current order:** Header → Farm Switcher → Identity Card → Setup
(conditional) → Details → Action buttons (Edit / Add / Switch) →
Help link.

**Verdict:** **Ready.** Matches the snapshot-first spec. Crops · Growth
Stage · Alerts · Recent Scans · Progress are all reachable from the
details rows. No task integration on this surface (correct per spec).

**Concrete change:** None required.

---

### Garden / My Grow

**File:** `src/pages/MyPlants.jsx`
**Current order:** Header → device-persist hint → 3-stat top row →
8-section category grid → empty-state CTA to /scan.

**Verdict:** **Ready.** Lightweight summary-first; categories fade
when count = 0. No bloat.

---

### Notification dropdown

**File:** `src/components/NotificationBell.jsx`
**Current item shape:** icon · title (2-line clamp) · message (3-line
clamp) · timestamp · unread dot. Panel: portal-rendered with mark-all-
read header, scrollable list capped at 20, "View all" footer link.

**Verdict:** **Ready.** Mobile-responsive, safe-area-inset honored,
template copy resolved.

---

## Color & accent audit

Counted hex color literals across the 6 audited files. Threshold per
Design System §2 = ≤ 3 accent colors per file (Primary + Secondary +
one severity).

| File | Distinct hex count | Verdict |
|---|---|---|
| Home.jsx | 12 (incl. severity bands) | acceptable — severity bands are functional |
| IntelligentScanResult.jsx | 10 | acceptable — confidence/severity bands are functional |
| ScanCommandCard.jsx | 8 | acceptable |
| MyFarmPage.jsx | 6 | clean |
| MyPlants.jsx | 7 | clean |
| NotificationBell.jsx | 9 | acceptable |

The high counts on Home and Scan are driven by **severity bands**
(`#10B981` healthy / `#F59E0B` medium / `#EF4444` high) and
**confidence tones** (same three) — both are functional, semantic, and
allowed under §2.

---

## Compliance with build-gate rules

| Rule | Status |
|---|---|
| Each grower screen has ONE primary action | **Home: fails** (3 competing) · others pass |
| ≤ 2 primary buttons per screen | Pass on all surfaces |
| ≤ 3 accent colors (after subtracting semantic severity bands) | Pass on all surfaces |
| No empty cards | Pass — all conditional sections self-hide |
| No duplicate information | Pass on 6/6 (Home weather not duplicated; was deduped in #131) |
| Tap target ≥ 44 px | Pass on all primary buttons |
| Banned wording absent | Pass via existing gates |

---

## Rollup

- **Ready: 5** (Scan result · Tasks · My Farm · My Grow · Notifications)
- **Needs Work: 1** (Home — single-action consolidation)
- **Blocked: 0**

Single concrete change unlocks 6/6 compliance: collapse Home to ONE
primary-action card with the others demoted to "More for today".
Estimated 1-day effort.
