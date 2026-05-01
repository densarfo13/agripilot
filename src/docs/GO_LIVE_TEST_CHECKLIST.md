# Farroway — Go-Live Test Checklist

**Companion to:** `FULL_GO_LIVE_AUDIT.md`
**Verdict carried forward:** READY WITH MINOR RISKS

Walk through scenarios A–N on a real device before flipping the
production DNS / pushing the App Store build. Each row lists
the path + expected outcome + delivering file/component.

---

## A. New farmer (Ghana, no US chooser)

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` | regionResolver picks `'farm'`; no US chooser | regionResolver.js |
| Routes to `/farm/new` (NewFarmScreen) | farm setup form, GHS currency, metric units | AdaptiveFarmSetup |
| Save farm → `/home` | Bottom nav: Home / Farm / Tasks / Progress / Funding / Sell | BottomTabNav FARM_TABS |

## B. New U.S. backyard grower

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` → US chooser | Welcome → experience tiles | FarmerEntry + usExperienceSelection |
| Tap **Backyard / Home Garden** | Routes to `/onboarding/backyard` (or `/farm/new` per `adaptiveFarmGardenSetup`) | BackyardOnboarding / GardenSetupForm |
| Save garden → `/home` | Bottom nav: Home / My Garden / Tasks / Progress / Ask / Scan; **no Sell, no Funding** | BottomTabNav BACKYARD_TABS |
| Type `/sell` directly | Redirects to `/home`, fires `backyard_guard_redirect` | **NEW** BackyardGuard |
| Type `/funding` directly | Same redirect | BackyardGuard |
| Type `/opportunities` directly | Same redirect | BackyardGuard |

