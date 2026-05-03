# Farroway — Soft Launch Readiness Checklist

**Brand**
- Name: **Farroway**
- Tagline: *Know what to do. Grow better.*
- Tone: simple, trusted, practical
- Theme: dark navy → green
- Audience: smallholder farmers, backyard growers, NGO field officers, buyers, admins

This document is the single runbook the launch team uses to validate Farroway is investor-demo-ready. It maps every spec area to the surface that satisfies it, with a copy-pasteable verification step. Run this BEFORE every investor demo and BEFORE the soft-launch cut-over.

---

## §0 What ships in soft launch

```
Frontend  : src/
Backend   : server/src/  (Express + Prisma)
Database  : PostgreSQL (Railway)
Storage   : Postgres + uploads/  (signed-only static)
Mobile    : Capacitor wrappers (Android + iOS) sharing the same dist/
Languages : 6 — en / fr / sw / ha / tw / hi
Roles     : 6 — backyard_user / farmer / buyer / ngo_admin / field_agent / platform_admin
```

---

## §1 Pre-demo verification (run in order)

### 1.1 Build green

```
npm run launch-gate:fast       # full guard suite
npm run security:audit         # 14 suites / 331 tests
npm run security:routes        # PASS — all sensitive routes guarded
npm run security:scan-secrets  # 0 findings
npx vite build                 # 0 errors
```

If any fails, stop and triage before the demo.

### 1.2 Server health

```
curl https://staging.farroway.app/api/health
# Expect: { "status": "ok", "db": "ok", "uptime": <int>, "version": "1.0.0" }
```

### 1.3 Brand spot-checks

| Surface | What to verify |
|---|---|
| Welcome / login | Wordmark + tagline visible. Use `<BrandLogo showTagline />` if either is missing. |
| Home | Top eyebrow strip — confirm the active context label ("Farm: My Farm" or "Backyard: My Garden") renders before the primary action card. |
| Settings | App version + tagline in the footer. |
| Loading splash | Sprout icon + name; never a blank green screen. |

### 1.4 Cross-platform smoke

| Surface | Verify |
|---|---|
| Chrome desktop | Bottom nav fixed; cards centred; no horizontal scroll at 360 px |
| Safari iOS | Safe-area padding present below bottom nav |
| Android Chrome | Tap-targets ≥ 48 × 48 px; no JS errors in `chrome://inspect` console |
| Offline mode | Toggle airplane → Home still renders the cached primary action; "saved offline" toast on task completion |

---

## §2 Investor demo path — 6 screens

The launch team has a 5-minute demo target. Walk through these screens IN ORDER.

### 2.1 Farmer daily task — `/dashboard`

**What investors see:** one large card titled with today's action, urgency tag, time estimate, "DO THIS NOW" CTA.

**Verify:**
- [ ] One primary action above the fold — no competing cards
- [ ] Urgency tag matches weather context (rainy day → "Skip outdoor work today")
- [ ] Tap "DO THIS NOW" → "Great job. Next task will update soon." appears
- [ ] Bottom nav: Home · My Farm · Tasks · Progress · Funding · Sell
- [ ] Backyard variant: nav becomes Home · My Grow · Tasks · Progress · Scan with no farmer-only tabs

**If broken:** the legacy `FirstActionGate` is the rollback path. Set `FEATURE_AI_TASK_ENGINE = false` in `src/utils/featureFlags.js` and rebuild.

### 2.2 Farm progress — `/my-farm` (farmer) or `/my-grow` (backyard)

**What investors see:** farm identity card with photo + name + location, three big actions (Edit · Add · Switch), crop / size / stage rows, help link.

**Verify:**
- [ ] Photo upload works — pick a JPG, see the circular thumbnail update locally
- [ ] FarmSwitcher dropdown opens; ACTIVE badge on the selected farm
- [ ] Backyard: "My Grow" wording everywhere; never "yield" / "income" / "sell"
- [ ] Setup card surfaces only when crop or location is missing (verify by editing the active farm to clear `crop`)
- [ ] Help card → `/support` route (or `mailto:` fallback when route absent)

