# REAL_DEVICE_SCAN_REPORT.md — Farroway

> 2026-07-07 · BLOCKER 1. **Status: NOT EXECUTED — cannot be executed from this environment.**
> A real device scan requires a physical phone, a camera, a real plant photo, live provider keys, and
> network — none of which exist here. Fabricating a diagnosis/confidence/history would be exactly the
> dishonesty the mission forbids ("Capture evidence" — there is no evidence to capture without a device).
> This report is therefore the **operator runbook + evidence template** to execute it, plus the honest
> current state of each checkpoint verified in code.

## Why this is the #1 blocker and only an operator can close it
The standing release blocker (RELEASE_PLAN criterion #1, W1) is that a device reaches the fallback
*after* a 200 from the scan API. The exact client exception is persisted on-device and awaits the
operator tapping **Export Diagnostic Report**. No amount of code or static analysis substitutes for
one real scan reaching the result screen on that device.

## Checkpoint status (code verified here / device pending)
| Checkpoint | Code path exists (verified) | Real-device result |
|---|---|---|
| Upload | `POST /api/scan/analyze` (multipart) + `PlainUploadFallback` | ⏳ pending device |
| Provider | server-side Plant.id/Kindwise adapters; `/api/scan/diagnostics` | ⏳ pending (needs Railway keys) |
| Diagnosis | envelope carries plant/issue candidates | ⏳ pending |
| Confidence | confidence band + `confidencePct` in envelope | ⏳ pending |
| History | `GET /api/scan/history` reads `ScanTrainingEvent` | ⏳ pending (was 401 pre-W2; W2 fixed `req.user.id`) |
| Tasks | `followUpEngine.js` creates follow-up tasks from a scan | ⏳ pending |
| Timeline | scan → farmer timeline surface | ⏳ pending |
| Marketplace sync | listing/readiness surfaces | ⏳ pending |
| NGO metrics | `buildPilotMetrics` → now includes real scan evidence (shipped today) | ⏳ pending (needs real scans to populate) |

## Operator runbook (execute on the failing device)
1. Deploy is live at `origin/master` (`e663737e`); confirm the build on Railway.
2. Ensure provider keys are set at Railway; verify `GET /api/scan/diagnostics` → `apiKeySet:true`.
3. On the device: open the app → Scan → take one real leaf photo → submit.
4. If it reaches the result screen: **capture** the debug envelope (`/admin/scan-debug` → Export Debug
   JSON) — this is the evidence. Record: plant, issue, confidence, provider, latency (`phase` timings).
5. If it hits the fallback after the 200: tap **Export Diagnostic Report** → send the JSON
   (message/stack/componentStack/correlationId/scanId/phase). Fix the identified defect at source, add
   a regression test, redeploy, repeat until step 4 passes.
6. Then verify downstream: `/api/scan/history` shows the scan, a follow-up task was created, the
   timeline updated, and the NGO pilot-metrics `scan` section increments.

## Honest verdict
**BLOCKER 1 remains OPEN.** It is closeable only by an operator on a real device, in ~10 minutes, once
provider keys are confirmed at Railway. The code is staged for every checkpoint; the evidence does not
exist until the scan runs for real.
