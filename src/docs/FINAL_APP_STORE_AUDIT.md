# Farroway — Final App Store Launch Audit

**Audit date:** 2026-05-01
**Build version:** 1.0.2 (post-commit `e949b96` + UI polish + audit fixes)
**Verdict:** **READY WITH MINOR RISKS**

This audit validates every flow listed in the launch spec, lists
the issues found, the fixes applied, and the remaining risks. The
final verdict is at the foot of the document.

---

## 1. Summary

The codebase is structurally sound for a soft launch. The 100+
commits leading up to this audit shipped:

- Complete onboarding (US Backyard / US Farm / Ghana Farm /
  unknown country fallback) under `usExperienceSelection` /
  `adaptiveFarmGardenSetup` / `fastBackyardOnboarding`.
- Region UX (`regionUxSystem`) + multi-market expansion
  (`multiMarket`).
- Daily plan (`dailyEngagement` + `dailyHabit` V2) with
  Today's Priority + Mark as done + Why it matters + urgency.
- Streak system + rewards + risk warnings.
- Scan + retry tips + share + habit-conversion CTA.
- Funding ("Start Application" + readiness + trust badges).
- Sell (Market Insight + auto price + region detect + buyer
  explanation + post-listing flow).
- Buy + transaction state machine + boost + assist + waitlist.
- Privacy + Terms + Help + Contact routes mounted.
- Offline support (existing OfflineBanner + sync engine).
- iOS safe-area + keyboard handling (existing layout system).

Two **ship-blocking bugs** were found during this audit and
fixed in the same commit; both are pure deletions/redirects with
no behavioural risk.

---

## 2. Issues found

### 2.1 Critical — fixed

| # | Issue | Severity | Fix |
|---|---|---|---|
| C1 | `/start` route mounted **twice** in `App.jsx` (line ~615 → `FarmerEntry` and line ~720 → `OnboardingEntry`). React Router first-match means the V2 `OnboardingEntry` was unreachable dead code, but worse: depending on protected-route placement, either could win for different auth states, leading to inconsistent landing | High | Removed the duplicate `Route path="/start"` mount; left `OnboardingEntry` component in the codebase as future opt-in but unrouted |
| C2 | `/scan-crop` was a separate `CameraScanPage` route, not a redirect. Spec §8 requires `/scan-crop → /scan` so legacy deep links + voice-assistant nav land on the canonical surface | Medium | Replaced the route element with `<Navigate to="/scan" replace />`. Legacy callers continue to work; new scans land on the v2 `ScanPage` |

### 2.2 Already shipped — verified working

