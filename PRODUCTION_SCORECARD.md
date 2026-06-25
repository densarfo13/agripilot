# PRODUCTION_SCORECARD — v10

| Capability | Status |
|---|---|
| Object classification (17 classes) | ✅ shipped (8 new this sprint) |
| Every-scan intelligence fields | ✅ shipped |
| FarmBrain timeline/recommendation updates | ✅ shipped |
| Multi-image / progression | ✅ shipped (composer) |
| Risk engine | ✅ shipped |
| Confidence + evidence + trust | ✅ shipped |
| Quality control (reject bad photos) | ✅ shipped |
| Auto-improvement (outcome → thresholds) | ◑ feedback stored; learning ≥50 samples |
| Admin dashboard (health/accuracy/latency/queue) | ✅ endpoints; diagnostics |
| Scan API surface (6 endpoints) | ✅ complete |
| Ripeness / grade / storage (CV) | ◑ honest advisor (no fabricated score) |
| Field intelligence (counts/canopy) | ◷ needs CV model |
| <3s / >99% / 99.9% crash-free | ◷ measured live (reliability scorecard); PENDING field |
| 20,000-image dataset benchmark | ◷ PENDING population |

**Verdict: extended + gated.** The platform classifies any of the listed objects
and returns an honest, evidence-based recommendation; CV-dependent measures and
the field dataset are honestly PENDING, never fabricated.
