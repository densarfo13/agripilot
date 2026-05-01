# Farroway — Full Go-Live Audit

**Date:** 2026-05-01
**Auditor:** Engineering (claude code)
**Scope:** Whole platform across all 5 user roles
**Verdict:** **READY WITH MINOR RISKS**

---

## 0. Summary

This is the comprehensive go-live audit covering every shipping
role: Farmers, Backyard / Home-Garden growers, Buyers, NGO /
Program admins, and Platform admins. It supersedes the earlier
`FINAL_APP_STORE_AUDIT.md` (which focused on App Store review)
by including buyer + admin + NGO surfaces explicitly.

The platform is in solid shape. ~85% of the surface area was
already shipped + flag-flipped to default-on across the prior
audit batches. This audit found 3 ship blockers (now fixed) and
4 minor risks (documented + monitored). No new features were
added — every change was a surgical fix for a broken flow.

---

## 1. Roles audited

| Role | Entry path | Landing | Bottom nav |
|---|---|---|---|
| Farmer (commercial) | `/start` → FarmerEntry | `/dashboard` (V2Dashboard) | FARM_TABS (Home, Farm, Tasks, Progress, Funding, Sell) |
| Backyard / Home Garden | `/start` → US chooser → `/onboarding/backyard` | `/dashboard` | BACKYARD_TABS (Home, My Garden, Tasks, Progress, Ask, Scan) |
| Buyer | `/marketplace` (public) → `/market/browse` (auth) | `/market/browse` | none — no farmer nav rendered (ProtectedLayout `isFarmer` gate) |
| NGO / Program admin | `/v1/login` → V1 Layout `/applications` | `/ngo` (NGOOverview) | V1 admin sidebar (Layout.jsx) |
| Platform admin | `/v1/login` → V1 Layout `/` | `DashboardPage` → admin/* routes | V1 admin sidebar |

Confirmed both auth chains coexist without loops:
- V2 cookie auth (`AuthContext.bootstrap`) — farmer + backyard + buyer
- V1 Bearer auth (`ProtectedRoute`, zustand userStore) — NGO + admin
- V1↔V2 bridge effect at App.jsx:332-337 keeps zustand in sync
  with cookie session for the farmer role.

---

## 2. Issues found + fixes applied

### 2.1 [SHIP BLOCKER → FIXED] /help, /contact, /privacy, /terms required a session

**Found:** All four legal/help routes were nested inside the
`<Route element={<V2ProtectedLayout />}>` block at App.jsx:650
despite a comment claiming they were public. AuthGuard +
ProfileGuard forced unauthenticated visitors (App Store reviewers,
deep-links from emails, anyone tapping Privacy in the footer)
through the login flow before they could read these pages.

**Fix:** Moved the four route definitions to the public block
above `/pricing` (App.jsx:651-664) and stubbed in-place comments
where the duplicates used to live. Now reachable without auth
or profile.

**Files touched:** `src/App.jsx`

### 2.2 [SHIP BLOCKER → FIXED] Backyard users could reach Sell + Funding via direct URL

**Found:** `BottomTabNav` correctly hides Sell + Funding tabs
for backyard users, but the underlying routes (`/sell`,
`/opportunities`, `/funding`) had no experience guard. A backyard
user clicking a stale push notification, sharing a link, or typing
the URL would land on the farmer-only commerce surfaces. Sell
in particular has no internal experience check.

**Fix:** New `BackyardGuard.jsx` wrapper that reads
`shouldUseBackyardExperience(country, farmType)` from
ProfileContext and redirects to `/home` (replace) when true.
Wraps `/sell`, `/opportunities`, `/funding` in App.jsx. Fires
`backyard_guard_redirect` analytics so we can measure stale-link
hits.

**Files touched:**
- `src/components/system/BackyardGuard.jsx` (new)
- `src/App.jsx` (3 route wrappers + import)

### 2.3 [SHIP BLOCKER → FIXED] RecoveryErrorBoundary was unmounted

**Found:** `src/components/system/RecoveryErrorBoundary.jsx`
existed with the three required buttons (Repair session, Restart
setup, Clear local cache) but was not wired into the app.
`main.jsx` wrapped `<App />` only in the simpler
`components/ErrorBoundary.jsx` which lacks recovery options.
A runtime exception inside any feature page would show a generic
"something went wrong" rather than the recovery card.

**Fix:** Nested `<RecoveryErrorBoundary>` directly inside
`<LanguageRegionGate>` so all post-boot rendering is protected.
The outer `<ErrorBoundary>` stays as the last-resort catch for
truly fatal pre-render errors (createRoot, AppSettingsProvider).

**Files touched:** `src/main.jsx`

### 2.4 [Resolved earlier — confirmed during this audit]

- `/scan-crop` redirects to `/scan` (App.jsx:870, prior commit)
- Duplicate `/start` mount removed (prior commit)
- SW update banner mounted globally (prior commit `f197c2f`)
- `repairSession` stamps `farroway_onboarding_completed=true`
  when a farm exists (prevents returning-user onboarding loop)
- 401/403/404 boot paths log at `console.log`, not `console.error`
- Camera-denied path promotes Upload from gallery to primary CTA

---

## 3. Files changed in this audit

```
src/App.jsx                                          (route relocation + 3 BackyardGuard wraps + import)
src/components/system/BackyardGuard.jsx              (new — 56 lines)
src/main.jsx                                         (RecoveryErrorBoundary nested inside LanguageRegionGate)
src/docs/FULL_GO_LIVE_AUDIT.md                       (new — this file)
src/docs/GO_LIVE_TEST_CHECKLIST.md                   (new — manual smoke checklist)
```

No backend changes. No i18n keys added (the recovery card already
ships its keys; BackyardGuard has no visible text). No feature
flags added — guards are unconditional fixes.

---

## 4. Region / language / currency / units

Confirmed the rules live in the canonical engines and the
audit found no leaks:

| Country | Experience | Currency | Units | Engine |
|---|---|---|---|---|
| Ghana | farm | GHS | metric (kg / ha) | regionResolver + regionConfig |
| Kenya | farm | KES | metric | regionResolver + regionConfig |
| Nigeria | farm | NGN | metric | regionResolver + regionConfig |
| US — backyard | garden | USD | imperial-simple (sq ft / lb) | shouldUseBackyardExperience + regionConfig |
| US — farm | farm | USD | acres / lbs | regionResolver + regionConfig |
| Unknown | generic | USD fallback | metric default | regionUXEngine generic branch + RegionBannerHost |

Language: BCP-47 map verified — en→en-US, hi→hi-IN, fr→fr-FR,
sw→sw-KE, ha→ha-NG, tw→ak (Akan). 6 launch languages. Voice
stack respects the same map.

---

## 5. Help / Contact / Privacy / Terms reachability

After fix 2.1:

| Route | Auth required? | Renders |
|---|---|---|
| `/help` | No | HelpPage |
| `/contact` | No | ContactPage |
| `/privacy` | No | PrivacyPolicy |
| `/terms` | No | Terms |

All four reachable from every role without a session. Footer
links + App Store reviewer deep-links now work without forcing
a login.

---

## 6. Offline + error recovery

| Capability | Status | Delivered by |
|---|---|---|
| Cached profile fallback when API 404s | ✓ | FarmerDashboardPage 404 handler |
| Offline banner with sync status + pending count | ✓ | OfflineBanner + OfflineSyncBanner |
| SW new-version banner | ✓ | SWUpdateBanner (commit f197c2f) |
| Auto-flush on reconnect | ✓ | syncCoordinator + attachAutoSync |
| 3-button recovery card on runtime error | ✓ (FIXED 2.3) | RecoveryErrorBoundary nested in main.jsx |
| Corrupted localStorage tolerated | ✓ | every store wraps reads in try/catch |

---

## 7. Mobile go-live readiness

| Item | Status |
|---|---|
| Safe-area-inset-bottom respected on iOS | ✓ (BottomTabNav + SWUpdateBanner) |
| Keyboard does not cover focused input | ✓ (`scroll-margin-bottom: 96px` global) |
| Camera permission denied → gallery fallback | ✓ (`ScanCapture.jsx` Permissions API + visual demote/promote) |
| iOS Safari camera capture (`<input capture="environment">`) | ✓ |
| Service worker registers + auto-updates | ✓ (`registerServiceWorker.js` + SWUpdateBanner) |
| PWA installable (manifest + 192/512/maskable icons) | ✓ |

---

## 8. Listing statuses (sell flow)

| Status | Set by | Surface |
|---|---|---|
| `ACTIVE` | `saveListing` default | Marketplace, /sell summary, BrowseListingsPage |
| `SOLD` | farmer marks complete | Marketplace filter, /sell summary |

Note (minor risk 5): no `pending` admin-moderation status and
no `expired` automatic sweep. If the operator dashboard later
needs moderation queue or staleness expiry, it's an additive
extension to `marketStore.js` — not a launch blocker because the
current flow already works end-to-end.

---

## 9. Remaining risks (not blockers)

1. **Auth dual-store fragility** — V1/V2 bridging at App.jsx:332-337
   has been stable through prior audits. Smoke test "logout in tab
   A, refresh tab B" remains on the manual checklist.
2. **No listing expiry sweep** — listings stay ACTIVE until the
   farmer marks SOLD. Stale listings on Marketplace are theoretical
   for v1; will revisit if buyers report it.
3. **Backyard guard relies on profile** — if the profile load
   races the route mount, a backyard user could see one frame
   of the farmer surface before the redirect fires. Acceptable
   given the protected-layout already had the user authenticated.
4. **Live iOS device tests pending** — every check above is
   verified in DevTools / Vite preview. Real-device sign-off is
   on `GO_LIVE_TEST_CHECKLIST.md`.

---

## 10. CI gates passed

```
npm run launch-gate:final     # PASS — 0 i18n misses, 0 missing crops
npm run guard:crops           # PASS — 272 references (baseline)
npm run guard:i18n            # PASS — 100% across 6 launch langs
npm run guard:crop-render     # PASS
npm run build                 # PASS — Vite SW versioned bundle
```

---

## 11. Final verdict

**READY WITH MINOR RISKS.**

Three ship blockers (legal-route gating, backyard-route leak,
unmounted recovery boundary) were closed. The four remaining
risks are operational — they need monitoring, not code. The
platform is shippable to farmers, backyard growers, buyers,
NGO admins, and platform admins on day 1.
