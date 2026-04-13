# FINAL PRODUCTION VALIDATION SCRIPT
# AgriPilot — Vite + React (JSX) / Express / Prisma + PostgreSQL

---

# 1. AUTH & SESSION

## AUTH-01 | BLOCKER | Register new user
- **Steps:**
  1. Navigate to `/register`
  2. Fill in fullName, email, password (min 8 chars)
  3. Submit
- **Expected:** 201 response, user row created in DB, httpOnly `access_token` + `refresh_token` cookies set, redirect to `/verify-email` or `/profile/setup`
- **If fails:** Auth route broken, cookie config wrong, or Prisma create failing. Check `POST /api/v2/auth/register` logs and cookie `Set-Cookie` headers.

## AUTH-02 | BLOCKER | Login existing user
- **Steps:**
  1. Navigate to `/login`
  2. Enter valid credentials
  3. Submit
- **Expected:** 200 response, both cookies set with correct `httpOnly`, `sameSite`, `secure` flags, redirect to `/dashboard`
- **If fails:** Password hash comparison broken, cookie not being set, or CORS blocking credentials. Check `POST /api/v2/auth/login` and browser Application > Cookies tab.

## AUTH-03 | BLOCKER | Logout clears session
- **Steps:**
  1. Login successfully
  2. Click logout or call `POST /api/v2/auth/logout`
  3. Try to access `/dashboard`
- **Expected:** Both cookies cleared (maxAge=0), redirect to `/login`, `GET /api/v2/auth/me` returns 401
- **If fails:** `clearAuthCookies` not firing, cookie domain mismatch, or frontend not redirecting on 401.

## AUTH-04 | HIGH | Session persists after refresh and tab reopen
- **Steps:**
  1. Login successfully
  2. Hard refresh the page (Ctrl+Shift+R)
  3. Close tab, open new tab, navigate to app URL
- **Expected:** User remains authenticated both times, `/api/v2/auth/me` returns user data, no redirect to `/login`
- **If fails:** Cookie not persisting (wrong `path` or `domain`), or `credentials: 'include'` missing from fetch calls in `api.js`.

## AUTH-05 | HIGH | Token refresh on 401
- **Steps:**
  1. Login successfully
  2. Wait 15+ minutes (or manually expire `access_token` in DB/cookie)
  3. Trigger any authenticated API call
- **Expected:** `api.js` detects 401, calls `POST /api/v2/auth/refresh`, gets new `access_token`, retries original request transparently
- **If fails:** Refresh token logic in `request()` function broken, or refresh endpoint not issuing new access cookie. User gets logged out unexpectedly.

---

# 2. EMAIL FLOWS

## EMAIL-01 | HIGH | Email verification link works
- **Steps:**
  1. Register a new user
  2. Check inbox (or DB `email_verification_tokens` table) for token
  3. Click verification link or navigate to `/verify-email?token=<token>`
- **Expected:** `emailVerifiedAt` set on user record, success message shown, user can proceed to profile setup
- **If fails:** Token generation broken, SMTP not configured, or verify endpoint not updating user. Check `POST /api/v2/auth/verify-email`.

## EMAIL-02 | HIGH | Forgot password + reset
- **Steps:**
  1. Navigate to `/forgot-password`
  2. Enter registered email, submit
  3. Find reset token (inbox or `password_reset_tokens` table)
  4. Navigate to `/reset-password?token=<token>`
  5. Enter new password, submit
  6. Login with new password
- **Expected:** Reset token created, email sent, new password hash saved, old password no longer works, new password works
- **If fails:** Token expiry too short, SMTP failure, or password hash not being updated. Check `POST /api/v2/auth/forgot-password` and `POST /api/v2/auth/reset-password`.

## EMAIL-03 | MEDIUM | Resend verification
- **Steps:**
  1. Login as unverified user
  2. Call `POST /api/v2/auth/resend-verification`
- **Expected:** New token generated, email sent, old token invalidated
- **If fails:** Rate limiting too aggressive, or old token not being replaced.

---

# 3. PROFILE & FARMER UUID

## PROF-01 | BLOCKER | Incomplete profile redirects to setup
- **Steps:**
  1. Login as user with no farm profile
  2. Navigate to `/dashboard`
- **Expected:** User is redirected to `/profile/setup`, cannot access dashboard until profile is saved
- **If fails:** Profile guard logic in `ProtectedLayout` or `ProfileSetup` not checking profile completeness correctly.

