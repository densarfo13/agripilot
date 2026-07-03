# Real Device Scan Verification — the 10-minute operator script

**This is the step no sandbox can run. Everything below is one phone and one login.**

1. On a real phone (iPhone Safari first, then Android Chrome), log in at **farroway.app** as admin.
2. Open **/scan** → run ONE real scan of any supported crop/plant (camera, then repeat via gallery).
3. **If it succeeds:** confirm the result shows identification + confidence + next action, and the
   timeline saved. Then `GET /api/admin/scan/last-trace` → confirm `providerStatus`, `latencyMs`,
   `candidateCount`, `correlationId` populated. **The provider cert begins flipping DEGRADED→READY.**
4. **If it fails in ANY way:** open **/admin/scan-debug** → tap **Export Debug JSON**. The file
   contains `failingStep`, `crash.message`, `componentStack`, browser/device, image type/size,
   provider status, latency, and the `correlationId` — matched to the server trace (`?cid=`).
   Send that file back; the fix becomes a one-line change at the named line.
5. Repeat once with **airplane mode on** → confirm the scan queues (`SAVED_FOR_RETRY` copy, photo
   kept) and drains after reconnecting.
6. Check `/admin/scan-health` and Mission Control (`/admin/pilot-analytics` + launch command
   center): the first real numbers should appear — including the new verbatim events
   (`scan_opened` … `scan_result_success`).

Acceptance = either a confident result on step 3, or an Export Debug JSON on step 4. **Both outcomes
advance the platform; only silence doesn't.**
