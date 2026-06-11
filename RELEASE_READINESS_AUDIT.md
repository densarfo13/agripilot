# RELEASE_READINESS_AUDIT.md

**Sprint #185 — pilot release readiness audit.**
Date: 2026-06-12
Scope: 7 critical areas. No code changes. Honest scoring.

---

## Scorecard

| # | Area | Score / 100 | Verdict |
|---|---|---|---|
| 1 | Language | **95** | Ready |
| 2 | Scan | **95** | Ready |
| 3 | Today's Action | **75** | Ready with polish gap |
| 4 | Mobile UX | **85** | Ready (live verification recommended) |
| 5 | Notifications | **95** | Ready |
| 6 | Auth | **80** | Ready with one gap |
| 7 | Performance | **80** | Ready (static); needs RUM post-launch |

**Weighted average: 86 / 100.**
**Final verdict: READY for pilot launch.** 3 polish items tracked
below — none block launch.

---

## Area 1 — Language

**Score: 95 / 100 · READY**

### What works
- Selector mounted on 6 surfaces (verified by static gate
  `check-language-selector`):
  - Login (`src/pages/Login.jsx` brand row, sprint #182)
  - Signup (`src/pages/FarmerRegisterPage.jsx` brand row, sprint #184)
  - Onboarding (`src/onboarding/StepLanguage.jsx`, pre-existing)
  - Home + any page (`PageActions.jsx` 🌐 button → BottomSheet,
    sprint #183)
  - Profile (`src/pages/ProfileSetupPage.jsx`, sprint #184)
  - Settings (`SettingsDrawer` inside `ProtectedLayout.jsx`)
- 6 spec languages registered (`src/i18n/supportedLocales.ts:39-60`):
  en · fr · sw · ha · tw · hi
- Live switch verified end-to-end in sprint #182 preview:
  `en → ha` flipped `documentElement.lang` instantly; Login page
  text changed from "Welcome back" → "Barka da dawowar ka",
  "Email" → "Imel", "Password" → "Kalmar sirri".
- Persistence: profile (PATCH `/api/users/me`) + localStorage
  (`farroway:lang`) + recent-3 list (`farroway:recentLanguages`)
  + session event broadcast (`farroway:langchange`).
- `window.__languageHealth()` returns healthy envelope.

### Findings

#### LOW · L1.1 — Hindi coverage at ~54%
- **File:** `src/i18n/columns/T-hi.js`
- **Impact:** Hindi shows English fallback for ~46% of strings.
- **Fix:** Translator-review queue exists; doesn't block pilot.

---

## Area 2 — Scan

**Score: 95 / 100 · READY**

### What works
- 4 NEVER-DO invariants gated repo-wide
  (`scripts/check-universal-scan.mjs` §7b):
  - `Plant: —` impossible when candidates exist
  - "Unknown Plant" forbidden alongside `topCandidates`
  - 100% certainty wording banned
  - `confidence` + `nextAction` always present in envelope
- Provider chain (`server/src/app.js` `/api/scan/analyze`):
  Plant.id → PlantNet → Insect.id → Internal library → Farm context
- Envelope v6 carries 15 required fields + `objectType` + `issueType`
  (`server/src/ml/scanRecoveryEnvelope.js`)
- IntelligentScanResult render order matches spec
  (`src/components/scan/IntelligentScanResult.jsx:669-776`):
  Plant → Confidence → Top matches → What we noticed → Why it matters
  → Crop health → Treatment → Region/Soil/Satellite → Action row
- `window.__scanDetectionHealth()` + `window.__universalScanHealth()`
  both return healthy envelopes.

### Findings

#### LOW · L2.1 — NeedsReviewActions render order on narrow viewports
- **File:** `src/components/scan/IntelligentScanResult.jsx:769-775`
- **Line range:** 769-775
- **Impact:** On viewports < 360 px the NeedsReviewActions card
  renders BELOW the action row, splitting "what to do" from
  the buttons.
- **Fix:** Pin NeedsReviewActions above the action row, or move
  inline action buttons into NeedsReviewActions when low-confidence.

---

## Area 3 — Today's Action

**Score: 75 / 100 · READY with polish gap**

### What works
- Today's Action Engine shipped in sprint #173:
  `src/runtime/dailyAction/RecommendationEngine.ts`
- `window.__todaysActionHealth()` and `__dailyActionHealth()` both
  pinned at boot.
- Task creation + follow-up + outcome path persisted
  (`server/src/ml/followUpEngine.js` with offsets 3/7/14 days).
- KPI funnel measured in `__pilotAnalyticsHealth`.

### Findings

#### HIGH · H3.1 — Home stacks 3 competing primary actions
- **File:** `src/pages/Home.jsx`
- **Line range:** 996-1011 (TodaysActionCard, TopActionCard,
  DailyFarmPlanCard all render above the fold)
- **Impact:** Spec calls for ONE primary action above the fold;
  farmer sees three "do this" cards competing for the same slot.
  This was identified in sprint #180 (UX_FRICTION_REPORT.md H1)
  and remains the single biggest UX gap.
- **Fix:** Promote ONE card (highest-scored Today's Action) above
  the fold; demote others to a "More for today" collapsible
  section. ~1 day of focused UI work.
- **Pilot impact:** Does NOT block launch — farmer still completes
  the right action because each card surfaces a real one. Polish
  item, queued for sprint #186.

---

## Area 4 — Mobile UX

**Score: 85 / 100 · READY (live verification recommended)**

### What works
- 4+ existing mobile-safety gates green in `build:safe`:
  `check-mobile-safe-area`, `check-mobile-blockers`,
  `check-scan-mobile-permanent`, `check-mobile-production-navigation`,
  `check-ios-camera-init`, `check-ios-scan-startup`
- Selector + sheet 16 px font (no Safari zoom-on-focus)
- `safe-area-inset-bottom` honored on BottomSheet + bottom nav
- Tap targets ≥ 44 × 44 px per Design System §4
- Bottom-nav clearance 96 px
- Portal patterns prevent z-index / overflow clipping

### Findings

#### MEDIUM · M4.1 — No live iPhone Safari / Android Chrome verification this audit
- **File:** —
- **Impact:** Static gates pass, but live mobile verification was
  not run in this audit pass. Prior verification (sprint #182)
  used a desktop preview at viewport 1280. Real-device tests on
  iPhone 12 / Pixel 6 not captured in this session.
- **Fix:** Before pilot: spot-check Login + Home + Scan result +
  Notifications on one iOS + one Android device. ≤ 1 hour.

---

## Area 5 — Notifications

**Score: 95 / 100 · READY**

### What works
- Portal-rendered dropdown (`src/components/NotificationBell.jsx`)
  shipped in sprint #146 with mobile gutters + safe-area-inset.
- Mark-read + mark-all-read present (line ~135).
- Scrollable list capped at 20 with "View all" footer link to
  `/notifications` (sprint #183 added count when > 20).
- Template-resolved copy (no `{crop}` placeholder leaks per
  `check-template-placeholders`).
- Opens related item via `to` link on each item.

### Findings
None at this severity. Notification dropdown matches spec.

---

## Area 6 — Auth

**Score: 80 / 100 · READY with one gap**

### What works (6 of 7 flows present)
- **Signup**: `/register` → `src/pages/Register.jsx` + draft persistence
- **Login**: `/login` → `src/pages/Login.jsx` with email + phone OTP +
  MFA branch + cookie-based session
- **Logout**: `src/utils/logout.js:51-88` reachable from
  `SettingsDrawer` (`ProtectedLayout.jsx:272-281`)
- **Password reset**: `/forgot-password` + `/forgot-password/sms` +
  `/reset-password` routes wired
- **Invite flow**: `/accept-invite` → `AcceptInvitePage.jsx` validates
  token (7-day expiry, single-use); server-side at
  `server/src/modules/invites/routes.js`
- **Farmer onboarding**: `src/onboarding/StepLanguage.jsx` +
  `FarmerTypeScreen.jsx`; persists via `useDraft()`; lands at `/home`

### Findings

#### MEDIUM · M6.1 — Gardener onboarding shares farmer flow
- **File:** `src/pages/onboarding/FastOnboarding.jsx`
- **Impact:** No distinct garden-setup steps (`StepGardenType`,
  `StepGardenPlants`). Gardeners go through the farmer flow and
  see farm-specific copy ("What are you growing?" framed for
  field crops).
- **Fix:** Add 2 garden-specific steps OR conditional copy
  branching when garden mode is selected at Step 0. ~1 day.
- **Pilot impact:** Gardeners complete onboarding successfully;
  copy mismatch is mild. Does NOT block launch.

---

## Area 7 — Performance

**Score: 80 / 100 · READY (static); needs RUM post-launch**

### What works (static metrics)
- Bundle 2812 KB raw / 865 KB gzip (`check:bundle-budget` PASS,
  budget 3000 / 1100 KB).
- 11 eager chunks; lazy routes via `React.lazy` + Suspense.
- Pre-rendered service-worker shell; cache-recovery via
  `__cacheRecoveryHealth`.

### What's not measured here
Spec targets (< 2 s first load, < 1 s scan render, < 300 ms
notification open) cannot be verified from a static audit — they
need real-user metrics (RUM) or synthetic load tests against
production.

### Findings

#### MEDIUM · M7.1 — No real-user performance instrumentation
- **File:** none specific; opportunity
- **Impact:** Bundle size is the only hard performance signal.
  TTI, scan-result render time, and notification open time are
  not measured.
- **Fix:** Wire `web-vitals` reporting to an analytics endpoint
  for LCP / FID / CLS / INP. ~½ day.
- **Pilot impact:** Pilot scale (~50-200 users) won't generate
  meaningful RUM volume anyway. Implement post-pilot for the
  next 1000-user cohort.

---

## All findings, ranked

| # | Severity | Area | Title |
|---|---|---|---|
| H3.1 | **HIGH** | Today's Action | Home stacks 3 competing CTAs |
| M4.1 | MEDIUM | Mobile UX | No live device verification this audit |
| M6.1 | MEDIUM | Auth | Gardener onboarding shares farmer flow |
| M7.1 | MEDIUM | Performance | No real-user instrumentation |
| L1.1 | low | Language | Hindi at ~54% coverage |
| L2.1 | low | Scan | NeedsReviewActions order on narrow viewports |

**Zero Critical-severity findings.**

---

## Verdict

# **READY for pilot launch · 86 / 100.**

The single HIGH finding (Home single-action) is a polish item that
sprint #180 already documented and scoped for sprint #186 work.
Every blocker contract from the prior 9 sprints is enforced by a
build gate (`build:safe` 284 sequential steps green).

### What's not in scope but worth knowing
- The 3 pre-pilot follow-ups (Home consolidation, Gardener onboarding
  copy, RUM instrumentation) total ~2.5 days of focused work.
- Pilot suppressions still active: no marketplace payments, no
  public investor dashboard, no fake intelligence, no chemical
  dosages, all banned wording (Confirmed / Guaranteed / 100%
  accurate / Plant: — / Unknown Plant / "Camera ran into a
  problem") forbidden by multiple gates.

### Recommended pilot launch sequence
1. **Day 0** — deploy current `master` (commit `22116194`).
2. **Day 0** — spot-check Login + Home + Scan + Notifications
   on one iPhone + one Android (closes M4.1).
3. **Days 1-7** — collect pilot feedback; do NOT touch H3.1
   until you've seen real grower behavior.
4. **Day 7+** — sprint #186 lands Home single-action + Gardener
   onboarding copy + RUM if needed.
