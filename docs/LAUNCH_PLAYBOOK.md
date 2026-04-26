# Farroway launch playbook

Companion to [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md). The checklist covers the automated CI gate
(`npm run launch-gate`); this playbook covers the **manual verification, monitoring, rollout, and 72-hour
operating discipline** required around it.

Owned by: launch coordinator. Updated by: anyone who ships a pre-launch fix.

> **Hard rule:** nothing in this playbook ships features. It is a launch-safety document. If you are
> tempted to add a feature here, file a follow-up issue instead.

---

## 1. Final launch checklist

Run **before each rollout phase** (internal → pilot → NGO → soft public). All boxes must be ticked
in writing in the launch ticket. A failed item blocks the phase advance, not the whole launch.

### A. Auth / session

- [ ] Login from clean browser persists after a hard refresh (cookie-based session, no re-prompt)
- [ ] Reload while on `/edit-farm`, `/tasks`, `/progress`, `/my-farm` does **not** flash to `/login`
- [ ] Closing and reopening the browser tab restores the session within 2 seconds
- [ ] Logout clears only the active user — `localStorage` keys for **another** browser profile (if any) untouched
- [ ] Logout from one tab eventually clears the session in another tab (storage event)
- [ ] Two browser profiles signed into different accounts on the same machine see only their own farms
  (no cross-user data leakage)
- [ ] `ProtectedRoute` waits for `authLoading` before redirecting (verified by throttled-network test)

> Reference path: `src/context/AuthContext.jsx` (bootstrap), `src/App.jsx:178-227` (ProtectedRoute),
> `src/store/authStore.js` (token store). Auth keys: `farroway_token`, `farroway_user`,
> `farroway:session_cache`, `farroway:last_email`. None overlap with offline / localStore namespaces.

### B. i18n / language

- [ ] Switch through **English → French → Hindi → Twi → Hausa → Swahili** on `/dashboard`,
      `/my-farm`, `/tasks`, `/progress`, `/today`, `/buyers` — no English string visible in
      a non-English UI on any of these pages
- [ ] No literal `Title`, `helper`, `Estimated`, `placeholder`, `Coming soon`, `TODO` text rendered to users
- [ ] Crop names render localized (e.g. **Hindi UI shows "मक्का", not "Maize"**) on every farmer screen
- [ ] Bottom navigation labels (`Home / My Farm / Tasks / Progress`) localize on language flip
- [ ] `npm run guard:i18n` is green for every launch language on every high-risk domain
- [ ] Dev console: `window.__farrowayLangAudit('hi', '/progress')` and `('tw', '/my-farm')` return clean
      (or only flag known acceptable items — log them in the launch ticket)

### C. Offline

- [ ] Toggle airplane mode, complete a task → task shows completed locally
- [ ] Refresh page while still offline → completed task is still visible (local-first read)
- [ ] Turn airplane mode off → `OfflineSyncBanner` flashes "Back online. Syncing…", then disappears
      → server confirms task completion within 30 seconds
- [ ] Repeat with a `farm_update` (manual stage override reset on harvest record) — same pattern
- [ ] Force-quit the browser mid-flush → reopen → no `farroway_offline_queue` corruption crash
      (HOTFIX `92861fc` covers this; `safeParse` resets a corrupt slot)
- [ ] Abandoned-action surface: simulate 8 failed attempts → red "Some actions could not sync" banner
      shows; entries kept on disk under `getAbandoned()` (not silently dropped)

### D. Farmer flow

- [ ] **Onboarding:** new farmer can complete `/onboarding` → land on `/dashboard` without seeing English
      in a non-English UI
- [ ] **Add farm:** `/farm/new` accepts a farm with crop + size; saves and reflects in `/my-farm`
- [ ] **View tasks:** `/tasks` lists current task → mark complete → moves to "Completed" section
- [ ] **View progress:** `/progress` shows status hero + score + stage progress, all localized
- [ ] **Record harvest:** `HarvestCard` accepts amount, persists locally, queues `farm_update`
      via `safeAction`
- [ ] **Ready to sell:** storage tab readiness flag persists; reflects in `/buyers` admin surface
- [ ] **Voice button** speaks text in active language (English/French/Swahili via provider TTS;
      Twi via prerecorded clip when key maps to a prompt id; Hausa/Hindi via browser TTS)