### 2.3 NGO program dashboard — `/admin/ngo-dashboard` or `/ngo`

**What investors see:** five filter dropdowns (Region / Crop / Mode / Status / Risk), Farms / Gardens count cards, roster table.

**Verify:**
- [ ] Five filter dropdowns render and reset
- [ ] Counts update when a filter is applied
- [ ] Cross-org isolation: as `NGO_A_TOKEN`, `/api/ngoDashboard/overview` returns only Program A data; the security route audit verified the org gate is in the chain (`extractOrganization`)
- [ ] Empty state: "No farmers in this filter yet"

### 2.4 Buyer produce discovery — `/buyer` or `/marketplace`

**What investors see:** public marketplace listings, trust badges, contact-buyer flow gated to authenticated buyers.

**Verify:**
- [ ] `/marketplace` reachable without auth — public listings render
- [ ] `/buyer/listings/:id` for a private listing returns 403/404 to a buyer who doesn't own it (already covered by the security route audit)
- [ ] Buyer trust panel shows farm trust signals (compliant / needs_review / non_compliant)

### 2.5 Funding readiness — `/opportunities`

**What investors see:** opportunity cards with eligibility chips, "Apply" CTA, application status pill.

**Verify:**
- [ ] Opportunity cards render with crop + region + amount
- [ ] Eligibility chips colour-coded (green = eligible, amber = check, red = not eligible)
- [ ] Backyard users do NOT see this surface in the bottom nav (their nav is Home · My Grow · Tasks · Progress · Scan)

### 2.6 Admin metrics — `/admin/monitoring`

**What investors see:** 8 KPI cards in a responsive grid, Top Errors + Top Stuck Routes lists, auto-refresh every minute.

**Verify:**
- [ ] DAU / WAU values look sensible (not zero on a soaked staging cluster)
- [ ] Task completion ratio renders as a percentage with the raw fraction below
- [ ] Day-over-day retention: "X of Y returned" sub-label
- [ ] Top Errors list shows the most-frequent error route (or "None" when empty)
- [ ] User cohort split: farmer / backyard counts visible

---

## §3 Per-area readiness

### 3.1 Home screen — clean, weather-aware, one daily action

| Item | Status |
|---|---|
| `<TodayTaskCard />` mounted under `FEATURE_AI_TASK_ENGINE` flag | ✅ shipped |
| `<FirstActionGate />` legacy fallback when flag is OFF | ✅ shipped |
| Urgency tag colour scheme (red/amber/green) | ✅ shipped |
| Weather context (rain/heat/dry/cold) flips the rule | ✅ shipped (`server/src/modules/aiTask/engine.js`) |
| Empty-state when crop/stage missing | ✅ — `profile_missing` rule fires; the response carries `fallback: true` |

### 3.2 My Farm / My Grow — simplified action-first layout

| Item | Status |
|---|---|
| Header with sprout icon | ✅ |
| Farm Switcher dropdown | ✅ — `FarmSwitcher.jsx` |
| Identity card with photo + name + location + Upload Photo CTA | ✅ — `MyFarmPage.jsx` |
| Setup card surfaces only when fields missing | ✅ |
| Three actions: Edit · Add · Switch | ✅ |
| Help / contact link | ✅ |
| Backyard wording swap via `useUserMode()` | ✅ |
| `/my-grow` route alias mounts `MyFarmPage` | ✅ — App.jsx |

### 3.3 Admin dashboard with soft launch metrics

| Item | Status |
|---|---|
| DAU / WAU | ✅ |
| Task completion rate (`task_completed / task_viewed`) | ✅ |
| Day-over-day retention | ✅ |
| App errors count + top reason | ✅ |
| Stuck-screen count + top route | ✅ |
| Cohort split (farmer / backyard / ngo / buyer) | ✅ |
| `task_generated` + `taskFallbackRate` (AI Task Engine v1) | ✅ |
| Server endpoint `GET /api/admin/metrics` | ✅ — admin-gated |

### 3.4 NGO dashboard preview

