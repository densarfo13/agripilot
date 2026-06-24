# PILOT_READINESS_REPORT.md

**Sprint #215 — pilot readiness (data-integrity lockdown).**
Date: 2026-06-19.

## North-star dashboard (`__pilotReadinessDashboard`)

Read-only composite over existing probes — never re-measures, never
fabricates:

| Metric | Source |
|---|---|
| Scan Success | `__scanMythosHealth` |
| FarmBrain Confidence | `__farmBrainExplanationHealth` |
| Task Completion | `__taskDedupHealth` |
| Review Queue Size | `__scanReviewQueueHealth.pendingCount` |
| Localization Health | `__languageConsistencyHealth` |
| Trust Gate Health | `__scanTrustGateHealth` |

## Acceptance (§14) — structural

| Test | Lock |
|---|---|
| duplicate scan | OfflineSyncGuardian idempotency |
| duplicate task | TaskDeduper (#212) |
| duplicate notification | NotificationDeduper (#212) |
| offline sync | idempotency key |
| language switching | LanguageSessionLock (frozen until explicit) |
| review queue | ReviewLifecycleManager (30/60d) |
| empty farm | setup guidance only |

## Verdict
**READY_FOR_PILOT (data integrity).** Every one of the 10 named risks
has a code-side lock + a build gate. The remaining open items are
unchanged and non-code: onboard the Phase-1 cohort (analytics stay
NEEDS_DATA until they act) + the translator's Twi/regional queue (#211).