## PROF-02 | BLOCKER | Farmer UUID generated once and never changes
- **Steps:**
  1. Complete profile setup for the first time
  2. Note the `farmerUuid` displayed
  3. Edit profile (change farm name, crop type, etc.)
  4. Save again
  5. Check `farmerUuid` again
- **Expected:** UUID is identical after every edit. UUID is a valid v4 UUID. UUID appears in the profile card on dashboard.
- **If fails:** Backend is regenerating UUID on every save. Check `POST /api/v2/farm-profile` — UUID must only be set if null/undefined.

## PROF-03 | HIGH | GPS success
- **Steps:**
  1. On `/profile/setup`, click "Use My Location"
  2. Allow browser geolocation prompt
- **Expected:** `gpsLat` and `gpsLng` fields populated with coordinates, analytics event `gps.success` tracked
- **If fails:** `navigator.geolocation.getCurrentPosition` callback not wired correctly, or form state not updating.

## PROF-04 | HIGH | GPS denied — manual fallback messaging
- **Steps:**
  1. On `/profile/setup`, click "Use My Location"
  2. Deny the browser geolocation prompt
- **Expected:** Yellow warning box appears with message like "Location permission denied. You can type your location manually below." Analytics event `gps.failed` tracked with `code: 1`.
- **If fails:** GPS error handler not distinguishing error codes, or `gpsError` state not rendering.

## PROF-05 | HIGH | Manual location fallback
- **Steps:**
  1. Leave GPS fields empty
  2. Type "Tamale, Northern Region" in Location field
  3. Save profile
  4. Check weather card on dashboard
- **Expected:** Profile saves successfully. Weather card loads using geocoded location text. "Tamale" or similar appears in weather subtitle. Completion % counts location as filled.
- **If fails:** `computeCompletion` not counting location as GPS alternative, or WeatherContext not falling back to `profile.location`.

## PROF-06 | MEDIUM | Profile completion percentage accuracy
- **Steps:**
  1. Fill only farmerName and farmName
  2. Check completion %
  3. Add location text (no GPS)
  4. Check completion % again
  5. Fill all fields
  6. Check final %
- **Expected:** Increments correctly. Location OR GPS counts as one field. 100% when all fields filled.
- **If fails:** `computeCompletion` field count mismatch.

---

# 4. DASHBOARD & ACTION FLOW

## DASH-01 | BLOCKER | Dashboard loads with all cards
- **Steps:**
  1. Login as user with completed profile and active season
  2. Navigate to `/dashboard`
- **Expected:** All cards render: Welcome header, FarmerIdCard, PrimaryFarmActionCard, SeasonTasksCard, FarmReadinessCard, WeatherDecisionCard, ActionRecommendationsCard, FarmSnapshotCard, SupportCard. No console errors. `dashboard.viewed` analytics event tracked.
- **If fails:** Component import broken, context provider missing, or a card throwing during render. Check browser console.

## DASH-02 | HIGH | Primary action card state transitions
- **Steps:**
  1. Test with incomplete profile — should show "Complete Profile" CTA
  2. Test with complete profile, no season — should show "Start Season" CTA
  3. Test with active season — should show "Continue Season" CTA
- **Expected:** Each state renders the correct card variant with correct button action
- **If fails:** `calculateFarmScore` returning wrong `isReady`, or `useSeason` not returning correct `season` state.

## DASH-03 | MEDIUM | Voice prompt button plays audio
- **Steps:**
  1. Enable auto-voice in settings
  2. Load dashboard
  3. Click any voice prompt button
- **Expected:** Browser SpeechSynthesis speaks the text in the selected language
- **If fails:** `speakText` or `languageToVoiceCode` mapping broken. Non-blocking — voice is an enhancement.

---

# 5. WEATHER & LOCATION

## WTHR-01 | BLOCKER | Weather loads by GPS coordinates
- **Steps:**
  1. Profile has `gpsLat: 5.6037`, `gpsLng: -0.1870`
  2. Load dashboard
- **Expected:** WeatherDecisionCard shows temperature, wind, humidity. No "unavailable" message. Data from Open-Meteo API.
- **If fails:** `GET /api/v2/weather/current?lat=5.6037&lng=-0.1870` failing. Check server logs for upstream fetch errors.

## WTHR-02 | HIGH | Weather loads by text location fallback
- **Steps:**
  1. Profile has no GPS but `location: "Tamale"`
  2. Load dashboard
