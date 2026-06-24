# MYTHOS_DECISION_TRACE_REPORT.md

**Sprint #216 §3 — already shipped (#209).** Date: 2026-06-19.

The spec's `MythosDecisionEngine` (Recommendation / Confidence / Reason
/ Evidence) is the shipping `DecisionTraceEngine` (#209):

```
buildDecisionTrace(...) → {
  recommendation,
  confidence,            // ECHOED, never recomputed
  evidence[],            // weather / prior-scan / farm context
  risks[],
  contributors[{sign,label}],   // "+ Onion selected", "+ Bulb Formation stage"
  hasReason              // guarantees no recommendation without a reason
}
```

Sprint #216 adds the numeric **RecommendationTrustScore** (§8) as the
"Confidence: 92%" companion — composed from real contributors only,
satellite excluded. Together they give the spec's example shape
(recommendation + confidence + the "Because:" list) without rebuilding
the trace engine.

Gate: `check:farm-brain` (decision trace) + `check:farm-os` (trust score).
