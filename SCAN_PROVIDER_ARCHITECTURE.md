# Scan Provider Architecture

## Real providers (server-side, keys are secrets, never in the browser)
`server/src/ml/providers/`: **plant.id** (identification + health), **crop.health**, **insect.id**,
**mushroom** (never claims edible), **field/soil/regional** adapters. Registry:
`providerRuntimeStatus.js` — wired-vs-keyed is **measured at Railway runtime**, never inferred.
Failures classified (auth/credits/429/timeout/5xx) → the recovery chain reacts automatically.

## Confidence fusion (exists)
`src/runtime/scan/consensus/ScanProviderConsensus.ts` — `buildScanConsensus()` merges provider
outputs into one envelope (species/common name/confidence band/health). Provider names are never
shown to the farmer (`check:farmer-facing-ai-language` + recovery-chain gate enforce this).

## Honest declines (fabrication guard)
- **Pl@ntNet / FlorID / Custom Vision**: NOT wired. No API keys or contracts exist. Building adapter
  stubs that "fail over" to providers that can't respond would be **fake resilience** — the registry
  would honestly report them unavailable anyway. Adding a real second identification provider is
  **external work** (a key + a contract); the registry + chain are ready to accept one.
- **Selection by "highest confidence/lowest latency"**: the health data exists
  (`providerReliability` p50/p95/p99 + uptime); routing on it is meaningful only with ≥2 wired
  identification providers — deferred until a second key exists.

## Failover today (real)
plant.id fails → automatic transient retry → `hybridScanEngine` secondary diagnosis → offline queue
→ needs review. That is the honest chain given one wired identification provider.