### E. Admin / NGO flow

- [ ] `/admin` dashboard loads all 7 sections without console errors
      (Summary cards, Key Insights, **Farmer Intelligence Summary**, Risk by Region, Farmers,
      Performance, Interventions, Scoring, Marketplace if enabled)
- [ ] `KeyInsightsSection` shows non-empty cards or self-hides cleanly (no "0% of farmers" leak)
- [ ] `FarmerIntelligenceSummary` 5 tiles populated; "—" appears only when an input is genuinely missing
- [ ] `InterventionList` lists farmers needing follow-up; each row has a localized reason
- [ ] `PrioritySupplyList` filters readyToSell + score > 60; sorted highest first
- [ ] `/buyers` (BuyerView) loads for staff + investor_viewer roles; risk + score badges render
- [ ] CSV export (`/api/admin/export`) downloads a parseable file
- [ ] Switching language on `/admin` keeps the chrome localized; staff column headers stay English
      (intentional — staff surface)

### F. Production deploy

- [ ] All `guard:*` and `check:*` scripts green:
      `guard:prisma`, `guard:migration`, `guard:crops`, `guard:duplicate-crops`,
      `guard:crop-render`, `guard:i18n`, `check:i18n`, `check:crop-labels`
- [ ] `npm run launch-gate` (full build + tests) passes end-to-end on the deploy commit
- [ ] Required env vars set on Railway/hosting:
      `DATABASE_URL`, `JWT_SECRET`, `VITE_API_BASE_URL`
- [ ] Prisma migrations applied on staging **and** production (`prisma migrate deploy` exit 0)
- [ ] Service worker cache-busts on new build (verify `__farrowayReloadForUpdate` event fires
      after a redeploy in a long-lived tab)
- [ ] No `console.error` on app boot in production build (run with prod build, not dev)
- [ ] CSP / cookie domain / CORS verified for the launch host

---

## 2. Monitoring plan

Eight categories. Every entry: **what to log → severity → action required.**

| Category | What to log | Severity | Action |
|---|---|---|---|
| **Login failures** | `auth.login_failed` event with reason (`wrong_pw`, `unverified`, `network`); 401 / 403 from `/api/v2/auth/me`; consecutive failures per IP / per email | P1 if rate × 3 over 10 min vs. baseline; P2 if isolated user | Inspect logs for the affected user → reset state if locked → backend alert if endpoint 5xxing |
| **Farm creation failures** | `farm.create_failed` with `errorCode`; raw 4xx/5xx from `/api/v2/farm-profile`; client validation errors collected in `safeTrackEvent` | P1 if success rate < 95% over 30 min | Check backend logs → look for new validation rule mismatch → roll back if regression |
| **App crashes** | `app.crash` (already wired in `ErrorBoundary.componentDidCatch`); send `error.message` + 500-char `componentStack` | P1 always | Reproduce in staging → check whether StrictMode hook violations regressed (HOTFIX `92861fc` lineage) → patch + redeploy |
| **i18n missing keys** | Existing `[i18n]` console.warn lines in dev; in prod, sample via `safeTrackEvent('i18n.missing', { key, lang })` (rate-limited per key) | P3 unless launch-language coverage drops below 95% on a high-risk domain (then P2) | Add the key to `src/i18n/translations.js` with all 6 langs → ship in next patch window |
| **Offline sync failures** | `offline.sync_failed` per entry with `action.type` + `attempts`; abandonment events when `attempts >= MAX_ATTEMPTS` | P1 if abandoned count climbs (real data loss risk); P3 for transient retry-then-success | Inspect last failure reason → if backend 4xx, fix payload shape; if 5xx, file backend ticket → manual `retryAbandoned(id)` for stuck entries |
| **Notification failures** | Twilio / SendGrid webhook failures; queued reminders that exhaust retries | P2 (notifications are augmentation, not blocker) | Audit per-channel delivery report; degrade gracefully (silence channel for the day) |
| **API 401 / 500 errors** | All non-2xx responses from `/api/v2/*` and `/api/admin/*` with route + method + status; per-route rate; user role distribution | P1 for any 5xx pattern; P2 for 401 spike (likely cookie/CORS regression) | 5xx → Railway logs + Sentry stack; 401 → check session refresh path + `farroway:session_cache` health |
| **Voice / device API errors** | `voice.start_failed`, `voice.recognition_error` with code; `speechSynthesis` unavailable counts (informational) | P3 (UI hides voice button when unsupported, no user-facing crash) | If counts spike on a specific browser/version, document and consider a polyfill ticket — out of scope for launch |

