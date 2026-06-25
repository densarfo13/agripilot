# SCAN_CREDIT_MONITOR_REPORT — P0 §8

## What was added
`src/runtime/scan/credits/ScanCreditMonitor.ts` — a client monitor that mirrors
the server credit monitor (`GET /api/admin/scan-credits`, which reads Kindwise
`usage_info`) into `window.__scanCreditHealth()`.

Tracks, per provider: `credits`, `dailyBurnRate`, `estimatedDaysRemaining`, and
an alert level. Aggregate: overall `dailyBurnRate`, soonest
`estimatedDaysRemaining`, and `worstAlert`.

## Thresholds (alerts)
- `< 100` → **low**
- `< 50` → **warn**
- `< 20` → **critical**
- no data / un-keyed provider → **unknown** (never a fabricated 0)

## Health envelope
```
window.__scanCreditHealth() → {
  plantIdCredits, cropHealthCredits, insectIdCredits,
  dailyBurnRate, estimatedDaysRemaining, worstAlert, providers[], checkedAt
}
```

## Current status (honest)
- **Plant.id** — keyed; credit numbers populate once `/api/admin/scan-credits`
  reaches Kindwise `usage_info` (admin-auth).
- **Crop.health / Insect.id** — **unkeyed → `credits:null`, alert `unknown`.**
  The monitor does **not** invent a credit balance for an unconfigured provider.

Once the missing keys are set, their balances and burn rates populate
automatically — no code change. The server-side monitor + admin card (sprint
#225) remain the source; this adds the client health global the P0 spec asks
for and composes the same data.
