# Farroway V8 — Acceptance Test

Operator checklist for the post-V7 platform layer. Every check is
**read-only**. Nothing writes data, fakes yield/satellite data, exposes
private farmer data to buyers, or blocks the core flow.

> All V8 intelligence is **decision support, not a guarantee.**

---

## A. Build
```
npm run build:safe
npm run build
```
- [ ] `build:safe` passes, including the 7 V8 gates:
      `check:v8-no-fake-regional-intelligence`, `check:v8-farm-twin-real-data`,
      `check:v8-voice-honesty`, `check:v8-ngo-tenant-isolation`,
      `check:v8-buyer-privacy`, `check:v8-remote-sensing-claims`,
      `check:v8-ooda-artifacts`.
- [ ] `npm run build` (vite) compiles clean.

## B. Command center
1. [ ] Open `/internal/v8` as admin → renders; non-admin denied.
2. [ ] No fake metrics — panels show real probe output or "Not enough data yet."

## C. Protected flows (no regression)
3. [ ] Open Scan → scan/upload still works; camera opens.
4. [ ] Open Home → login/home routing still works.
5. [ ] Language still persists across reload.
6. [ ] Tasks, Activity, Offline, Invites, NGO/Buyer foundations unchanged.

## D. Honest health
5. [ ] `window.__v8Health()` returns `{ regionalReady, farmTwinReady,
       voiceReady, ngoEnterpriseReady, supplyChainReady, remoteSensingReady,
       institutionalDataReady, oodaReady, artifactsReady, verdict, blockers,
       warnings }` with honest warnings if data is insufficient
       (verdict NEEDS_DATA when wired but thin).

## E. Module privacy / honesty
6. [ ] Buyer/supply listing: `window.__supplyChainHealth()` exposes no private
       farmer demographics or scan detail; no price; no fake demand.
7. [ ] NGO dashboard: `window.__ngoEnterpriseHealth()` is `organizationScoped:
       true`, `crossTenantLeakage:false`, no PII; donor report not "ready"
       without real data.
8. [ ] Regional: `window.__regionalIntelligenceHealth()` shows
       "Not enough regional data yet" below `MIN_REGIONAL_DATA_POINTS`; no fake
       outbreak.
9. [ ] Voice: `window.__voiceAssistantHealth().nativeVoiceConfigured` reflects
       the real speech engine; fallback disclosed; never a fake native voice.
10. [ ] Remote sensing: `window.__remoteSensingReadinessHealth()
        .activeRemotePrediction === false`; no NDVI/soil number without a real
        provider. Not a pilot blocker.

### Pass criteria
All boxes checked AND the protected flows behave exactly as before. V8 is
additive, explainable, honest, org-scoped, and never blocks scan/upload/login.