| Item | Status |
|---|---|
| 5 filter dropdowns (Region / Crop / Mode / Status / Risk) | ✅ — `NgoDashboard.jsx` |
| Cross-org isolation in `/api/v2/ngoDashboard/*` | ✅ — `extractOrganization` middleware-level |
| Read-only by default for `field_agent` | ✅ |
| Roster table with empty state | ✅ |

### 3.5 Buyer interest flow preview

| Item | Status |
|---|---|
| Public marketplace listing reachable without auth | ✅ |
| `/api/v2/buyer-trust/farms/:farmerId` org-gated | ✅ — fixed in route security pass |
| Buyer can `POST /api/buyer-interest` | ✅ |
| Private listing → 403/404 for buyer | ✅ |

### 3.6 Funding opportunity preview

| Item | Status |
|---|---|
| `/opportunities` page with eligibility chips | ✅ |
| Server `/api/v1/farms/:id/funding-score` | ✅ |
| Backyard nav hides Funding tab | ✅ — `BACKYARD_TABS` doesn't include funding |
| Empty state: "No opportunities for your area yet" | ✅ — existing `EmptyState` component |

### 3.7 Consistent farmer / backyard language

| Rule | Verified by |
|---|---|
| Farmer wording on yield / income / sell / harvest | `aiTaskEngine.test.js → "farmer wording carries production-grade language"` |
| Backyard never mentions yield / income / sell | `aiTaskEngine.test.js → "backyard never mentions yield / income / sell"` |
| Per-userType nav split | `BottomTabNav.jsx → FARMER_TABS / BACKYARD_TABS` |
| Per-userType label registry | `core/terminology.js` |

### 3.8 Mobile-first UI polish

| Item | Status |
|---|---|
| Dark navy background gradient | ✅ — `linear-gradient(180deg, #0B1D34, #081423)` global |
| Brand green CTA `#22C55E` | ✅ — `styleGuide.js#COLORS.primary` |
| Min tap target 48 × 48 px | ✅ — `styleGuide.js#TYPOGRAPHY.button.minHeight` |
| Safe-area inset on bottom nav | ✅ — `BottomTabNav.jsx#nav.paddingBottom: 'env(safe-area-inset-bottom)'` |
| Capacitor wrappers (Android + iOS) | ✅ — `capacitor.config.json` |
| PWA assets (manifest, icons) | ✅ — `public/manifest.json` + `dist/icons/` |

### 3.9 Error fallback screens

| Trigger | Fallback |
|---|---|
| React render error | `<RecoveryErrorBoundary>` → "We hit a problem rendering this page" + 3 buttons (Try again / Fix setup / Restart setup). Server-side `app_error` event posted via `POST /api/errors`. |
| Network down | `<OfflineBanner>` + offline queue drains on reconnect |
| Unmatched route | `Navigate to="/dashboard"` (silent redirect — never a broken 404) |
| Missing translation | `tSafe(key, fallback)` returns the English fallback; `tStrict` throws on dev so leaks are caught |
| API 500 | `errorHandler.js` scrubs leak patterns and returns `{ error: 'Internal server error', requestId: '<rid>' }` |

### 3.10 Empty states for missing farm / garden / task data

`EmptyState.jsx` reusable primitive is used across:
- `FarmerActivitiesTab` — "No activities logged yet"
- `FarmerMarketTab` — "No price data available"
- `FarmerNotificationsTab` — "No notifications"
- `FarmerOverviewTab` — "No upcoming reminders" / "No applications yet"
- `AdminUsersPage`, `AdminOpsPage`, `FundingAdmin`

For Home / My Farm / Tasks: the `profile_missing` rule in the AI Task Engine v1 fires the explicit "Complete your profile" task with `fallback: true` — no blank state possible.

---

## §4 Investor demo script — 5 minutes

> *"Farroway tells smallholder farmers and backyard growers exactly what to do today. Here's the daily action our farmer in Ghana sees on their phone …"*

**Minute 1 — the farmer surface.** Open `/dashboard` on a phone-sized window. Point to: weather urgency (e.g. heat warning), one clear next action, "DO THIS NOW" CTA. Tap done. "Great job. Next task will update soon." renders.