**Logging hygiene:**
- Reuse the existing `safeTrackEvent` helper (`src/lib/analytics.js`); never `console.error` directly in user-facing code paths
- Rate-limit per key/per user/per session (the `_warnedKeys` pattern in `tStrict` is the template)
- Never log PII into the analytics stream — strip phone, email, lat/lng before send

---

## 3. Rollout plan

Four phases. **Each phase has an explicit advance criterion** (next section's go/no-go); no advance without it.

### Phase 1 — Internal test (Day 0–2)

- 3–5 internal users (engineering + product + 1 field officer)
- 48 hours minimum
- All 6 languages exercised at least once each by a different tester
- Phase 1 advances on: zero `app.crash` events, zero login-loop reports, every checklist item §1.A–F ticked

### Phase 2 — Farmer pilot (Day 2–16)

- 20–50 farmers, **Ghana-first** (Twi + English UI primary; pilot validates the prerecorded-clip path)
- 7–14 days of daily use
- Field officer present in-person for at least the first 3 days for in-context observation
- Daily monitoring tick (§5)
- Phase 2 advances on: farm creation success > 95%, no abandoned-queue entries beyond noise, qualitative report from field officer (3 short observations + 0 blocking complaints)

### Phase 3 — NGO demo / partner pilot (Day 16–30)

- 1 NGO partner, dashboard walkthrough
- Admin / staff verify `/admin` + `/buyers` + intervention/supply lists daily
- Weekly usage report sent to partner (CSV export + 5 sentences of context)
- Phase 3 advances on: partner sign-off in writing + dashboard metrics match qualitative observation (no inflated numbers)

### Phase 4 — Soft public launch (Day 30+)

- 100–500 users
- Launch only after phases 1–3 pass
- Marketing / referral push gated behind first 72-hour ops being clean (§5)
- Hard cap on user count; expansion requires explicit go-decision

---

## 4. Go / no-go rules

Every phase advance is a written decision (slack post + ticket update). The rules are deliberately small.

### GO if:

- ✅ No login loop reproducible in any tested browser
- ✅ No `app.crash` event for any user during the phase window
- ✅ No mixed-language UI (English text inside Hindi / Twi / Hausa / French screens)
- ✅ Farm creation success rate > 95% (server-side measurement)
- ✅ Offline → online sync round-trip works for at least 3 distinct action types
- ✅ No cross-user data leakage (separate accounts see separate data; spot-checked against DB)

### NO-GO if **any one** of:

- ❌ Auth fails for a non-trivial fraction of testers (token not persisted, refresh hits login, etc.)
- ❌ Visible language mismatch in the active UI (English bleed)
- ❌ Dashboard crashes or renders blank tiles for valid data
- ❌ Recorded harvest disappears after refresh
- ❌ Duplicate notifications (same farmer gets the same reminder more than once for the same trigger)
- ❌ Offline-queued actions disappear without trace (must surface as `abandoned`, never silently dropped)

A single NO-GO **rolls back the phase advance**, not the whole launch. Document, fix, retest, advance.

---

## 5. First 72 hours after launch — daily operating cadence

Three checks per day for the first three days. Each check is a 15-minute slot — disciplined, short, written.

### Morning (08:30 local)

- [ ] Pull last-24h logs: `app.crash`, `auth.login_failed`, `offline.sync_failed`, `farm.create_failed`
- [ ] Compare counts to yesterday's baseline; flag any > 2× growth
- [ ] Check Sentry / Railway error stream for any P1 not seen yesterday
- [ ] Skim `safeTrackEvent('i18n.missing', …)` aggregate — flag any new key missing in a launch language

### Afternoon (13:30 local)

- [ ] Call or text 2–3 active pilot users; ask: *"Did anything fail today? What was confusing?"*
- [ ] Review any screenshots / recordings forwarded by the field officer
- [ ] Identify the **top 3 issues** of the day (numerical + qualitative); rank P1 / P2 / P3
- [ ] Cross-check the screenshots against the §1.B i18n criteria — any English bleed?

### Evening (17:30 local)

- [ ] **Fix only blockers** (P1, anything matching a NO-GO rule)
- [ ] Decide redeploy yes/no in writing
- [ ] If redeploying: run `npm run launch-gate` end-to-end — no skipping
- [ ] Post the day's three-line summary in the launch channel (issues seen, fixes shipped, headcount)

After day 3, drop to a single daily check (morning) for another 7 days, then weekly.

---

## 6. Top 10 risks still remaining

Risks that survive into launch — with mitigation owners. None block launch by themselves; all warrant
attention during the first 72 hours.

| # | Risk | Likelihood | Blast radius | Mitigation |
|---|---|---|---|---|
| 1 | **Hindi / Twi / Hausa coverage gaps in low-traffic surfaces** (long-tail keys) | Medium | One screen partly English | `__farrowayLangAudit` audit per route; ship missing keys in next patch window; `guard:i18n` already protects the high-risk domains |
| 2 | **Prerecorded Twi clips only cover ~22 prompt ids** | High (Twi pilot) | Voice button speaks via en-US fallback; pronunciation poor | Prioritize Twi mp3 recording for the next 30 keys; field officer collects which voice prompts farmers actually tap |
| 3 | **Hausa server-side TTS not configured** | High (Hausa pilot) | Voice falls to ha-NG browser voice (uneven across devices) | Backend ticket filed; until then, Hausa voice quality is "acceptable but imperfect" — flag in pilot brief |
| 4 | **Web Speech recognition unavailable on Firefox / iOS Safari** | Medium | Mic input + voice navigator hide; users can still tap | UI degrades gracefully (already shipped); document in pilot intake form which browser the farmer uses |
| 5 | **`navigator.onLine` false-positive on captive-portal Wi-Fi** | Medium | Offline queue tries to flush, all entries fail, retry on backoff | `isReallyOnline()` probe wired in `syncManager` already; if a captive portal sticks, queue retries until 1h backoff lands |
| 6 | **Concurrent IndexedDB engine + lightweight localStorage queue** | Low | Two queues to reason about | Domain mapping documented in `src/offline/offlineQueue.js` header; add a "which queue do I use" decision in `docs/SYNC_GUIDE.md` |
| 7 | **`farroway:session_cache` 30-day TTL longer than refresh-token TTL** | Low | A session-cached user shown briefly before `/me` 401 fires logout | Bootstrap re-validates with `/me`; if it fails the AuthContext clears state. Tested in §1.A |
| 8 | **Cross-tab logout race** | Low | One tab logs out, another keeps a stale session view for ~2 s | The `storage` event picks it up; observed delay is acceptable |
| 9 | **`localStorage.clear()` in AuthContext logout wipes the offline queue** | Low | A farmer logging out loses any unsynced offline actions | Mitigation: `OfflineSyncBanner` shows pending count; UX guidance "wait until banner clears before logging out" needs to be in the pilot brief |
| 10 | **Crop label fallback humanises unknown ids visibly** | Low | A farm with a crop id not in the registry shows the humanised id (e.g. `dragon_fruit` → `Dragon fruit`) instead of a translated name | `[FALLBACK_USED]` console.warn fires in dev; product can detect via the warn aggregate and add the missing crop to the registry |

---

## Appendix — quick-reference commands

```bash
# Pre-flight
npm run launch-gate              # full gate; required before each phase
npm run launch-gate:fast         # CI guards only; quick pre-commit

# Individual guards
npm run guard:crops              # cropType drift baseline
npm run guard:crop-render        # raw crop string renders
npm run guard:i18n               # high-risk domain coverage
npm run guard:duplicate-crops    # legacy crop list growth

# Dev-only language audit (browser console)
window.__farrowayLangAudit('hi', '/progress')

# Manual queue inspection (browser console)
JSON.parse(localStorage.getItem('farroway_offline_queue') || '[]').length
```

---

*Document version: launch-1.0. Owner: launch coordinator. Last updated alongside commit `92861fc` (auth-crash hotfix).*
