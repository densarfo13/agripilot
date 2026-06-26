# FARM_MEMORY_REPORT — v11

Every successful scan already updates the durable farm memory (no new store —
composed): Farm timeline, growth timeline, disease timeline, harvest timeline,
yield timeline (honest-null until harvests are logged), and recommendation
history — via FarmBrainState + FarmTimeline + the decision-feedback loop.

v11 adds the field-intelligence estimates to what a scan can surface (plant age,
maturity, harvest window) so the timelines gain calendar context. CV-dependent
fields stay out of memory as honest `unavailable` — memory never stores a
fabricated count or yield.

Persistence is the existing Postgres-backed FARM_PERSISTENCE layer (localStorage
is cache only). Outcomes feed FarmBrain's evidence base; learning stays off until
≥50 confirmed samples (no fake learning).
