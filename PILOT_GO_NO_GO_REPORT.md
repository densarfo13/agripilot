# Pilot Go / No-Go Report

## DECISION: 🟡 GO for controlled pilot · NO-GO for public launch

## Why GO (pilot)
- Scan can **no longer dead-end**: `resolveScanTerminalState` guarantees every scan resolves to one
  of 11 named states with a farmer-safe message; a result-render crash → "saved for review"; the
  P0 safety lock blocks any farm mutation on failed/low-confidence scans. All unit-tested + gated.
- `build:safe` green; provider (`PLANT_ID_API_KEY` → plant.id v3) is real; admin trace + telemetry
  present; offline queue + retry + notify all exist.

## Why NO-GO (public)
Evidence that only a real device / pilot can produce is still absent:
- **Real-image scan accuracy** — the live provider cert reads NOT_CERTIFIED until a real scan.
- **Performance** — not runtime-measured.
- **Security** — no independent pen-test / dependency scan.
- **Telemetry** — zero production events (no pilot yet).

## Real-scan verification — operator-gated (cannot be done from this environment)
I cannot run a production scan at farroway.app from here. When you do:
1. Scan a supported crop on a real phone.
2. `GET /api/admin/scan/last-trace` → confirm `imageReceived`, `providerStatus`, `latency`,
   `candidateCount`, `topCandidate`, `finalVerdict`, `queued`.
3. If it shows the "saved for review" card, capture `window.__scanResultCrash.message` +
   `.componentStack` → names the exact render-throw field for a one-line source fix.

That single run flips the provider cert and moves the launch ladder — the blocker is operational,
not code. Convergent verdict across engines: **⚠ PILOT READY.**
