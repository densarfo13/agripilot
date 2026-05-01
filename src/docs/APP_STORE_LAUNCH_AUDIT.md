# App Store launch audit — Farroway

Honest pre-submission audit of every flow listed in the launch
spec. The verdict is at the bottom.

> **Scope of this document.** I cannot run the app on a real iOS / Android device from this shell. Everything below is a code-level audit — I read each surface, checked it against the spec rules, and recorded what I found. Mobile-only behaviour (camera permission prompts, location permission, safe-area insets, etc.) needs an in-device pass before final submission.

---

## 1. Inventory — what's already shipped (across prior commits)

| Spec area | Surface | Commit landed | Notes |
|---|---|---|---|
| §1 Auth / session restore | `AuthContext.bootstrap` + `farroway:session_cache` + `ProtectedRoute` waiting for `authLoading` | 92861fc (hotfix) | Fixed login-loop and crash-on-reload bugs. |
| §1 Error boundary | `src/components/ErrorBoundary.jsx` | 92861fc | CommonJS `require()` masked the real error in the recovery path; replaced with dynamic `import()`. Reload calls `window.location.reload()` only. |
| §1 Strict i18n + tStrict | `src/i18n/strictT.js` + `useStrictTranslation.js` | 116546b → cde1422 | Three farmer pages opted in (Progress / Tasks / MyFarm). HOTFIX `_looksMissing` heuristic (92861fc). |
| §1 Region UX | `src/core/regionUXEngine.js` + `RegionBanner` + `getNavigationItems` | 55133f6 | Farm / backyard / generic experience resolution. Feature-flag gated. |
| §1 Funding Hub | `/funding` route + catalog + recommendation engine + readiness card + NGO pilot CTA | 55133f6 → 223dcef | Three feature flags: `fundingHub`, `smartFundingRecommendations`, `ngoPartnershipLeads`. |
| §1 Voice + offline + low-literacy | `voiceEngine`, `VoiceButton`, `OfflineSyncBanner`, `IconActionCard`, `LowLiteracyToggle` | 116546b | Three-tier voice fallback; offline queue with idempotency + backoff. |
| §1 Lightweight feedback | `QuickFeedback`, `PulseQuestion`, `analyticsStore`, `feedbackGate` | 223dcef | Gated on ≥2 uses + 24h cooldown. Behavior tracking gated separately. |
| §1 Crop normalization gate | `guard:crops` baseline 272 | multiple | All raw `cropType` reads route through `getCropLabelSafe(value, lang)` or the new `cropLabel` wrapper. |
| §1 Buyer route exposed | `/buyers` widened to `[...STAFF_ROLES, 'investor_viewer']` | cde1422 | Voice command "buyers" wired. |

## 2. Bugs found and fixed during this audit

### 2.1 `repairSession()` was unused

`src/utils/repairSession.js` and `src/core/sessionBootstrap.js` were shipped but never imported by any surface. A returning user with a stale or partial localStorage state would have hit the dashboard with no auto-repair pass.

**Fix:** Wired `repairSession()` into `AuthContext.bootstrap` as Step 0a (runs BEFORE the cached-session restore). Lazy-imported so a corrupted repair module can never break boot. Dev console logs the actions performed.

### 2.2 No `/contact`, `/privacy`, `/terms` routes existed

App Store submission requires reachable in-app Contact + Privacy + Terms surfaces. The HelpPage existed but had no pair.

**Fix:** Created `ContactPage.jsx`, `PrivacyPolicy.jsx`, `Terms.jsx` with localized copy. Wired three new routes (`/contact`, `/privacy`, `/terms`) **public** (no ProtectedRoute wrap) so App Store reviewers can hit them without a session.

## 3. Items already correct — verified during audit

These were reviewed and **no fix needed** — they already meet the spec:

- **§5 Home screen layout** — `FarmerTodayPage` + `FarmerHomePage` already render the spec'd above-fold set (greeting, today's plan, ask, scan, weather). No duplicated weather panels found in the rendered tree.
- **§6 Region UX** — `regionUXEngine` correctly resolves Ghana → farm, US + backyard → backyard, unknown → generic. `RegionBanner` self-hides when no message is needed.
- **§7 Bottom navigation** — `BottomTabNav` already swaps `FARM_TABS` ↔ `BACKYARD_TABS` via `shouldUseBackyardExperience`. Backyard variant hides Sell. Funding tab points at `/funding` when feature flag on.
- **§8 Help routes** — `/help` exists at `src/pages/HelpPage.jsx`. `/contact` added in this commit.
- **§9 Localization** — `tStrict` returns `''` rather than English when a key is missing in non-English UI; the strict opt-in is live on Progress / Tasks / MyFarm.
- **§14 Funding Hub** — three flags gate the Smart Funding shape; recommendation cap is 5; NGO pilot form persists locally via `submitPilotLead`.
- **§16 Error boundary** — handles dynamic-import analytics safely; reload calls `window.location.reload()` only and does not clear storage.
- **§17 Offline / low bandwidth** — OfflineSyncBanner, syncManager with retry budget, localStore namespaced under `farroway:store:*`, abandoned-not-deleted recovery.
- **§19 Analytics events** — `analyticsStore.trackEvent` records `app_open`, `view_daily_plan`, `voice_used`, `funding_viewed`, `scan_used`, `feedback_submitted`, `pulse_feedback_submitted`. All gated on `behaviorTracking`.

## 4. Spec items deliberately out of scope for this audit

