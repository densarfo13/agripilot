# FARMBRAIN_CERTIFICATION

FarmBrain is certified deterministically (real ingestion gate + classifier + decision engine, in CI):

- **Never fabricates** — disease/treatment/yield/market/funding are honest-null
  when there's no evidence; weak/unknown/failed inputs are HELD for review.
- **Recommendation quality** — every recommendation carries action + reason +
  urgency + time + expected benefit + confidence; generic/duplicate/unsupported
  are rejected (dedupe key + evidence requirement).
- **Confidence degrades with evidence** — fewer/weaker signals → lower confidence,
  never a blocked screen.
- **Single source of truth** — FarmBrainState; every event updates it, screens read it.
- **Outcome loop** — feedback stored (Better/No Change/Worse/Skipped); learning
  stays OFF until ≥50 samples (no faked learning).

Verdict: **CERTIFIED** for pilot. Advanced predictions remain gated behind real
evidence (no placeholder intelligence).
