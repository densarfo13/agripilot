# FARROWAY_PHASE1_GO_NO_GO.md

**Phase-1 launch decision — farmer zero-day simulation.** Sprint #224.
2026-06-24. Adoption risk only.

## Launch score: **68 / 100** (Phase-1 *supervised* pilot)

| Dimension | Weight | Score | Notes |
|---|:--:|:--:|---|
| Hero loop (scan → identify → task) | 25 | **22** | Provider auth fixed, camera/HEIC/blurry hardened, no "Unknown Plant", no Create-Task on unidentified. −3: provider must be verified live; onion/maize confidence genuinely lower than tomato. |
| Onboarding → first value | 10 | **7** | Clean 2-field start, non-blocking location. −3: dual onboarding paths; scan-first users hit an empty plan until a farm exists. |
| Localization (scan path) | 15 | **11** | `scan.intel`/`scanCommand` now registered; 65+60 Twi/Hausa keys translated; distinctness ratchet added. −4: first-pass (needs native review) + ~190 English-identical values remain app-wide. |
| Data durability | 15 | **7** | Honest, never-crashing stores. −8: **My Plants + history are localStorage-only — silent total loss on cache-clear / new phone.** |
| Network resilience | 15 | **8** | Offline scan queue + 8s timeout → rule fallback. −7: **no service worker → no offline app shell; cold 2G open = blank screen.** |
| Retention / re-engagement | 10 | **5** | In-app bell works. −5: **no push** (web closed-app reminders never fire); plant-add emits no timeline event. |
| Safety / security / integrity | 10 | **8** | #223 fixed SSRF, PII-in-logs, idempotency scoping. −2: duplicate scan rows (no `@@unique`), phantom `prisma.farm` leaves farm-signals dead. |
| **Total** | **100** | **68** | **READY FOR PILOT (supervised) — NOT for 100.** |

## Can 10 farmers succeed? **YES** ✅ (≈85% confidence)

Conditions: **supervised** (a field officer present), **agronomy-scoped**
(scan + tasks + advice; **Sell/Buyer hidden**), Twi-supported, on a
reasonable network, and **provider verified live**
(`/api/scan/diagnostics?live=1 → 200`). The hero loop is solid and the
failure paths (blurry, unidentified, provider-down) are honest and safe.
Persistence/offline/push gaps are absorbed by supervision and short
duration. Do the **5 S-effort fixes** (TOP_25 #1, #4, #11, #13, #16-hide)
first — all small.

## Can 100 farmers succeed? **NOT YET** ⚠️

Blocking gaps at unsupervised scale:
- **#2 server persistence** — without it, a meaningful fraction will
  clear data / change phones and **lose everything**, silently. Fatal to
  the retention metric the pilot measures.
- **#3 offline app shell** — rural 2G cold-opens will blank-screen and
  abandon before first paint.
- **#5 push** — no Day-2/Day-7 nudge = retention decays with no recovery.
- **#4 Twi voice + #7 translation review** — the low-literacy persona
  (a large share of 100) depends on voice, which is hollow in Twi.
Land #2/#3/#4/#5/#7 and 100 becomes realistic.

## Can 1000 farmers succeed? **NO** ❌

Beyond the above: the **marketplace is three disconnected stores** with a
cross-device dead-end and no buyer signup; **duplicate scan rows** and
the **phantom-farm** bug compound at volume; full 6-locale quality,
per-user rate limits, and support tooling aren't there. 1000 is a
post-Phase-2 question.

## Final recommendation: **LIMITED PILOT — GO (supervised, 10–30)**

Launch a **supervised Phase-1 pilot of 10–30 farmers**, scoped to
**scan + daily tasks + advice**, with **Sell/Buyer hidden**, after the
five S-effort fixes and a green live-provider check. This is the
founder's standing **"READY FOR PILOT"** line — and it's the right one:
the product's core promise (point your phone at a sick plant, get a
clear next action in your language) now holds. **Do not open to 100**
until server persistence, an offline shell, push, and a Twi voice/text
fallback are in — those four are the gate, and they're already named and
scoped in TOP_25_PILOT_FIXES.md (#2, #3, #4/#7, #5).

**One-line verdict:** *Impossible to embarrass in front of 10 supervised
farmers today; not yet safe in front of 100 unsupervised — and the gap
between those two is four well-understood fixes, not a mystery.*
