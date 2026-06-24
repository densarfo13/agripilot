# DATA_INTEGRITY_REPORT.md

**Sprint #215 — production hardening + data integrity lockdown.**
Date: 2026-06-19. Off the frozen list; composition + guards only.

## The 10 risks, mapped

| # | Risk | Lock |
|---|---|---|
| 1 | Duplicate plant creation | `DuplicatePlantDetector` — >90% similarity → "may already exist", default View Existing |
| 2 | Duplicate task generation | reused `TaskDeduper` (#212) — one active task per plant·action·date |
| 3 | Notification spam | reused `NotificationDeduper` (#212) — merge same type·plant·day |
| 4 | FarmBrain contamination | `FarmBrainIngestionGuard` extended — confidence ≥70 + quality ≥75 + trust PASS, else `memoryRejectedReason` |
| 5 | Review queue growth | `ReviewLifecycleManager` — 30d archive · 60d delete-if-unreviewed |
| 6 | Orphan scans | trust gate routes blocked-but-photographed scans to the review queue (#214) |
| 7 | Language fallback regressions | `LanguageSessionLock` — locale frozen until explicit change |
| 8 | Offline sync corruption | `OfflineSyncGuardian` — idempotency key blocks duplicate uploads / double scans |
| 9 | Timeline duplication | `TimelineWriteGate` — same scan/event/task can't be written twice |
| 10 | Empty farm recommendations | no crop/date → setup guidance only (no care tasks / harvest / disease) — #208 AdaptiveTaskGenerator returns null, #212/#207 guided setup |

## Declined as duplicate (Execution Policy)
- `TaskDeduplicator.ts` (§2) → reuse `TaskDeduper.ts` (#212).
- `NotificationDeduplicator.ts` (§5) → reuse `NotificationDeduper.ts` (#212).

## Health globals
`__duplicatePlantHealth · __timelineHealth · __offlineSyncHealth ·
__languageSessionLockHealth · __pilotReadinessDashboard · __taskHealth ·
__notificationHealth` (+ #214 trust/quality/review/ingestion).

## Build gates
`check:duplicate-plant · check:timeline-lock · check:offline-sync-guard ·
check:farmbrain-memory-quality` (+ #214's four) wired into build:safe.