- **Expected:** Server geocodes "Tamale" via Open-Meteo geocoding API, returns weather + `resolvedLocation: "Tamale"`. Weather card shows data with location name in subtitle.
- **If fails:** `geocodeLocation()` in `server/routes/weather.js` returning null, or WeatherContext not passing `location` param.

## WTHR-03 | HIGH | No GPS and no location — graceful empty state
- **Steps:**
  1. Profile has neither GPS nor location text
  2. Load dashboard
- **Expected:** Weather card shows "Weather data is unavailable until GPS or location is added." with action hint. No API call made. No error.
- **If fails:** WeatherContext making API call with no params, resulting in 400 error.

---

# 6. OFFLINE & SYNC

## SYNC-01 | BLOCKER | Offline profile save
- **Steps:**
  1. Login and load profile setup
  2. Open DevTools > Network > set Offline
  3. Edit farm name, click Save
- **Expected:** Profile saved to IndexedDB (`profile_drafts` store), queued in `sync_queue` store. Success message shows "Saved offline" variant. OfflineStatusBadge shows "Offline" status. No crash.
- **If fails:** `saveProfileDraft` or `enqueueProfileSync` throwing. Check IndexedDB in Application tab.

## SYNC-02 | BLOCKER | Sync when internet returns
- **Steps:**
  1. Complete SYNC-01 (save while offline)
  2. Go back online (DevTools > Network > Online)
  3. Wait 2-3 seconds
- **Expected:** `flushSyncQueue` triggers automatically, calls `POST /api/v2/farm-profile` with queued payload, removes item from sync queue, OfflineStatusBadge shows "Online" with last sync time. Profile data matches on server.
- **If fails:** `useEffect` watching `isOnline` not triggering, or `saveFarmProfile` call failing silently. Check Network tab for the POST request.

## SYNC-03 | HIGH | Queue retry with exponential backoff
- **Steps:**
  1. Save profile while offline (queues item)
  2. Go online but block `/api/v2/farm-profile` endpoint (return 500)
  3. Observe retry behavior
- **Expected:** First retry immediate, then backoff (2s, 4s, 8s... up to 60s max). `retryCount` and `nextRetryAt` updated on queue item in IndexedDB. OfflineStatusBadge shows "Sync error (1 pending)".
- **If fails:** `updateSyncQueueItem` not persisting, or `nextBackoffMs` calculation wrong. Items stuck in queue permanently.

## SYNC-04 | HIGH | Duplicate prevention on retry
- **Steps:**
  1. Save profile offline twice with different data
  2. Go online
- **Expected:** Both queue items processed in order. Final server state matches the last save. No duplicate farm profiles created.
- **If fails:** Queue processing not sequential, or backend creating duplicate profiles instead of upserting.

## SYNC-05 | MEDIUM | OfflineStatusBadge always visible with correct state
- **Steps:**
  1. Observe badge while online (no pending) — should show "Online"
  2. Save offline — should show "Offline"
  3. Go online — should briefly show syncing, then "Online - Last sync HH:MM"
  4. Trigger sync error — should show "Sync error (N pending)"
- **Expected:** All four states render correctly with appropriate colors
- **If fails:** `syncMeta` state not updating, or badge conditional logic wrong.

---

# 7. SEASON ENGINE & TASKS

## SEAS-01 | BLOCKER | Start a new season
- **Steps:**
  1. Login with completed profile (has cropType)
  2. On dashboard, click "Start Season" button
  3. Check season page
- **Expected:** `POST /api/v2/seasons/start` creates V2Season with `isActive: true`, generates V2Tasks based on crop type, redirects to `/season/start`. Season card shows crop, stage, start date.
- **If fails:** Season route returning error, or task generation logic broken. Check server logs.

## SEAS-02 | BLOCKER | Only one active season per user
- **Steps:**
  1. Start a season (SEAS-01)
  2. Try to start another season (call `POST /api/v2/seasons/start` again)
- **Expected:** Server returns 400/409 error: "You already have an active season." No duplicate season created.
- **If fails:** Unique constraint or guard check missing in season start handler. Critical data integrity issue.

## SEAS-03 | HIGH | Complete a task
- **Steps:**
  1. Start a season
  2. On season page or dashboard, find a pending task
  3. Click "Mark Done"
