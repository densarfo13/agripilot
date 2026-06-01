# Farroway V13 — Acceptance Test

Operator checklist for the institutional data/MLOps readiness layer. Every
check is **read-only**. Nothing fakes ML, invents yield, fabricates
outbreaks, exposes private farmer data, or blocks the core flow.

> All V13 intelligence is **decision support, not a guarantee.**

---

## A. Build
```
npm run build:safe
npm run build
```
- [ ] `build:safe` passes, including the 10 V13 gates (`check:v13-*`).
- [ ] `npm run build` (vite) compiles clean.

## B. Command center
1. [ ] Open `/internal/v13` as admin → renders; non-admin denied.
2. [ ] No fake metrics — panels show real probe output or "Not enough data yet."
3. [ ] `window.__v13Health()` returns the full readiness envelope with honest
       `verdict` + `blockers` + `warnings`.

## C. Protected flows (no regression)
4. [ ] Scan/upload still works.
5. [ ] Login still routes Home.
6. [ ] Language still persists.

## D. Honesty / privacy
7. [ ] NGO reports are org-scoped: `window.__analyticsExportHealth()
       .organizationScoped === true`, `privacyFiltered === true`;
       `window.__v13GovernanceHealth()` surfaces org/buyer/export privacy.
8. [ ] Buyer cannot see private farmer data — no PII / scan detail in any
       export or supply signal.
9. [ ] Yield prediction says not ready unless data is sufficient:
       `window.__yieldPredictionReadinessHealth().readyForYieldModel === false`
       with a `missingData` list at pilot stage.
10. [ ] Regional network says not enough data if sample size is low:
        `window.__regionalNetworkHealth()` shows empty signals + "Not enough
        regional data yet" below 10 scans / 2 farms.
11. [ ] Model registry: `window.__modelRegistryHealth().productionApprovedCount
        === 0` (no model production-approved without metrics).
12. [ ] Event sourcing: `window.__eventSourcingHealth()` asserts
        `idempotencyRequired`, `tenantScopeRequired`, `noUIDirectWrites`, and
        lists the 26 canonical events.

### Pass criteria
All boxes checked AND the protected flows behave exactly as before. V13 is
additive, readiness-only, explainable, honest, org-scoped, and never blocks
scan/upload/login.