## C. New U.S. farm user

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` → US chooser → Farm | Routes to `/farm/new` | AdaptiveFarmSetup farm branch |
| Save → `/home` | Bottom nav farmer tabs visible incl. Sell + Funding | BottomTabNav FARM_TABS |

## D. Returning farmer

| Step | Expected | Delivered by |
|---|---|---|
| Close + reopen app | Lands on Home, no setup loop | repairSession + cached profile fallback |
| `/api/auth/farmer-profile` 404 | Falls back to cached profile, calm `[BOOT] bootstrap recoverable` log | FarmerDashboardPage 404 handler |
| Already-completed user never sent back to setup | repairSession.js stamps `farroway_onboarding_completed=true` when farm exists | repairSession.js line 138-143 |

## E. Buyer (public marketplace)

| Step | Expected | Delivered by |
|---|---|---|
| Open `/marketplace` | Public, no login required, lists farmer listings | Marketplace.jsx |
| Tap a listing → contact form | Buyer submits interest; farmer phone never exposed publicly | marketStore.saveBuyerInterest |
| Sign in + open `/market/browse` | Authenticated buyer browse with saved interests | BrowseListingsPage |
| `/buyer/interests` | List of buyer's saved interest forms | MyInterestsPage |
| No farmer bottom-nav rendered over buyer pages | ProtectedLayout `isFarmer` gate keeps nav scoped | ProtectedLayout.jsx line 68 |

## F. Scan flow

| Step | Expected | Delivered by |
|---|---|---|
| Tap Scan in nav | Opens `/scan` (canonical) | ScanPage + redirect from `/scan-crop` |
| Camera allowed | Camera UI opens via `<input capture="environment">` | ScanCapture.jsx |
| Camera denied → upload fallback | Permissions API detects denied → amber hint + Upload button promoted to primary | ScanCapture.jsx (commit f197c2f) |
| Result card shows "Possible issue" | Never says "confirmed disease" | tStrict('scan.fallback.headline') |
| Low-confidence → retry tips | ScanRetryTips appears above ScanContinueCard | ScanRetryTips.jsx |
| Add to Today's Plan | Creates max 2 tasks via scanToTask flag | core/scanToTask.js |

## G. Funding (farmer only)

| Step | Expected | Delivered by |
|---|---|---|
| Farmer opens `/funding` | FundingHub renders 3-5 catalog cards | FundingHub + frozen catalog |
| No "(SAMPLE)" suffix on card titles | Stripped at source | commit afcc398 |
| Card CTA "Start Application" | i18n refresh | funding.applyNow + funding.card.exploreOption |
| Tap Start Application → modal | Readiness score + Quick Apply Kit + trust badges + 3 buttons | ApplicationPreviewModal.jsx |
| Get help applying → form | Window event → OrganizationPilotCTA listener | farroway:open_pilot_help event |
| Disclaimer always visible | Short, calm: "Always confirm details with the program directly." | funding.card.disclaimer |
| Backyard user types `/funding` | Redirected to `/home` (BackyardGuard) | **NEW** |

## H. Sell flow (farmer only)

| Step | Expected | Delivered by |
|---|---|---|
| Farmer opens `/sell` | Sell.jsx renders; price suggestion auto-fills | useAutoPriceSuggestion |
| Region falls back to "Set your location" if GPS denied | RegionDetectChip failed-status branch | useDetectedRegion hook |
| "Not sure yet" qty toggle accepts null | qtyResolved → null when toggle on | Sell V2 |
| List my produce → success card → /home | Saves via canonical saveListing | farrowaySaveFarm chain |
| Listing visible on `/marketplace` | Status `ACTIVE`, no phone leak | marketStore.js:159 |
| Backyard user types `/sell` | Redirected to `/home` (BackyardGuard) | **NEW** |

## I. NGO / Program admin

| Step | Expected | Delivered by |
|---|---|---|
| `/v1/login` with NGO role | Redirects to V1 Layout `/applications` | ProtectedRoute + RoleRoute STAFF_ROLES |
| `/ngo` dashboard | NGOOverview renders impact metrics | NGOOverview + NgoValueDashboard |
| `/applications` | Reviewable application queue | ApplicationsPage gated STAFF_ROLES |
| `/admin/ngo-program` | Program CRUD + farmer roster | RoleRoute |
| Sidebar admin nav (V1 Layout) — no farmer bottom nav | V1 Layout doesn't import BottomTabNav | Layout.jsx |

## J. Platform admin

| Step | Expected | Delivered by |
|---|---|---|
| `/v1/login` with super_admin role | Redirects to V1 Layout `/` | ProtectedRoute |
| `/admin/users` | User management | RoleRoute ADMIN_ROLES |
| `/admin/sync-queue`, `/admin/security`, `/admin/ops`, `/admin/analytics` | All gated ADMIN_ROLES | each route |
| `/admin/intelligence/*` | Crop / region / pest dashboards | nested admin/intelligence routes |

## K. Help / Contact / Privacy / Terms (cross-role public)

| Route | Expected | Delivered by |
|---|---|---|
| `/help` | HelpPage renders without auth | App.jsx public block (FIXED) |
| `/contact` | ContactPage renders without auth | App.jsx public block (FIXED) |
| `/privacy` | PrivacyPolicy renders without auth, mentions camera/photos/location/analytics | App.jsx public block (FIXED) |
| `/terms` | Terms renders without auth | App.jsx public block (FIXED) |

## L. Offline + error recovery

| Step | Expected | Delivered by |
|---|---|---|
| Backend unavailable | Cached Home loads from localStorage | FarmerDashboardPage cached profile fallback |
| Offline edits | attachAutoSync queues mutations | lib/sync/syncEngine.js |
| Offline banner with sync status | Mounts at app root | OfflineBanner.jsx |
| New SW version available | "Reload" banner appears | SWUpdateBanner |
| Runtime exception in any feature page | Recovery card with 3 buttons (Repair / Restart / Clear cache) | RecoveryErrorBoundary (FIXED — now mounted) |
| Corrupted localStorage JSON | All stores try/catch every read | sampled across stores |

## M. Region / language / units

| Country | Currency | Units | Voice locale |
|---|---|---|---|
| Ghana | GHS | kg / ha | sw / tw fallback |
| Kenya | KES | kg / ha | sw-KE |
| Nigeria | NGN | kg / ha | ha-NG |
| US — backyard | USD | sq ft / lb | en-US |
| US — farm | USD | acres / lbs | en-US |
| India | INR | kg / hectare | hi-IN |

## N. Mobile manual smoke

- [ ] iOS Safari: camera permission denied → gallery upload works
- [ ] iOS Safari: bottom-nav not overlapped by safe-area
- [ ] iOS Safari: keyboard does not cover the active form field
- [ ] Android Chrome: scan flow end-to-end
- [ ] Service worker: production update cycle verified
- [ ] All 4 legal routes reachable without sign-in (FIXED)
- [ ] Returning user reopens app → lands on Home, no setup loop
- [ ] Backyard user → no Sell or Funding in primary nav
- [ ] Backyard user typing `/sell` directly → redirected to /home (NEW)
- [ ] Funding "Start Application" modal opens cleanly
- [ ] Sell form submits with auto-priced field
- [ ] Logout in tab A, refresh tab B → both lands on /login (no zombie session)
- [ ] Force a render-time exception → RecoveryErrorBoundary card shows 3 buttons (NEW)

---

## CI gate baseline

```
npm run launch-gate:final
npm run guard:crops      # baseline 272
npm run guard:i18n       # 100% all launch languages
npm run guard:crop-render
npm run build            # Vite → bundle baked + SW versioned
```

All gates must pass before pushing the release tag.