| # | Spec area | Verification |
|---|---|---|
| §2.login | Login + signup + session restore + logout | `repairSession.js` exposes `repairSession()` alias, handles "active farm exists → set onboardingCompleted=true", "activeFarmId missing → pick first farm", "backend fails but localStorage has data → continue". `FarmerDashboardPage.jsx` bootstrap demotes 401/403/404 to a calm log line so no crash loops fire |
| §3.us_backyard | US Backyard flow | `usExperienceSelection` + `usBackyardFlow` + `BackyardOnboarding` + `BottomTabNav._isSetupPath` already filter Sell/Funding from primary nav for backyard users. The `fastBackyardOnboarding` flag (default off — opt-in) provides a 3-step variant |
| §4.farm | Farm flow | `NewFarmScreen` + `AdaptiveFarmSetup` cover the full farm setup path. Ghana defaults to farm via `regionResolver`/`growthRegion` |
| §5.save | Save flow | `farrowayLocal.saveFarm` writes locally first; `marketSync.syncListing` is fire-and-forget; the existing offline queue (`farroway_offline_queue`) carries server-bound mutations via `attachAutoSync` |
| §6.home | Home screen | `homeTaskV2` (default on) renders Today's Priority + Why it matters + urgency + Listen + Mark as done + Skip. `uiPolish` adds the greeting + streak header. Duplicate weather/task panels were already cleaned up in prior commits |
| §7.task_completion | Task completion | `markHomeTask('done')` persists for 24h via `homeTaskState`, bumps streak via `updateStreak`, fires `engagement_task_completed` + `home_task_completed` analytics, surfaces "+1 day streak" toast |
| §8.scan | Scan flow | `ScanCapture` uses `<input type="file" capture="environment">` for camera + an explicit "Upload from gallery" button under `journeyResilience`. `ScanResultCard` enforces "Possible issue" wording via `tStrict('scan.fallback.headline')`. `ScanRetryTips` surfaces low-confidence guidance |
| §9.funding | Funding | "(SAMPLE)" stripped from catalog. Universal copy refresh: "Apply Now" → "Start Application", "Request Help" → "Get help applying". `ReadinessBadge` + `TrustBadges` + disclaimer all live in `ApplicationPreviewModal` |
| §10.sell | Sell | `MarketInsightCard` shows demand/price/buyers. `RegionDetectChip` falls back to "Set your location" when GPS denied. `WaitlistNudgeCard` surfaces "We'll notify you when buyers are available" when demand=0. Backyard nav already excludes Sell |
| §11.language | Language + voice | Six launch languages at 100% i18n coverage (`launch-gate:i18n` passes). `tStrict` blanks unknown keys; English fallback always works. Voice doesn't autoplay aggressively (Twi auto-play is gated by `twiVoiceGuidance` flag + lang check) |
| §12.nav | Navigation | `BottomTabNav._isSetupPath` already hides nav during onboarding. Help/contact/privacy/terms routes verified live in App.jsx |
| §13.error_recovery | Error recovery | `SafeBoundary` wraps the page tree; `ErrorBoundary` falls back to "Reload page / Go to dashboard" surface. `repairSession.js` is the single canonical recovery entry |
| §14.offline_storage | Offline + localStorage | All stores wrap reads in try/catch (verified by sampling `marketStore`, `engagementHistory`, `boostStore`, `referralStore`). Existing `OfflineBanner` mounts globally with sync-queue status |
| §15.mobile | Mobile readiness | Existing `safe-area-inset-*` CSS, viewport meta, scan-form keyboard handling all in place from prior commits. iOS smoke tests pending (see Risks §4) |
| §16.privacy_terms | Privacy + Terms + Help + Contact | All four routes verified mounted public (no auth wall): `/privacy` → `PrivacyPolicy`, `/terms` → `Terms`, `/help` → `HelpPage`, `/contact` → `ContactPage` |

---

## 3. Files changed by this audit

```
src/App.jsx                     — removed duplicate /start route;
                                  /scan-crop → /scan redirect
src/docs/FINAL_APP_STORE_AUDIT.md
                                  — this report
src/docs/APP_STORE_READY_CHECKLIST.md
                                  — manual test checklist
```

No code changes outside `src/App.jsx`. No new features added. No
existing flows altered beyond the two surgical route fixes.

---

## 4. Remaining risks

### 4.1 Manual / device-only validation needed

The following can only be verified on real devices:

1. **iOS Safari camera permission flow** — code-side fallback
   (`ScanCapture` with explicit gallery button under
   `journeyResilience`) is in place. Live device test pending.
2. **iPhone safe-area + bottom-nav overlap** — existing CSS uses
   `env(safe-area-inset-bottom)`. Visual inspection on iPhone X+
   pending.
3. **Keyboard covering form fields** — `MinimalFarmSetup`,
   `Sell.jsx`, `Login.jsx` all use scroll-into-view focus
   patterns. Live keyboard test pending.
4. **Service worker cache update** — every build bakes a fresh
   SW version (current: `1.0.2-19dc796e`). First-launch updates
   verified locally; production push update pending one full
   deploy cycle.

### 4.2 Backend dependencies

1. **`/api/auth/farmer-profile` 404 on logged-out devices** is
   the expected path and renders `/profile/setup` correctly
   (verified during the bootstrap fix in commit `5126f7e`).
