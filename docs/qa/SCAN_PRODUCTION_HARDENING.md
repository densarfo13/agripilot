# Scan + Runtime Production Hardening Checklist

Status: release-blocking gate. Run on a real device, with the
network throttled, before any production rollout that touches the
camera, the scan pipeline, or a deployed asset.

Companions:
- `docs/qa/REAL_DEVICE_QA_CHECKLIST.md` — device matrix
- `docs/qa/SIMPLE_FARMER_UX_CHECKLIST.md` — calm UX gate
- `docs/qa/WORLD_CLASS_UX_CHECKLIST.md` — world-class gate

This file is narrower: it is the **defensive** gate for the four
production failure modes — runtime listeners, asset 404s, auth
401s, and iPhone Safari camera timing.

---

## A. Camera + scan flow

- [ ] iPhone Safari camera opens reliably — the fallback UI does
      NOT appear before the stream has had a fair chance to start.
- [ ] Android Chrome camera opens reliably.
- [ ] Gallery upload always works, even when camera permission is
      denied or blocked.
- [ ] Retry works after a denied / blocked camera (one retry max,
      no infinite prompts).
- [ ] No broken-image "?" icon appears at any stage — preview,
      analyzing, result, error.
- [ ] Analysis auto-starts after capture (no manual "Analyze"
      button anywhere).
- [ ] Low-confidence result still keeps the preview, still
      provides retake guidance, still saves to Journal.

## B. Console hygiene

- [ ] No `tabs:outgoing.message.ready` / `No Listener` /
      cross-extension noise in the production console.
- [ ] No `Uncaught (in promise)` flooding.
- [ ] No repeated identical errors (throttled by
      `safeRuntimeLogger`).
- [ ] No `console.log` calls in the production bundle.

## C. Asset hygiene

- [ ] No HTTP 404 for any production asset reachable from Home,
      Scan, Tasks, Sell, or Funding.
- [ ] Logo / icon variants (`logo-premium*`) all resolve.
- [ ] Hero / realism images (`africa-sunrise-farm.jpeg`, etc.)
      all resolve.
- [ ] When an asset DOES 404 in production, the fallback chain
      (`safeAssetResolver`) shows the brand mark — never the
      broken-image icon.

## D. Auth + network

- [ ] Optional endpoints (e.g. `/api/v2/tts/status`) returning a
      401 do NOT break the rest of the app — the related feature
      disables quietly.
- [ ] No infinite retry loops on a 401 — at most one refresh-and-
      retry.
- [ ] 5xx failures on optional endpoints degrade gracefully (the
      `safeAuthFetch` `unavailable: true` shape).

## E. Weak network + offline

- [ ] On Slow 3G the scan preview still loads; analysis just
      takes longer — no premature fallback.
- [ ] Offline → scan / task / journal queues; reconnect drains
      once with no duplicates (`offlineQueue` dedupe by kind +
      payload.id).

## F. Observability — counters populating

- [ ] `observabilityTracker` shows non-zero counts for the
      events you triggered during the test (API failures, scan
      failures, runtime errors).
- [ ] `safeScanImagePipeline` / `safeCameraBootstrap` counters
      reflect the bootstrap stages you observed.

---

## Pass criteria

The build is **PRODUCTION READY** when every box in A–F is ticked
on at least: iPhone Safari, Android Chrome, and a low-end Android
device. A failure in A or B is a launch blocker. C–F failures are
hardening debt — log them, but they do not block a controlled
pilot unless they reproduce on every test.

## How to run

```
npm run lint
npm run test
npm run validate:production   # asset / icon / url / intelligence / translations
npm run build:safe            # the full chain + build
```

If `validate:production` fails, the first failing gate is the
release blocker — fix it before promoting.
