# Field Readiness Report (RC1)

The 10 adverse field scenarios. **CODE-VERIFIED** = the handling logic exists and is unit-tested /
gate-covered. **DEVICE-PENDING** = the logic is present but must be confirmed on a real phone in
real conditions. Nothing here is claimed as passed on a device from this environment.

| Scenario | Status | What the code does |
|---|---|---|
| Poor internet | **CODE-VERIFIED** | offline queue + exponential backoff + syncCoordinator; requests retried, not lost. |
| Fully offline | **CODE-VERIFIED** | offline artifact + queued writes; honest "offline" state; no data loss (persistence-tested). |
| GPS denied | **CODE-VERIFIED** | falls back to town/ZIP entry; location never blocks the app (login→home routing). |
| Camera denied | **CODE-VERIFIED** | ScanStartupBanner denied-permission path + PlainUploadFallback (upload instead of live camera). |
| Weather unavailable | **CODE-VERIFIED** | honest no-feed state; never fabricates weather (FarmBrainState no_live_feed). |
| Plant.id unavailable | **CODE-VERIFIED** | classifyProviderFailure (AUTH/CREDITS/RATE_LIMIT/NETWORK/TIMEOUT) → honest "scan service busy" (serviceUnavailable), never a fake diagnosis. |
| Slow API | **CODE-VERIFIED** | scanRetry retries transient only; timeout classified; startup banner shows progress at 3s/5s. |
| Network timeout | **CODE-VERIFIED** | http 408/504 → TIMEOUT (retriable); terminal failures short-circuit (no infinite spin). |
| Low battery | **DEVICE-PENDING** | no battery-specific code path; needs device observation (likely fine — lightweight PWA). |
| Older phones | **DEVICE-PENDING** | chunk-load recovery + error boundaries + safe loaders exist; real low-end device pending. |

## Summary
8/10 scenarios are **code-verified with tests/gates**; the failure-handling philosophy is
consistent — *degrade honestly, never fabricate, never dead-end, never lose data*. The 2
device-pending items (battery, old-hardware) have no adverse code path but need a real phone.

**Field readiness: logic PASS, on-device simulation PENDING.** This is the internal-pilot field
test (PILOT_READINESS.md), and it's the highest-value next action.
