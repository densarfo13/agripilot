# Farroway — App Store Ready Checklist

**Companion to:** `FINAL_APP_STORE_AUDIT.md`
**Verdict carried forward:** READY WITH MINOR RISKS

This checklist matches the launch spec's §17 scenarios (A–I).
Each item lists the path to follow + the expected outcome + the
file/component that delivers it. Tick as you walk through on
device.

---

## A. New U.S. Backyard user

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` | Welcome → US users see experience chooser | `FarmerEntry` + `usExperienceSelection` flag |
| Tap **Backyard / Home Garden** | Routes to `/onboarding/backyard` (6-step) OR `/farm/new` (single page) depending on `adaptiveFarmGardenSetup` flag | `BackyardOnboarding.jsx` / `GardenSetupForm.jsx` |
| Title reads "Set up your garden" | ✓ | `gardenSetup.title` i18n key |
| Form asks: plant, location, garden size, growing location | ✓ — no commercial farm, no crop stage, no numeric size | `GardenSetupForm` field set |
| Save → Home | `farrowaySaveFarm` + `setActiveFarmId` + onboarding stamp + `navigate('/home', { replace: true })` | `AdaptiveFarmSetup.onGardenSaved` |
| Bottom nav: Home / My Garden / Tasks / Progress / Ask / Scan | No Sell, no Funding | `BottomTabNav` experience filter |
| Refresh app → still on Home | Returning user repair: active farm exists → `repairSession` sets `onboardingCompleted=true` | `repairSession.js` line 138-143 |

## B. New U.S. Farm user

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` → Farm | Routes to `/farm/new` (NewFarmScreen) | `AdaptiveFarmSetup` (farm branch) |
| Title reads "Add New Farm" | ✓ | `NewFarmScreen` i18n |
| Form asks: crop / country / farm type / farm size / unit | Full farm setup | `NewFarmScreen` |
| Save → Home with Sell + Funding visible | ✓ | `BottomTabNav` farm filter |

## C. Ghana farm user

| Step | Expected | Delivered by |
|---|---|---|
| Land on `/start` (no US chooser) | `regionResolver` picks `'farm'` for Ghana | `regionResolver.js` |
| Routes directly to farm setup | Skips US-only experience chooser | `usExperienceSelection` only fires for US |
| Funding + Sell visible in nav | ✓ | `BottomTabNav` farm filter |

## D. Returning user

| Step | Expected | Delivered by |
|---|---|---|
| Close + reopen app | Lands on Home, no setup loop | `repairSession` + `FarmerDashboardPage` cached fallback |
| `/api/auth/farmer-profile` 404 | Falls back to cached profile, calm `[BOOT] bootstrap recoverable` log | `FarmerDashboardPage` 404 handler (commit `5126f7e`) |
| Already-completed user never sent back to setup | Guard at `repairSession.js` line 141-143 ensures stamp is set when farm exists | `repairSession.js` |

## E. Scan

| Step | Expected | Delivered by |
|---|---|---|
| Tap Scan in nav | Opens `/scan` (canonical) | `ScanPage` + redirect from `/scan-crop` |
| Camera permission allowed | Camera UI opens via `<input capture="environment">` | `ScanCapture.jsx` |
| Camera denied → upload fallback | Browser auto-falls back to file picker; new explicit "Upload from gallery" button always visible (under `journeyResilience` flag, default on) | `ScanCapture` second `<input>` |
| Result card shows "Possible issue" | Never says "confirmed disease" | `tStrict('scan.fallback.headline')` |
| Low-confidence result → retry tips | `ScanRetryTips` surfaces above ScanContinueCard | `ScanRetryTips.jsx` |
| Add to Today's Plan | Creates max 2 tasks via `scanToTask` flag | `scanToTask` flag + `core/scanToTask.js` |

## F. Funding

