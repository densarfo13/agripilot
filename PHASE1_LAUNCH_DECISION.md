# PHASE1_LAUNCH_DECISION.md

**Farroway Phase-1 Launch Decision.** Date: 2026-06-24. Sprint #223.
Basis: PILOT_HARDENING_REPORT.md + PILOT_PREMORTEM.md + SCAN_ACCEPTANCE_TEST.md.
Scope: farmers-only Phase-1 (marketplace/buyer frozen). build:safe green.

---

# VERDICT: ✅ READY FOR PILOT

**Ready for a supervised pilot now. NOT yet READY FOR 100 FARMERS.**

---

## Why READY FOR PILOT (not NOT READY)
This cycle closed every **embarrassment-class** defect on the farmer path:
- **No crash** — the upload-fallback `ReferenceError` is fixed (F1); the scan
  route never throws a raw error; auth boot is fail-safe.
- **No security incident** — SSRF closed (F2), PII removed from logs (F3),
  cross-user idempotency replay closed (F4).
- **No English in front of a Twi farmer** — the primary scan card (65 keys,
  #222) and 60 scan-result strings are now real Twi + Hausa; raw-key leaks are
  impossible (registration gate); regression is blocked (distinctness ratchet).
- **No dead-ends** — blurry/invalid/large/empty-provider all degrade to
  friendly guidance; "Unknown Plant" can't render; provider-down shows
  "service unavailable", not a mislabel.

The core promise — *scan → identify → say it in your language → save it →
remind you* — works end to end and is safe to show.

## Why NOT READY FOR 100 FARMERS
At 100 unsupervised farmers on rural networks, the open **HIGH** items bite:
- **H1 — No server persistence.** My Plants + scan history are localStorage-
  only. At scale, cache eviction / device changes = silent permanent data
  loss → wrecks the D1/D7 retention the pilot measures.
- **H2 — No offline shell.** Every cold open re-downloads the bundle; on 2G/3G
  that's a blank screen and first-open abandonment for many of 100 farmers.
- **H3/H4 — Data integrity.** Duplicate scan rows (no `scanId` unique) and the
  phantom `prisma.farm` model (farm signals silently dead) corrupt the very
  analytics you'd use to judge a 100-farmer cohort.

These are **scale + durability** gaps, not demo-blockers — which is exactly
why a *supervised* pilot is the right next step and a 100-farmer launch is not.

---

## Conditions for the LIMITED PILOT (do these)
1. **Farmers only** — do not enroll buyers (marketplace dark).
2. **10–30 farmers, field-officer supported** (can re-onboard on data loss).
3. **One device per farmer, generally online.**
4. **Pre-flight every demo** with FARMER_DEMO_CHECKLIST.md — especially
   `GET /api/scan/diagnostics?live=1` → `httpStatus:200`.

## Gate to promote PILOT → READY FOR 100 FARMERS
- [ ] **H1** server persistence for My Plants + scan history.
- [ ] **H2** minimal offline precache shell.
- [ ] **H3** `scanId` unique + real upsert + drop double-write.
- [ ] **H4** fix the phantom `prisma.farm` query (restore farm signals).
- [ ] **H5** explicit `onDelete` on legacy subtrees.
- [ ] Native Twi + Hausa review of this cycle's first-pass strings (L-tier).

## What changed this cycle (evidence the bar moved)
7 risk classes fixed and gate-locked: upload crash, SSRF, PII-in-logs,
idempotency replay, primary-card i18n leak, 60 English-identical scan strings,
+ a distinctness ratchet so leakage can't regrow. build:safe green.

---

### One-sentence call
**Put it in front of 10–30 supervised farmers now; close H1–H5 before you put
it in front of 100.**
