# TECHNICAL_DEBT_REGISTER

Honest accounting of known gaps. None are hidden; each has an owner-type
(operator = needs you; code = a future sprint).

## Blockers to higher pilot tiers (operator)
| Item | Impact | Owner |
|---|---|---|
| `CROP_HEALTH_API_KEY` / `INSECT_ID_API_KEY` / `MUSHROOM_ID_API_KEY` / `AMBEE_API_KEY` not confirmed on Railway | crop.health/insect/mushroom/soil report not-ready or not_wired at runtime | operator |
| Live crop-photo accuracy run (Plant >95% / Disease >90% / Insect >90%) | scan accuracy is PENDING — cannot be certified from code | operator |
| 10→50→100 farmer field data (adoption, satisfaction, outcomes) | verdict capped at pilot tier until collected | operator |
| Live performance timing (<1s home / <4s scan / <500ms rec) | budgets gated in CI; field timing unmeasured | operator |

## Code debt (future sprints, ranked)
1. **Universal Scanner classes** — weed / disease / irrigation-equipment are not
   yet object classes (Engine 1 partial).
2. **Crop.health / Mushroom inference adapters** — keys are read, but a keyed
   provider still reports `not_wired` until its call adapter is exercised end-to-end.
3. **Sentinel Hub** — not integrated (Engine 2); satellite remains an honest stub.
4. **Business Engine (9)** — honest-null by design (no live market/funding feed);
   on the pilot freeze list. Needs a real data source before it can do anything.
5. **Dynamic-text localization** — engine-generated recommendation strings are
   English; only static labels are localized (Engine 13 partial). Hindi hidden
   until ~2,987 keys translated.
6. **i18n distinctness ratchet** — fr baseline carries cognate exceptions
   ("fruit", "min"); revisit when real translations land.
7. **Repo hygiene** — `server/intelligence/dist/` is tracked (CRLF churn every
   commit); candidate for gitignore + build-time generation.
8. **Certification sprawl** — 6 certification composites now exist with the same
   `LIMITED_PILOT` verdict; consolidate into one once field evidence unlocks tiers.

## Non-debt (intentional)
Honest-null fields (yield/market/funding/buyers), the feature freeze, and the
"measured not assumed" provider readiness are design choices, not debt.