- **Expected:** `POST /api/v2/tasks/<id>/complete` sets `status: 'completed'`, UI updates task to green "Completed" label, pending count decreases.
- **If fails:** Task route not finding task by ID, or SeasonContext `markTaskComplete` not refreshing state.

## SEAS-04 | HIGH | Complete season
- **Steps:**
  1. Have an active season
  2. On `/season/start`, click "Complete Season"
- **Expected:** `POST /api/v2/seasons/<id>/complete` sets `isActive: false`, redirects to `/dashboard`. Dashboard PrimaryFarmActionCard reverts to "Start Season" state.
- **If fails:** Season completion endpoint not toggling `isActive`, or frontend navigation not working.

## SEAS-05 | MEDIUM | Season tasks display correctly
- **Steps:**
  1. Start a season for "maize"
  2. Check SeasonTasksCard
- **Expected:** Tasks specific to maize displayed with title, description, due date. Pending count badge accurate. Completed tasks show green.
- **If fails:** Task generation not using crop-specific templates, or `useMemo` filter stale.

---

# 8. SUPPORT & ANALYTICS

## SUPP-01 | HIGH | Support request submission
- **Steps:**
  1. On dashboard, scroll to SupportCard
  2. Fill subject: "Test issue", message: "Cannot load weather"
  3. Click "Send Request"
- **Expected:** `POST /api/v2/support/request` returns `{ success: true, ticket: { id, status: 'open' } }`. Green success message shown. Form clears. Row created in `v2_support_requests` table.
- **If fails:** Support route not wired, Prisma model name mismatch, or authenticate middleware rejecting.

## SUPP-02 | MEDIUM | Support request validation
- **Steps:**
  1. Submit with empty subject
  2. Submit with empty message
- **Expected:** 400 error returned for each. UI shows error message. No row created.
- **If fails:** Server-side validation missing.

## ANLT-01 | HIGH | Analytics event creation
- **Steps:**
  1. Login and load dashboard
  2. Check `v2_analytics_events` table in DB
- **Expected:** Row with `event: 'dashboard.viewed'` and correct `userId` exists. `createdAt` is recent.
- **If fails:** `safeTrackEvent` swallowing errors silently (by design), but `POST /api/v2/analytics/track` may be 404 or auth-failing. Check Network tab for the POST.

## ANLT-02 | MEDIUM | Analytics never blocks UI
- **Steps:**
  1. Block `/api/v2/analytics/track` (return 500 or timeout)
  2. Navigate through app normally
- **Expected:** App functions normally. No error messages shown to user. No console errors from analytics. `safeTrackEvent` catches all failures.
- **If fails:** `safeTrackEvent` wrapper missing try/catch or `.catch()`.

---

# 9. MOBILE / REAL DEVICE

## MOBL-01 | BLOCKER | Low-end mobile device test
- **Steps:**
  1. Open app on a real Android phone (budget device, 2GB RAM)
  2. Register, setup profile, start season, complete a task
