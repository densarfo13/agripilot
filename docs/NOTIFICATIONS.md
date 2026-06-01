# Farroway Daily Notification Production Fix

Adds production-grade daily notifications so farmers, gardeners, NGO field
officers, and buyers are reminded at the right time — without spam, fake
delivery, or duplicate reminders, and **without blocking the app** when
notification permission is denied.

> Notifications are OPTIONAL. The app works without them.

---

## 1. Files created
Runtimes — `src/runtime/notifications/` (self-contained, frozen, never throw,
zero deep imports; READ-ONLY DIAGNOSTIC + CONTRACT over the existing
`src/lib/notifications/*` JS surface):
- `notificationContracts.ts` — types + constants (8 notification types,
  default quiet hours 21:00–06:00, default reminder time 07:00, rate limits
  1/2/1, storage keys, provider keys, `validateNotification` rejects
  exact-date guarantees + PII).
- `NotificationPreferences.ts` → `__notificationPreferencesHealth`. Per-type
  toggles for all 8 kinds, quiet hours, timezone, reminder time, permission
  state, `isInQuietHoursNow`. NGO + buyer alerts default OFF (role-scoped).
- `NotificationDelivery.ts` → `__notificationDeliveryHealth`. Provider
  config readiness (web push / FCM / Twilio / SendGrid). **`fakeDelivery`
  is a hard-coded literal `false`** that no code path can flip. Read-only —
  never sends, never marks anything "sent".
- `NotificationScheduler.ts` → `__notificationQueueHealth`. Rate limits
  (1 daily plan / 2 task / 1 weather per day, severe weather bypass),
  duplicate prevention via idempotency keys, quiet-hours enforcement,
  offline queue + stale expiry + reconnect-sync.
- `NotificationRuntime.ts` → `__notificationHealth` + `__notificationOODAHealth`
  + `__notificationArtifactHealth`. Composite reads the 3 sub-probes by name;
  the artifact composite enumerates the 5 spec kinds (`NotificationScheduled`,
  `NotificationSent`, `NotificationFailed`, `NotificationSkipped`,
  `NotificationClicked`).

UI:
- `src/pages/settings/NotificationSettingsPage.jsx` (route `/settings/notifications`)
  — enable, reminder time, timezone, quiet hours, per-type toggles, permission
  prompt; never blocks when permission denied; persists to
  `farroway_notification_prefs_v2`.

i18n:
- `src/i18n/notificationTranslations.js` — 7 namespaces (notifications /
  dailyPlanNotif / tasksNotif / weatherNotif / harvestNotif / ngoNotif /
  buyerNotif), English base; other locales fall back (translator-review).

Gates (`scripts/`, all wired into `build:safe`):
`check-notification-runtime`, `check-notification-preferences`,
`check-notification-scheduler`, `check-notification-duplicates`,
`check-notification-localization`, `check-notification-privacy`,
`check-notification-ooda-artifacts`.

`docs/NOTIFICATIONS.md`.

## 2. Files modified
- `src/App.jsx` — boot installs the 4 install fns (composite last) + the
  `/settings/notifications` route + lazy `NotificationSettingsPage`.
- `src/i18n/index.js` — imports + empty-slot-merges the notification overlay.
- `src/pages/Settings.jsx` — adds a "Manage notification preferences" link to
  the new page.
- `package.json` — 7 gates registered + wired into `build:safe`.

## 3–9. Per-section summary
- **Notification runtime (§1)**: 8 types, all 6 globals installed, app
  unaffected when permission denied, OODA non-blocking, 5 artifact kinds.
- **Preferences (§2)**: defaults match spec (daily plan / tasks / follow-up /
  weather / harvest ON; quiet 21:00–06:00; reminder 07:00; NGO + buyer OFF).
  Persists to `farroway_notification_prefs_v2`. Permission-denied banner is
  informational only.
- **Daily plan reminder (§3)**: rate-limited to 1/day via `idempotencyKey =
  daily_farm_plan:<userId>:<yyyy-mm-dd>`. Quiet-hours respected. Localized.
- **Tasks + follow-up scan (§4–5)**: max 2 task reminders/day; follow-up
  reminders idempotent by `scanId + followUpDate`. Cancelled if outcome
  already recorded.
- **Weather + harvest (§6–7)**: weather alerts only when actionable; max
  1/day unless severity:'severe'. Harvest templates use approximate language —
  no guaranteed date.
- **NGO + buyer (§8–9)**: NGO alerts org-scoped, summary form, no
  cross-org leakage. Buyer alerts carry no private farmer data (gate
  rejects PII placeholders in templates).
- **Delivery providers (§10)**: web push / FCM / Twilio / SendGrid detected
  via client config presence (window globals or meta tags). Missing provider
  marks unavailable; **never fakes "sent"**.

## 10. OODA + artifact integration (§12)
`__notificationOODAHealth` declares `nonBlocking:true`, `growerSafe:true`,
`observeReady`/`orientReady`/`decideReady`/`actReady`. `actReady` requires
`d.fakeDelivery === false`. `__notificationArtifactHealth` enumerates the 5
spec kinds and enforces idempotency-key + duplicate-prevention; ArtifactRuntime
is the only path (no direct network).

## 11. Localization (§13)
7 namespaces shipped English-only; tw / ha / fr / sw / hi fall back. Templates
never hard-coded — every render site goes through `tSafe(key, english)`.

## 12. Governance checks added (in `build:safe`)
- `check-notification-runtime` — composite, optional, 8 types, honest.
- `check-notification-preferences` — full toggles, defaults, page persistence.
- `check-notification-scheduler` — rate limits 1/2/1, quiet hours, dedup.
- `check-notification-duplicates` — idempotency keys, daily plan capped 1/day.
- `check-notification-localization` — 7 namespaces, page via tSafe.
- `check-notification-privacy` — fakeDelivery false, no PII, approximate harvest.
- `check-notification-ooda-artifacts` — non-blocking, 5 kinds, idempotent.

## 13. Result
Notifications are wired, optional, rate-limited, quiet-hours-aware,
idempotent, organization-scoped, privacy-safe, and ArtifactRuntime-routed.
The app keeps working when permission is denied. No new architecture layer,
no fake "sent", no spam.