Each requires UX / product owner review and significant code surgery beyond a stability audit. They are not launch blockers IF the existing surface already works (verified during audit).

| § | Item | Why deferred |
|---|---|---|
| §5 Home redesign with above-fold-only layout | The existing `FarmerTodayPage` already follows the pattern; further simplification needs a product designer in the loop. |
| §10 Daily Plan refactor | `dailyIntelligenceEngine` already produces 3-action plans with title / reason / urgency / Mark done. No regression observed. |
| §11 Weather refactor | Existing weather components (`FarmWeatherCard`, etc.) already de-duplicate and gracefully fall back. |
| §12 Scan flow refactor | `CameraScanPage` handles permission denial, fallback, and history. |
| §13 Ask Farroway open-ended chat | Spec explicitly says "Do not enable open-ended AI chat unless already stable." Existing keyword-mapped voice navigator is the correct shipping shape. |
| §15 Sell flow | Existing `regionConfig.enableSellFlow` gate is correct; backyard nav already hides Sell. |
| §18 Mobile-device audit | Cannot verify safe-area insets / camera prompts / keyboard overlap from this shell. Needs in-device pass. |
| §22 Acceptance test execution | Same — the seven scenarios listed need a real device. The code paths each scenario traverses have been read; none are obviously broken. |

## 5. Files modified in this audit pass

| File | Change |
|---|---|
| `src/context/AuthContext.jsx` | New Step 0a in `bootstrap()`: lazy-imports + runs `repairSession()` before cache restore. Dev-mode console logs the actions performed. |
| `src/App.jsx` | Lazy imports for `ContactPage`, `PrivacyPolicy`, `Terms`. Three new public routes: `/contact`, `/privacy`, `/terms`. |
| `src/pages/ContactPage.jsx` | NEW — minimal mailto-based support landing. Localized via tStrict. |
| `src/pages/PrivacyPolicy.jsx` | NEW — starter copy covering Location, Camera, Analytics, Account data. Marked as "review with legal before public release". |
| `src/pages/Terms.jsx` | NEW — starter copy with funding disclaimer + user content section. Marked as "review with legal before public release". |
| `src/docs/APP_STORE_LAUNCH_AUDIT.md` | NEW — this document. |
| `src/docs/APP_STORE_SUBMISSION_CHECKLIST.md` | NEW — companion submission checklist. |

## 6. Remaining launch risks

Before App Store submission, the following must be done outside this audit:

1. **Legal review of Privacy + Terms.** The starter copy lives at `/privacy` and `/terms`. Replace before going live.
2. **In-device manual pass on iOS + Android.** §22 scenarios A–G must each be executed on a real device. The code paths have been audited; runtime is what matters for App Store reviewers.
3. **App icon, screenshots, App Store Connect listing.** Outside the codebase. See `APP_STORE_SUBMISSION_CHECKLIST.md`.
4. **Camera permission reason string** in the iOS Info.plist / Android manifest. Wording must match what `CameraScanPage` actually does ("Take crop or plant photos to track your harvest").
5. **Location permission reason string.** Same — must reflect that Farroway uses it for region UX + weather only.
6. **Support email DNS + inbox** (`support@farroway.app`). Verify it routes to a monitored inbox before submitting.
7. **Production environment variables** — `DATABASE_URL`, `JWT_SECRET`, `VITE_API_BASE_URL`, plus optional Twilio / SendGrid keys for SMS / email. Currently flagged as "missing locally" by `guard:env`; expected to be set in Railway / hosting before deploy.
8. **Backend availability.** App is built local-first and degrades gracefully when offline, but a backend that's permanently unreachable would gradually degrade the experience. Verify production backend is up before submission.

## 7. Final test checklist (manual, in-device)

The seven §22 scenarios are the canonical pre-submission run:

- **A. New Ghana farmer** signs up → onboarding → Home → Today's Plan → Scan → Funding → Sell-if-enabled
- **B. Returning Ghana farmer** logs in → lands on Home (NOT setup) → active farm loads
- **C. U.S. backyard user** picks United States → Home Garden → "My Garden" wording → no Sell in main nav → "Take Plant Photo"
- **D. Unknown country** → app does not crash → generic plan renders → region message shows → English fallback works
- **E. GPS denied** → manual country picker continues onboarding
- **F. Backend unavailable** → farm saves locally → user enters Home → pending-sync banner appears
- **G. Corrupted localStorage** → repair session works → app does not lock the user out

Run each on a real device. Failure of any is a launch blocker.

## 8. Verdict

**READY WITH MINOR RISKS.**

Reasoning:
- Login loop is fixed (commit 92861fc). ✅
- Farm setup redirect works (sessionBootstrap + repairSession now wired). ✅
- Dashboard does not crash because activeFarm is null (existing defensive reads + repairSession safety net). ✅
- Onboarding completes (verified by reading flow; not run in-device). ⚠ in-device verification pending
- Home loads (existing FarmerTodayPage). ✅
- Mobile flow works — code-level audit clean; in-device pass not yet performed. ⚠
- No critical broken links — `/help`, `/contact`, `/privacy`, `/terms`, `/funding`, `/buyers` all wired. ✅

The "minor risks" are item §6.1–§6.8 above. None of them require code changes; they are operational / legal / platform-config tasks that block submission until resolved.

**Do not promote to READY** until §6.1, §6.2, §6.3 are complete (legal review of policy + terms; in-device run of §7 scenarios; App Store Connect listing assets uploaded).
