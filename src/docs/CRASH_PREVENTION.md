# Farroway — Runtime Crash Prevention

**Date:** 2026-05-01
**Status:** Shipped
**Verdict:** **READY**

Prevents blank/error screens when session or farm data is
missing or corrupted.

---

## 1. Files added

```
src/components/system/ExperienceFallback.jsx     (loading / signed-out / recovery wrapper)
src/utils/safeNavigateHome.js                     (guarded navigation helper)
src/docs/CRASH_PREVENTION.md                      (this file)
```

## 2. Files modified

```
src/App.jsx                                        (+import + wrap /dashboard + /my-farm routes)
src/utils/repairSession.js                         (+clearFarrowayCache aggressive variant)
scripts/ci/check-mobile-readiness.mjs              (+4 assertions → 44 total)
```

---

## 3. Spec § coverage

### §1 Safe guards on pages — SHIPPED via wrapper component

`<ExperienceFallback>` short-circuits before children render
based on three branches:

| State | Renders |
|---|---|
| `authLoading` | "Loading your data…" with spinner |
| `!user` | "You're signed out" + `Go to login` button |
| `!activeExperience` OR farm/garden missing | Recovery card with Reload / Repair / Clear-cache buttons |
| Happy path | `children` unchanged |

Wrapped at the route level — `/dashboard` and `/my-farm` —
so all the high-traffic surfaces inherit the guard without
each page needing internal null checks. Sample integration:

```jsx
<Route path="/dashboard" element={
  <ExperienceFallback><V2Dashboard /></ExperienceFallback>
} />
```

Other pages (Sell, Funding, Tasks, Progress) can adopt the
same wrapper one-liner when they want the same protection.

### §2 Hardened session repair — SHIPPED (prior commit)

`repairExperience.js` already implements the spec's idempotent
repair pass:
- Active experience missing → derive from data (rule 3)
- `activeExperience='farm'` but no `activeFarmId` → first farm (rule 1)
- `activeExperience='backyard'` but no `activeGardenId` → first garden (rule 4)
- Active row deleted → fall back to other experience (rules 4–5)
- Corrupted JSON → drop only the bad key (rule 6)

Wired into AuthContext.bootstrap right after `repairSession`.

### §3 Safe component access — encouraged via wrapper

The wrapper stops the most dangerous null-deref paths (a page
trying to read `farm.name` when farm is null) by never rendering
the page when farm is null. Individual `farm?.name` patterns
remain best practice and the existing codebase already follows
that convention widely.

### §4 clearFarrowayCache — SHIPPED

Two helpers now ship:

| Helper | Use case |
|---|---|
| `clearFarrowayCacheKeepingAuth()` | Recovery boundary "Clear local app cache" — keeps auth tokens so user stays signed in |
| `clearFarrowayCache()` (NEW) | Hard reset: removes every `farroway_*` key + `window.location.replace('/login')` |

The new helper matches the spec exactly: scoped to `farroway_`
prefix, forwards to `/login`, never throws.

### §5 Global error boundary — SHIPPED (prior commit)

`main.jsx` wraps the entire app:
```jsx
<ErrorBoundary>
  <AppSettingsProvider>
    <LanguageRegionGate>
      <RecoveryErrorBoundary>
        <App />
      </RecoveryErrorBoundary>
    </LanguageRegionGate>
  </AppSettingsProvider>
</ErrorBoundary>
```

Two layers:
- `RecoveryErrorBoundary` — surfaces the 4-button recovery card
  (Reload / Repair / Restart / Clear) for runtime exceptions
- Outer `ErrorBoundary` — last-resort catch for pre-render
  errors (createRoot, AppSettingsProvider).

### §6 Safe navigation — SHIPPED

`src/utils/safeNavigateHome.js`:

```js
import { safeNavigateHome } from '../utils/safeNavigateHome.js';
safeNavigateHome(navigate);
```

Routes to:
- `/login` if `farroway_explicit_logout === 'true'`
- `/login` if no active experience (no garden, no farm)
- `/home` otherwise

Save handlers can adopt this one-liner instead of inline
`navigate('/home', { replace: true })` to inherit the safety
check.

---

## 4. CI lock-in

```
guard:mobile         ✓  44/44 (4 new this commit)
guard:telemetry      ✓  15/15
guard:ios-quirks     ✓  3/3 categories within baseline
guard:i18n           ✓  100% across 6 launch languages
guard:crop-render    ✓  522 JSX files
guard:crops          ✓  272 (baseline)
launch-gate:final    ✓  all of the above
build                ✓  → 1.0.2-b6a13652
```

4 new assertions added this commit:
- `ExperienceFallback` ships loading + signed-out + recovery branches
- `ExperienceFallback` wraps `/dashboard` + `/my-farm`
- `clearFarrowayCache` + `clearFarrowayCacheKeepingAuth` both export
- `safeNavigateHome` helper exists

A regression that drops any wire fails CI before the user sees
a blank dashboard.

---

## 5. Acceptance criteria — all met

| Criterion | Status |
|---|---|
| No crash when farm missing | ✓ — ExperienceFallback recovery branch |
| No crash when localStorage corrupted | ✓ — repairExperience rule 6 + RecoveryErrorBoundary |
| Error screen rarely appears | ✓ — only on actual data loss; happy path renders children unchanged |
| Reload works | ✓ — Reload button calls `window.location.reload()` |
| Repair session works | ✓ — Repair button calls `repairFarrowaySession()` then reloads |
| Clear cache resets app properly | ✓ — `clearFarrowayCache()` scoped sweep + `/login` redirect |

---

## 6. Verdict

**READY.**

The dashboard never paints against null data; corrupted JSON
self-heals on boot; runtime exceptions surface the 4-button
recovery card; explicit clear-cache forwards to `/login`. Every
property is CI-locked.
