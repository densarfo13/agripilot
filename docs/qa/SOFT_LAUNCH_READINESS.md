# Soft-Launch Readiness Checklist

Status: launch gate. Walk this list before opening the doors to a
controlled cohort (≤500 invited users — NGO partners, opt-in
farmers, opt-in gardeners). Every item is checked AT LEAST ONCE on
a real device against the live production deploy.

Companions:
- `docs/qa/REAL_DEVICE_QA_CHECKLIST.md` — per-device acceptance
- `docs/qa/INTELLIGENCE_ORCHESTRATION_QA.md` — one-best-action rule
- `docs/qa/SCAN_PRODUCTION_HARDENING.md` — scan persistence gate
- `docs/qa/SIMPLE_FARMER_UX_CHECKLIST.md` — calm wording gate
- `docs/qa/LIVE_SMOKE_CHECKLIST.md` — post-deploy smoke
- `docs/LAUNCH_CHECKLIST.md` — high-level launch plan
- `docs/LAUNCH_PLAYBOOK.md` — operator-side playbook

---

## A. Hard gates — block launch if any fail

- [ ] Scan: image persistence end-to-end (capture → analyze →
      result → journal). Verified on iPhone Safari + Android
      Chrome. No broken "?" preview after navigating away and
      back. (`docs/qa/SCAN_PRODUCTION_HARDENING.md`)
- [ ] Home: exactly ONE primary action card. No competing CTAs.
      (`docs/qa/INTELLIGENCE_ORCHESTRATION_QA.md`)
- [ ] Auth: login / logout / refresh works on a fresh install.
- [ ] Production health endpoint returns `{ status: 'ok', db: 'ok' }`
      with version stamp matching the deployed commit.
- [ ] All build:safe gates green: lint (0 errors), translations,
      assets, urls, intelligence, icons.
- [ ] Full server test suite passes (`cd server && npm test`).
- [ ] Latest commit deployed on Railway (matches `git rev-parse HEAD`).

## B. Stability — minor risks OK, document them

- [ ] Lint warnings ≤ 110 (current baseline ≤ 100). Any new
      warnings reviewed.
- [ ] Bundle: no chunk over 1.5 MB. (i18n-core acknowledged at
      1.4 MB; per-locale split tracked separately.)
- [ ] No new console errors visible in production browser
      console on Home, Scan, Today, Journal.
- [ ] `/api/health` `uptime` stable across two minutes of
      observation (no silent restarts).

## C. Operating-companion behaviour

- [ ] Home: "What should I do today?" answered with one action +
      one reason + one timing cue + at most one supporting
      insight.
- [ ] Notifications: ≤ 2 push/day per user. Honors quiet hours.
      No generic "open app" pushes.
- [ ] Suppression engine: rain skip + watering DONE within 6 h +
      ignored ≥ 3 times + stale > 24 h all filter out.
- [ ] Timing engine: morning/evening for hot-day watering,
      tomorrow for windy spray request, now for high-urgency.
- [ ] Memory: completing today's task does not surface the same
      task tomorrow morning. Repeatedly ignored recommendations
      drop out.
- [ ] Scan-trust: needs_review result downgrades scan-followup
      out of primary action slot.

## D. Simple vs Standard mode

- [ ] Default mode on a fresh install: Simple.
- [ ] Mode toggle preserves user data + lifecycle state.
- [ ] Simple mode: bigger cards, less text, no raw confidence /
      no technical disease names.
- [ ] Standard mode: confidence labels, best-time, urgency,
      source attribution all visible.
- [ ] Legacy `experienced` preference bridges to Standard
      (no reset to Simple).

## E. Lifecycle decision loop

- [ ] On crop/plant selection: lifecycle plan created, planting
      window estimated, harvest range estimated, stage tasks
      generated.
- [ ] Stage transitions update Home guidance same day (no manual
      refresh required).
- [ ] Weather + watering + scan history all visibly influence
      the next-best-action shown on Home.

## F. Agronomy trust language

- [ ] No "confirmed disease" / "guaranteed yield" / "definitely
      will" phrasing anywhere user-facing.
