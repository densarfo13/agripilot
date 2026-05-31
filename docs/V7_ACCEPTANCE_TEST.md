# Farroway V7 — Acceptance Test (§12)

Operator checklist for the institutional agricultural intelligence platform.
Every check is **read-only**. Nothing writes data, prescribes chemicals,
predicts exact yield, exposes PII, or blocks the core flow.

> All V7 intelligence is **decision support, not a guarantee.**

---

## A. Build

```
npm run build:safe
npm run build
```

- [ ] `build:safe` passes, including the 6 V7 gates:
      `check:v7-no-fake-intelligence`, `check:v7-ooda-safety`,
      `check:v7-artifacts`, `check:v7-tenant-isolation`,
      `check:v7-remote-sensing-claims`, `check:v7-assistant-safety`.
- [ ] `npm run build` (vite) compiles clean.

## B. V7 Command Center

1. [ ] Open `/internal/v7` as an admin → renders; non-admin is denied.
2. [ ] No fake metrics anywhere — panels show real probe output or
       "Not enough data yet."
3. [ ] `window.__v7Health()` returns `{ predictiveReady, ngoIntelligenceReady,
       marketplaceIntelligenceReady, remoteSensingReady, assistantReady,
       institutionalReady, oodaReady, artifactReady, verdict, blockers,
       warnings }` with honest blockers/warnings.

## C. Protected flows (MUST still work — no regression)

3. [ ] Scan/upload still works; camera opens.
4. [ ] Login still routes Home.
5. [ ] Language still persists across reload.
6. [ ] Tasks, Activity, Offline, Invites, NGO/Buyer foundations unchanged.

## D. Module checks

6. [ ] NGO data is org-scoped: `window.__ngoIntelligenceHealth()` has
       `organizationScoped:true`, `crossTenantLeakage:false`, no PII.
7. [ ] Buyer/marketplace hides private data:
       `window.__marketplaceIntelligenceHealth()` exposes no disease/pest/
       severity/PII — only coarse readiness + trust status. No payments/escrow.
8. [ ] Remote sensing shows readiness only:
       `window.__remoteSensingHealth()` has `activePredictionEnabled:false`
       and "Not enough remote data yet" unless real API data is stored.
       No fabricated NDVI.
9. [ ] Assistant gives top 3 actions only:
       `window.__farmAssistantHealth().value.top3Actions.length <= 3`;
       localized greeting; `voiceReady` discloses fallback; no scary words.
10. [ ] `window.__v7Health()` returns honest blockers/warnings (e.g. modules
        that are "Not enough data yet or not wired" appear as warnings).

## E. Predictive + Institutional

- [ ] `window.__predictiveHealth().value` = `{ diseaseRisk, pestRisk,
      weatherRisk, cropStressRisk }`, each `low|elevated|high|unknown`.
      No exact yield/revenue. `'unknown'` when data is thin.
- [ ] `window.__institutionalReadinessHealth().verdict` ∈
      `PILOT_READY | PROGRAM_READY | INSTITUTIONAL_READY | NOT_READY`;
      verdict cannot be INSTITUTIONAL_READY if persistence/audit/isolation
      are not ready.

## F. OODA + Artifacts

- [ ] `window.__v7OODAHealth()` → `nonBlocking:true`, `growerSafeOutput:true`.
- [ ] `window.__v7ArtifactHealth()` → `artifactRuntimeOnly:true`,
      `idempotencyKeysRequired:true`, `offlineSafe`, and lists the 6 events:
      PredictiveRiskCalculated, FarmAssistantRecommendationCreated,
      NGOImpactSnapshotGenerated, MarketplaceTrustCalculated,
      RemoteSensingSnapshotCreated, InstitutionalReadinessChecked.

### Pass criteria
All boxes checked AND the protected flows behave exactly as before. V7 is
additive, explainable, honest, org-scoped, and never blocks scan/upload.