**Minute 2 — context the engine uses.** Show `/my-farm`. Point to: crop, location, growth stage, planting date. *"The engine combines this with weather + region + history to pick the rule. It's deterministic — every decision has a `ruleId` for audit."*

**Minute 3 — switch to backyard.** Open `/my-grow` (or flip user type in dev tools). Point to: simpler vocabulary, no Funding/Sell tabs. *"We never mix farmer and backyard wording. A backyard grower never sees yield, income, or sell-readiness language."*

**Minute 4 — NGO + buyer surfaces.** Open `/admin/ngo-dashboard`. Point to: org isolation (an NGO operator only sees their assigned farmers), funding eligibility chips, buyer trust signals. *"Every backend route is gated by middleware that the static auditor runs in CI — npm run security:routes."*

**Minute 5 — admin metrics.** Open `/admin/monitoring`. Point to: DAU, completion rate, retention, top errors. *"This panel auto-refreshes every minute. The same numbers are served by `/api/admin/metrics` for ops dashboards."*

End on the brand wordmark: **Farroway — Know what to do. Grow better.**

---

## §5 Operator pre-flight (the 12-item checklist)

Run this 30 minutes before any investor demo or live cohort onboarding.

- [ ] `npm run launch-gate:fast` → ✓
- [ ] `npm run security:audit` → ✓ (14 / 331)
- [ ] `npm run security:routes` → ✓ PASS
- [ ] `npm run security:scan-secrets` → ✓ 0 findings
- [ ] `npx vite build` → ✓ 0 errors
- [ ] `curl https://staging.farroway.app/api/health` → `{ status: 'ok' }`
- [ ] Open `/dashboard` on a 360 × 640 viewport — primary action visible above the fold
- [ ] Open `/my-farm` — photo upload works
- [ ] Open `/admin/monitoring` — non-zero DAU on the staging cluster
- [ ] Toggle airplane mode — Home still renders cached task; reconnect → offline queue drains
- [ ] Flip language to French via `farroway:langchange` event — Home wording switches
- [ ] Test admin role gate: log in as a farmer, hit `/api/admin/users` → 403

If 11/12 pass: green-light the demo. If anything fails, the live HTTP harness in `security-tests/curl-tests.sh` will pinpoint the surface within 30 seconds.

---

## §6 Soft-launch traffic targets (week-one cohorts)

| Cohort | Tier | Target |
|---|---|---|
| Pilot farmers (Ghana) | 50 | 80% completion of first task in 24 h |
| Backyard growers (US east) | 25 | 70% retention day-2 |
| NGO operators (1 org, 4 field agents) | 4 | Daily login by 3/4 |
| Buyer pilots | 5 | At least 1 buyer interest submitted week-one |

`/admin/monitoring` is the live dashboard — operators watch DAU + completion + retention + topErrors.

---

## §7 Known limits — and the why

- **Engine is rules-based, not ML.** Spec rule §0 — every decision is auditable. ML lands in v2 once we have outcome-feedback labels at scale.
- **6 launch languages, machine-translated.** Native review pre-launch is a checklist item; we ship the strict-no-leak fallback so a bad translation never breaks the surface.
- **AI Task Engine flag defaults OFF.** The legacy local-decision `FirstActionGate` owns Home until the API is observed in production.
- **Photo upload is local-only on My Farm/My Grow.** Server-side photo persistence is a v1.1 task — the spec explicitly held it back.
- **Only 6 admin roles.** No granular permission matrix yet — `super_admin` ≈ `platform_admin` covers every admin surface.

---

## §8 Final go-live sign-off

| Reviewer | Item | Sign-off |
|---|---|---|
| Engineering lead | All §5 pre-flight items pass | ☐ |
| Security | `security:routes` PASS + secrets scan 0 findings | ☐ |
| Product | Investor demo script (§4) walked through end-to-end | ☐ |
| Brand | Wordmark + tagline visible on welcome / login / settings | ☐ |
| Ops | Railway deployment health probe green for 24 hours | ☐ |
| Localisation | Native-speaker review of fr / sw / ha / tw / hi templates | ☐ |

When every box is checked, **Farroway is ready to ship.**

---

*Generated 2026-05-03 — update on every release-candidate cut.*