- [ ] Hedged wording (possible / likely / may indicate / monitor
      / needs review) used on every scan result + risk card.
- [ ] Chemical-treatment recommendations carry the local-expert
      disclaimer.

## G. Localization

- [ ] Language switcher offers en / fr / sw / ha / tw / hi.
- [ ] Switching language updates Home + Today + Scan + Tasks +
      Notifications within one render cycle.
- [ ] No mixed-language screen (English bleed-through) on the
      hero surfaces in each of the 6 supported languages.
- [ ] Crop names + lifecycle stages + notification titles all
      localized (not just buttons).

## H. Offline + weak network

- [ ] Airplane-mode Home shows cached guidance with
      "Offline — showing your last saved tasks" banner.
- [ ] Airplane-mode scan capture: photo saved to queue, banner
      reads "will sync on reconnect".
- [ ] Reconnect: queued scans, watering, journal entries all
      sync exactly once. No duplicates after a re-connect storm
      (toggle airplane mode 5x rapidly).
- [ ] Tasks completed offline reconcile on reconnect.

## I. Role readiness — sanity check each

| Role | Quick test |
|---|---|
| Farmer | onboarding → crop → home → scan → task complete |
| Gardener | onboarding (garden) → home → scan a leaf → save |
| NGO | sign in → impact dashboard → export CSV |
| Admin | sign in → admin page → audit log row appears for action |
| Buyer | browse listings → open listing → contact seller intent |

- [ ] Each role test completes edge-to-edge without a dead end
      or blank state.

## J. Security + privacy

- [ ] Admin routes 401 without JWT, 403 with non-admin JWT.
- [ ] `/uploads/<file>` requires JWT.
- [ ] Scan endpoints rate-limited per IP (30/min) AND per user
      (60/min).
- [ ] Cloudinary upload signed; no anonymous direct upload to
      storage from the browser.
- [ ] Privacy Policy + Terms + Agricultural Guidance Disclaimer
      + Image/Data Consent Notice reachable from Settings.

## K. Railway deployment health

- [ ] `railway status` shows `● Online`.
- [ ] `railway deployment list` shows the latest commit ID as
      SUCCESS at the top.
- [ ] No stale bundle hash referenced in `index.html` (verified
      with `curl https://farroway.app | grep assets/index-`).
- [ ] No 5xx spike in the last hour of logs.
- [ ] Redis + Postgres both Online.

## L. Observability

- [ ] Scan success / failure events visible in admin analytics
      within ~1 minute.
- [ ] Rate-limit hits visible in admin monitoring dashboard.
- [ ] Notification opened / recommendation ignored / lifecycle
      created / harvest logged events all reach analytics.
- [ ] No raw image data or PII in analytics payloads.
- [ ] Analytics failure does NOT break the user-facing flow
      (verified by blocking the analytics origin in DevTools).

## M. Legal + trust

- [ ] Privacy Policy version stamp matches the deployed commit.
- [ ] Terms of Use accessible from onboarding + Settings.
- [ ] Agricultural Guidance Disclaimer visible on first scan
      result the user sees.
- [ ] Image/Data Consent Notice shown before the first scan
      capture (per region rules).

## N. Rollback readiness

- [ ] Previous SUCCESS deployment ID noted: `____________`
- [ ] `railway redeploy --deployment <prev-id>` tested in a
      staging window.
- [ ] Database migration rollback path verified or marked as
      "forward-only with feature flag".
- [ ] Support email / SMS line monitored during the launch
      window.

## O. Launch communication

- [ ] Invited-cohort email/SMS uses calm, expectations-setting
      language ("preview", not "official launch").
- [ ] Bug-report channel published in-app + in invitation copy.
- [ ] First-24h support roster published.
- [ ] Day-1 + Day-7 metric review meeting scheduled.

---

## Final verdict template

After walking sections A–O on a real device against the live
deploy:

- [ ] All A-section hard gates GREEN
- [ ] B–H signals stable
- [ ] I–O operational + legal items complete

Verdict (circle one):

  **SOFT LAUNCH READY** / READY WITH MINOR RISKS / NEEDS MORE QA / NOT READY

Reviewer: ____________ Date: __________ Commit: ____________
