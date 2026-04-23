# Farroway launch checklist

Run this before every pilot, App Store submission, or partner demo.
The goal is zero embarrassing breakage on day one.

## 1. Automated guardrails (must pass)

```bash
# Runs every CI guard + the production-safety test suite + build.
npm run launch-gate
```

Expected: ends with `✓ Launch gate passed. Safe to deploy.`

For a fast pre-commit check without the full build:

```bash
npm run launch-gate:fast
```

If any step fails, the message tells you which file and what to fix.
Do not deploy until every guard is green.

## 2. Individual guards (for isolated debugging)

| Command | What it checks |
|---|---|
| `npm run guard:prisma` | No `--accept-data-loss` flag on any deploy path |
| `npm run guard:crops` | Legacy `cropType` reference count hasn't grown past the baseline |
| `npm run guard:i18n` | Hindi translation coverage meets per-domain thresholds |
| `npm run guard:duplicate-crops` | Deprecated crop lists haven't grown |
| `npm run guard:env` | Required prod env vars are set; optional providers noted |

## 3. Server test suite

```bash
cd server && npm test
```

The critical subset (run inside the gate):

- `productionSafety.test.js` — the gap tests from the audit
- `cropEngine.test.js` — registry + normalization
- `topCropEngine.test.js` — Top Crops ranking
- `seasonalCropEngine.test.js` — season/weather fit
- `rainfallFitEngine.test.js` — rainfall state + per-crop water profiles
- `farmEconomicsEngine.test.js` — yield/value/profit pipeline
- `insightEngine.test.js` — dashboard insight engine
- `insightNotificationAdapter.test.js` — in-app/sms routing
- `channelRouting.test.js` — WhatsApp + voice routing

## 4. Production env vars (hosting dashboard)

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_API_BASE_URL` (must be set at **build time**, not runtime)

Optional (providers degrade gracefully):
- Twilio: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
  (short-form `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_PHONE` also accepted)
- WhatsApp: `TWILIO_WHATSAPP_FROM` (required for WhatsApp alerts only)
- Voice: `TWILIO_VOICE_FROM` (falls back to `TWILIO_PHONE_NUMBER`)
- Email: `SENDGRID_API_KEY`
- MFA: `MFA_SECRET_KEY`

Run `npm run guard:env` in your shell with the production `.env`
loaded to confirm everything is set.

## 5. Critical manual tests (top 10)

Run these on a real device (not Chrome devtools) before any pilot.

1. **Fresh pilot farmer end-to-end** — signup → verify → create farm
   (crop=cassava, 1000 m², Ghana) → see recommendations → tap
   "Use this crop" → see today's insights → log out → log back in →
   farm still there.
2. **Shared-device logout** — farmer A logs in, creates data, logs
   out. Farmer B logs in on the same device. Farmer B must see a
   clean state (no A data, no A notifications, no stale farm
   context).
3. **Offline for 20+ days** — airplane-mode a device, complete 5
   tasks, record 1 harvest, reconnect, confirm all 6 actions reach
   the server without duplicates.
4. **Language switch** — EN → HI → SW → TW while on the dashboard.
   Every insight, crop label, duration, and currency relabels. No
   English strings visible in HI screenshots.
5. **Farm edit** — change `cropType: 'tomato'` → `'cassava'` →
   reload. `getCropTimeline` picks up cassava lifecycle; tasks
   reflect cassava stages; recommendations update.
6. **Extreme-weather alert** — seed `weatherState='heavy_rain' +
   rainfallFit='low'` for a tomato farm → dashboard shows flood
   warning → server cron dispatches WhatsApp (if opted-in) within
   one hour.
7. **Stale-build trap** — deploy version N, open app on slow
   connection, deploy version N+1 with a breaking API change,
   refresh — confirm service worker reloads to N+1 within 30s or
   shows a "Please reload" banner.
8. **Invalid MFA code probe** — log in with farmer A's email +
   password → receive mfaToken → POST to `/auth/mfa/verify` with a
   random code. Must 401.
9. **Currency sanity** — GH farmer with cassava 2000 m² — value in
   GHS, cost in GHS (NOT USD), profit range arithmetic consistent.
10. **Prisma migration dry run** — commit a schema change (e.g. add
    a field to `FarmProfile`), run `prisma migrate deploy` locally
    against a fresh DB, confirm no data loss.

## 6. Post-deploy smoke

Within 10 minutes of deploy:

- Open the app on a phone, log in, confirm the dashboard renders.
- Create a test farm; confirm it appears in the database.
- Switch language to Hindi; confirm insight cards render HI.
- Check server logs for any unexpected `ERROR` or `FATAL` lines.
- Trigger the daily-notification cron manually (or wait until 08:00
  UTC) and confirm at least one in-app notification lands.

If anything goes wrong, the rollback plan is `git revert <sha> &&
railway up --detach` plus a service-worker cache bump (`v<n+1>`) to
evict stale clients.