| Step | Expected | Delivered by |
|---|---|---|
| Open `/funding` | Renders `FundingHub` with 3-5 catalog cards | `FundingHub` + frozen catalog |
| No "(SAMPLE)" suffix on titles | Stripped from catalog at source + defensive `_cleanTitle` in card | commit `afcc398` |
| Card CTA reads "Start Application" | Universal i18n refresh | `funding.applyNow` + `funding.card.exploreOption` keys |
| Tap Start Application → modal | Readiness score + Quick Apply Kit + trust badges + urgency + 3 buttons | `ApplicationPreviewModal.jsx` |
| Get help applying → form | Window event hand-off to `OrganizationPilotCTA` listener | `farroway:open_pilot_help` event |
| Disclaimer always visible | Short, not intimidating: "Always confirm details with the program directly." | `funding.card.disclaimer` |

## G. Sell

| Step | Expected | Delivered by |
|---|---|---|
| Farm user opens `/sell` | `Sell.jsx` renders | farm experience |
| Backyard user has no Sell in nav | Filter excludes Sell for backyard | `BottomTabNav` |
| Form auto-fills price suggestion | `useAutoPriceSuggestion` reads `getReferencePrice` | `Sell V2` |
| Region falls back to "Set your location" if GPS denied | `RegionDetectChip` failed-status branch | `useDetectedRegion` hook |
| "Not sure yet" qty toggle accepts null | qtyResolved → null when toggle on | Sell V2 |
| No-demand → "We'll notify when buyers available" | `WaitlistNudgeCard` on Home | `journeyResilience` flag |
| List my produce → success card → /home | Saves via canonical `saveListing` | `farrowaySaveFarm` chain |

## H. Help / Contact / Privacy / Terms

| Route | Expected | Delivered by |
|---|---|---|
| `/help` | `HelpPage` renders, public access | App.jsx line 661 |
| `/contact` | `ContactPage` renders, public access | App.jsx line 733 |
| `/privacy` | `PrivacyPolicy` renders, public access. Mentions camera, photos, location, analytics, user data, local storage | App.jsx line 734 |
| `/terms` | `Terms` renders, public access | App.jsx line 735 |

## I. Offline

| Step | Expected | Delivered by |
|---|---|---|
| Backend unavailable | Cached Home loads from localStorage | `FarmerDashboardPage` cached profile fallback |
| Offline edits | `attachAutoSync` queues mutations | `lib/sync/syncEngine.js` |
| User sees offline banner | Existing OfflineBanner mounts at app root with sync status + pending count | `components/OfflineBanner.jsx` |
| Corrupted localStorage JSON | All stores try/catch every read; corrupted blob returns empty array | sampled across stores |

---

## Manual smoke-test sign-off

- [ ] iOS Safari: camera permission denied → gallery upload works
- [ ] iOS Safari: bottom-nav not overlapped by safe-area
- [ ] iOS Safari: keyboard does not cover the active form field
- [ ] Android Chrome: scan flow end-to-end
- [ ] Service worker: production update cycle verified
- [ ] All 4 legal routes reachable without sign-in
- [ ] Returning user reopens app → lands on Home, no setup loop
- [ ] Backyard user → no Sell or Funding in primary nav
- [ ] Funding "Start Application" modal opens cleanly
- [ ] Sell form submits with auto-priced field

---

## Production env vars required

Set these in the hosting environment before deploy. Local
`launch-gate:final` warns but does not block, since the client-
only flow degrades gracefully:

- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_API_BASE_URL`

Optional (warns, doesn't block):

- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
  / `TWILIO_WHATSAPP_FROM` / `TWILIO_VOICE_FROM`
- `SENDGRID_API_KEY`
- `MFA_SECRET_KEY`

---

## CI gate baseline

Reproduce locally:

```
npm run launch-gate:final
npm run guard:crops      # baseline 272
npm run guard:i18n       # 100% all launch languages
npm run guard:crop-render
npm run build            # Vite → bundle baked + SW versioned
```

All four gates must pass before pushing a release tag.
