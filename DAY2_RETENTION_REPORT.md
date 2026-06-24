# DAY2_RETENTION_REPORT.md

**Sprint #217 — Day-2 retention.** Date: 2026-06-19.

`Day2RetentionEngine`:
- `isDay2Due(activation, asOf)` — true in the ~24-48h window after
  activation.
- `buildDay2Brief(...)` — ONE "Today's Farm Brief": Farm Health · Top
  Risk · Today's Action + a single CTA (→ /tasks if an action exists,
  else /scan). Composes existing signals; never fabricates a risk.
- `trackDay2('opened'|'dismissed'|'completed')` + `readDay2Engagement()`
  — the engagement loop.

One CTA only (gate-asserted `oneCTA`). The brief reuses the same Home
hero values, so Day-2 and Home never disagree.

## Pre-pilot reading
**NEEDS_DATA** — the trigger is dormant until a farmer activates. Wired
+ gate-locked. Health: `__day2RetentionHealth().triggerHours = 24`.