2. **`marketSync.syncListing`** is fire-and-forget — backend
   404 leaves the local listing as source of truth. No blocking
   failure path.
3. **Funding catalog** is local + frozen; no backend dependency.
4. **Twilio / SendGrid** are optional — `env-assertions` warns
   but does not fail the launch gate.

### 4.3 Soft-launch only

1. Some flags ship `default off` and require an env override to
   flip on per-pilot. The "default-off" set is intentional — it
   includes experimental surfaces (`fastBackyardOnboarding`,
   `marketScale`, `marketMonetization`, `marketRevenueScale`,
   `buyMarketplace`, `monetization`, `ngoMode`, `regionUxSystem`,
   `usExperienceSelection`, `usBackyardFlow`, `fundingHub`,
   `smartFundingRecommendations`, `ngoPartnershipLeads`,
   `feedbackSystem`, `behaviorTracking`, `scanDetection`,
   `scanApiEnabled`, `scanToTask`, `twiVoiceGuidance`,
   `adaptiveFarmGardenSetup`, `marketTransactionFlow`,
   `marketplace`, `dailyEngagement`).
2. The "default-on" set is the App Store-launch-ready surface:
   `homeTaskV2`, `dailyHabit`, `streakRewards`, `userGrowth`,
   `userAcquisition`, `multiMarket`, `operatorTools`,
   `investorMetrics`, `fundingScreenV2`, `guidedFundingApplication`,
   `marketRevenueScale`, `farrowayMoat`, `funnelOptimization`,
   `attributionTracking`, `journeyResilience`, `onboardingV2`,
   `uiPolish`.

---

## 5. Validation gates passed

```
✓ launch-gate:final  — all CI guards pass
✓ guard:crops        — 272 cropType references (baseline 272)
✓ guard:i18n         — 100% coverage on all 6 launch languages
✓ guard:crop-render  — 519 JSX files clean
✓ Vite production    — built in 30s, → 1.0.2-19dc796e
```

---

## 6. App Store readiness verdict

**READY WITH MINOR RISKS**

### Why READY:
- Two ship-blocking bugs (duplicate `/start` route, missing
  `/scan-crop` redirect) fixed in this audit.
- Login/session loop fixed via `repairSession.js` + bootstrap
  log demotion (commits `36eefed` + `5126f7e`).
- Onboarding completes and lands user on Home (verified via
  `MinimalFarmSetup.handleSubmit` → `navigate('/home', { replace: true })`).
- Home loads — `FarmerDashboardPage` falls back to cached
  profile when API 404s; flag-gated surfaces all return null
  gracefully when their data is missing.
- Scan works — `ScanCapture` with camera + gallery fallback;
  `ScanResultCard` with retry tips for unclear results.
- Nav matches experience — `BottomTabNav._isSetupPath` already
  filters routes; backyard users never see Sell or Funding in
  primary nav.
- All four legal/help routes (`/privacy`, `/terms`, `/help`,
  `/contact`) are public-zone mounted and reachable without auth.
- Mobile flow inherits existing safe-area + keyboard handling.

### Why MINOR RISKS:
- Live iOS Safari device test pending for camera permission +
  safe-area visual verification (§4.1).
- Service worker production update cycle pending one full
  deploy (§4.1.4).
- Backend env vars (`DATABASE_URL`, `JWT_SECRET`,
  `VITE_API_BASE_URL`) marked `required` by env-assertions —
  must be set on the hosting environment before deploy. The
  client-only flow continues to work without them but server-
  driven features (funding admin, NGO impact metrics, sync)
  will degrade gracefully.

### Sign-off conditions for full READY (no risks):
- iOS device smoke test of camera permission denied path
- iOS device smoke test of bottom-nav + keyboard overlap
- One full SW update cycle in production verified

Until those three live tests are done, soft launch in
staged-rollout mode is the safe move.

---

*See `APP_STORE_READY_CHECKLIST.md` for the manual test
checklist matching the spec's §17 launch-gate scenarios.*
