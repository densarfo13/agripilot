# FARM_SUCCESS_ENGINE_REPORT.md

**Sprint #217 — Farm Success Score.** Date: 2026-06-19.

`FarmSuccessEngine.buildFarmSuccess(...)` → 0-100 success score + an
itemized why (✓ done) / missing (○ next) list. It **reuses the #212
FarmerCompletion engine** rather than re-implementing the score, so
"farm success" and "setup completion" can never diverge. Each ✓ exists
only when its datum genuinely exists (crop / scan / task / outcome).

No score without explanation (gate-asserted) — the why/missing lists
ARE the explanation. Renders above the Home fold alongside Farm Health /
Today's Action.

Health: `__farmSuccessHealth().reusesCompletion = true`.
