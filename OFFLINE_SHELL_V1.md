# OFFLINE_SHELL_V1

**PWA service worker so the app launches with no signal / on 2G/3G**, with
an "Offline mode active" banner and offline queueing + auto-sync. Closes
the pre-mortem's #2 gate-to-100 item (no offline shell on rural networks).

## ⚠️ The landmine this had to avoid

A prior sprint **deliberately removed the service worker** — `index.html`
and `forceUiReset.js` unregister every SW + purge every cache on each boot
— because an earlier SW kept farmers on a **stale shell across deploys**
(white screens, dead chunks). Naively "installing a SW" would re-introduce
exactly that bug for every user, and a bad SW is *persistent*. So this V1
is designed to make staleness structurally impossible, and it reconciles
the deliberate kill instead of fighting it.

## How staleness is made impossible

| Request | Strategy | Why it can't go stale |
|---|---|---|
| Navigation (HTML shell) | **network-first**, cache fallback | online always fetches fresh `index.html` (current chunk hashes); offline serves the last good shell |
| `/assets/*` (JS/CSS) | **cache-first** | filename hash changes per build → a cached asset is immutable |
| `*.json` (translations / crop library / knowledge) | **stale-while-revalidate** | shows cached instantly, refreshes in background |
| `/api/*` and all non-GET | **pass-through (never cached)** | the app's own offline queues handle writes |

Plus: **versioned caches** (`fwshell-v1` / `fwassets-v1` / `fwdata-v1`)
purged on `activate`; `skipWaiting` + `clientsClaim` so a deploy rolls out
immediately; a `KILL_SW` message for emergency self-removal; and the
existing **ChunkLoadError auto-recovery** (clears SW+caches, reloads once)
remains as the ultimate backstop.

## Reconciling the deliberate SW-kill

The two killers were changed to **spare** the new shell rather than nuke it:
- **`forceUiReset.killServiceWorkerAndCaches()`** — when `OFFLINE_SHELL_ENABLED`,
  it no longer unregisters SWs and **skips** `fwshell-/fwassets-/fwdata-`
  caches, while still purging *legacy* `farroway*`/`workbox*` caches.
- **`index.html`** inline cleanup — the unconditional "unregister all SWs"
  block is removed; cache cleanup explicitly skips the shell prefixes.
- **`OFFLINE_SHELL_ENABLED`** (`offlineShellConfig.js`) is the one-line kill
  switch: flip to `false` + redeploy → forceUiReset resumes purging the SW
  on every boot and registration stops. No code archaeology needed.

## Launch behavior (the requirement)

- **No signal / 2G / 3G cold open** → the shell is served from cache;
  hashed assets from cache; the app boots offline (after at least one
  prior online load — you can't cache what was never fetched, which is the
  inherent PWA model).
- **"Offline mode active"** → `OfflineBanner` (direct import, in the main
  bundle so it works offline) shows a fixed banner whenever the device is
  offline, with "Your scans and tasks will sync when you reconnect."
  Localized across all 6 locales.

## Queue + auto-sync (already in place, now surfaced)

- **Scans** → `offlineScanQueue` (queues + drains on reconnect).
- **Tasks / plants / outcomes / timeline / updates** → `farmSync` queue
  (FARM_PERSISTENCE_V1) — drains on `online` + 60s tick + login recover.
- The banner + `__offlineShellHealth()` make the offline state visible;
  the queues do the syncing.

## Diagnostics

`window.__offlineShellHealth()` →
`{ enabled, swSupported, registered, controlled, updateApplied, online, error }`.

## Honest V1 boundaries

- **First load must be online** — a SW can only serve what it has already
  cached. A farmer's very first open needs signal; every open after that
  works offline.
- **No background sync API** — queues drain on the next foreground +
  reconnect, not via the (patchy-support) Background Sync API. Fine for the
  pilot device class.
- Native (Capacitor) builds skip this SW — they ship their own shell.

`check:offline-shell` gate locks the safe design + the kill reconciliation
so a future change can't quietly re-introduce the stale-shell bug.