- **Expected:** All flows complete without crash. Pages load within 5 seconds on 3G. Touch targets (buttons) are at least 44x44px. Text is readable without zooming. Dark theme renders correctly (#0F172A background, white text).
- **If fails:** JS bundle too large for device memory, touch targets too small, or inline styles using desktop-only sizing.

## MOBL-02 | HIGH | Slow network simulation (3G)
- **Steps:**
  1. DevTools > Network > Slow 3G
  2. Login, load dashboard, save profile
- **Expected:** Loading states appear (PageLoader, "Loading..." text). No timeout errors for normal operations. Offline badge does not falsely trigger. Profile save completes (may be slow but succeeds).
- **If fails:** Fetch timeouts too short, or loading states missing causing blank screens.

## MOBL-03 | HIGH | App works in portrait and landscape
- **Steps:**
  1. Load dashboard on mobile
  2. Rotate to landscape
  3. Rotate back to portrait
- **Expected:** Layout adapts. No horizontal scroll. Cards stack properly. No content overflow or clipping.
- **If fails:** Inline styles using fixed widths instead of `maxWidth` / `width: '100%'`.

## MOBL-04 | MEDIUM | PWA-like behavior (add to home screen)
- **Steps:**
  1. On mobile Chrome, use "Add to Home Screen"
  2. Open from home screen icon
- **Expected:** App loads in standalone mode (if manifest configured). If no manifest, at minimum the app loads and functions normally from a home screen shortcut.
- **If fails:** Missing or malformed `manifest.json`. Non-blocking for launch.

---

# 10. SECURITY / ACCESS CONTROL

## SEC-01 | BLOCKER | User cannot access another user's data
- **Steps:**
  1. Login as User A, note their farm profile data
  2. Login as User B in a different browser/incognito
  3. Call `GET /api/v2/farm-profile` as User B
- **Expected:** User B sees only their own profile (or null if none exists). No way to pass User A's ID to retrieve their data.
- **If fails:** Endpoints using `req.body.userId` or query params instead of `req.user.id` from the authenticated cookie. Critical security flaw.

## SEC-02 | BLOCKER | Cookie auth behavior over HTTPS
- **Steps:**
  1. Deploy to staging with HTTPS
  2. Register and login
  3. Check cookies in browser
- **Expected:** Cookies have `Secure` flag set, `httpOnly: true`, `sameSite` matches `COOKIE_SAMESITE` env var. No cookies visible to JavaScript (`document.cookie` returns empty for auth cookies).
- **If fails:** `cookies.js` `buildCookieOptions` not setting `secure: true` in production, or `COOKIE_SAMESITE` env var not configured.

## SEC-03 | HIGH | API routes reject unauthenticated requests
- **Steps:**
  1. Clear all cookies
  2. Call `GET /api/v2/farm-profile`, `GET /api/v2/seasons/active`, `POST /api/v2/analytics/track`, `POST /api/v2/support/request`
- **Expected:** All return 401 Unauthorized
- **If fails:** `authenticate` middleware not applied to a route. Check route definitions in `app.js`.

## SEC-04 | HIGH | Input sanitization
- **Steps:**
  1. In profile setup, enter `<script>alert('xss')</script>` as farmer name
  2. Save and view on dashboard
- **Expected:** Script tag rendered as plain text, not executed. React's JSX escaping handles this by default.
- **If fails:** Using `dangerouslySetInnerHTML` somewhere. Check all components rendering user data.

## SEC-05 | MEDIUM | Rate limiting on auth endpoints
- **Steps:**
  1. Send 20 rapid `POST /api/v2/auth/login` requests with wrong password
- **Expected:** After threshold (typically 5-10), returns 429 Too Many Requests
- **If fails:** `authLimiter` not configured or not applied to v2 auth routes in `app.js`.

---

# 11. PRODUCTION INFRA CHECKS

## INFRA-01 | BLOCKER | Environment variables set
- **Verify these are set in production:**
  - `DATABASE_URL` — points to production PostgreSQL
  - `ACCESS_TOKEN_SECRET` — unique, not the dev default
  - `REFRESH_TOKEN_SECRET` — unique, different from access secret
  - `NODE_ENV=production`
  - `APP_BASE_URL` — production frontend URL
  - `API_BASE_URL` — production API URL
  - `COOKIE_DOMAIN` — set if frontend and API on different subdomains
  - `COOKIE_SAMESITE` — set to `none` if cross-site, otherwise `lax`
  - `ALLOWED_ORIGINS` — production frontend URL(s)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — for email flows
- **If any missing:** Auth will fail, emails won't send, or CORS will block requests.

## INFRA-02 | BLOCKER | Database migrations applied
- **Steps:**
  1. Run `npx prisma db push` or `npx prisma migrate deploy` against production DB
  2. Verify all tables exist: `users`, `farm_profiles`, `v2_seasons`, `v2_tasks`, `v2_analytics_events`, `v2_support_requests`
- **Expected:** No migration errors. All tables and indexes present.
- **If fails:** Schema drift between dev and prod. Run `prisma db push` from the `server/` directory.

## INFRA-03 | HIGH | CORS allows production origin
- **Steps:**
  1. Load production frontend
  2. Make any API call
  3. Check Network tab for CORS headers
- **Expected:** `Access-Control-Allow-Origin` matches frontend URL. `Access-Control-Allow-Credentials: true` present.
- **If fails:** `ALLOWED_ORIGINS` env var not set to production frontend URL.

## INFRA-04 | HIGH | Static assets served correctly
- **Steps:**
  1. Run `npx vite build`
  2. Deploy `dist/` folder
  3. Load app, check that JS/CSS load
- **Expected:** All chunks load (check Network tab). No 404s for `.js` or `.css` files. SPA fallback serves `index.html` for client-side routes.
- **If fails:** Static serving config in `app.js` wrong, or `dist/` not deployed. Check `express.static` path.

## INFRA-05 | MEDIUM | Health check endpoint responds
- **Steps:**
  1. Call `GET /api/v2/monitoring/health`
- **Expected:** 200 with `{ status: 'ok' }` or similar
- **If fails:** Monitoring route not mounted. Non-blocking but needed for uptime checks.

---

# 12. FINAL LAUNCH DECISION

## BLOCKER SUMMARY — Must all pass to launch

| ID | Test |
|---|---|
| AUTH-01 | Register new user |
| AUTH-02 | Login existing user |
| AUTH-03 | Logout clears session |
| PROF-01 | Incomplete profile redirects |
| PROF-02 | Farmer UUID never changes |
| WTHR-01 | Weather loads by GPS |
| SYNC-01 | Offline profile save |
| SYNC-02 | Sync when internet returns |
| SEAS-01 | Start a new season |
| SEAS-02 | One active season only |
| DASH-01 | Dashboard loads all cards |
| SEC-01 | User data isolation |
| SEC-02 | Cookie security over HTTPS |
| MOBL-01 | Low-end mobile device |
| INFRA-01 | Environment variables |
| INFRA-02 | Database migrations |

**If ANY blocker fails: STOP. Do not launch.**

---

## HIGH SUMMARY — Must pass for beta, can launch with known issues if mitigated

| ID | Test |
|---|---|
| AUTH-04 | Session persists on refresh |
| AUTH-05 | Token refresh on 401 |
| EMAIL-01 | Email verification |
| EMAIL-02 | Forgot/reset password |
| PROF-03 | GPS success |
| PROF-04 | GPS denied fallback |
| PROF-05 | Manual location fallback |
| WTHR-02 | Weather by text location |
| WTHR-03 | Graceful no-weather state |
| SYNC-03 | Retry with backoff |
| SYNC-04 | Duplicate prevention |
| SEAS-03 | Task completion |
| SEAS-04 | Complete season |
| SUPP-01 | Support request |
| ANLT-01 | Analytics tracking |
| SEC-03 | Auth on all routes |
| SEC-04 | XSS prevention |
| MOBL-02 | Slow network |
| MOBL-03 | Portrait/landscape |
| INFRA-03 | CORS |
| INFRA-04 | Static assets |
| DASH-02 | Action card states |

**If HIGH issues fail: Limited beta launch only. Fix within 48 hours.**

---

## MEDIUM SUMMARY — Can ship, fix post-launch

| ID | Test |
|---|---|
| EMAIL-03 | Resend verification |
| PROF-06 | Completion % accuracy |
| DASH-03 | Voice prompt |
| SEAS-05 | Season task display |
| SUPP-02 | Support validation |
| ANLT-02 | Analytics never blocks UI |
| SYNC-05 | Badge state accuracy |
| SEC-05 | Rate limiting |
| MOBL-04 | PWA behavior |
| INFRA-05 | Health check |

**MEDIUM failures are tracked in backlog. Do not delay launch for these.**

---

## DECISION FRAMEWORK

```
IF (any BLOCKER fails):
    DECISION = STOP
    ACTION = Fix all blockers, re-run full validation

ELSE IF (more than 5 HIGH issues fail):
    DECISION = DELAY
    ACTION = Fix HIGH issues, re-run HIGH + BLOCKER tests

ELSE IF (1-5 HIGH issues fail AND mitigations documented):
    DECISION = LAUNCH (limited beta)
    ACTION = Deploy to beta users only, fix HIGH within 48h

ELSE IF (all BLOCKERS pass AND all HIGH pass):
    DECISION = LAUNCH (full production)
    ACTION = Deploy, monitor logs for 24h, fix MEDIUM in next sprint
```

---

## POST-LAUNCH MONITORING (first 24 hours)

1. Watch server logs for 500 errors on all `/api/v2/` routes
2. Check `v2_analytics_events` table — events flowing means frontend-to-backend pipeline works
3. Check `v2_support_requests` table — any real user submissions means the form works
4. Monitor `v2_seasons` and `v2_tasks` tables — confirm season starts and task completions
5. Check for orphaned sync queue items — query IndexedDB on a test device after use
6. Verify no auth cookies are leaking (check `document.cookie` in browser console — should be empty for httpOnly cookies)
7. Confirm weather API calls succeeding (check server logs for `GET /api/v2/weather/current` 200s)
