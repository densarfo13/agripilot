# SCAN_CERTIFICATION

See SCAN_CERTIFICATION_REPORT.md for the full detail. Summary:

- **Certified deterministically:** pipeline resilience, unknown/non-plant
  rejection, weak-scan gating, confidence-degrades-with-evidence — via the REAL
  ingestion gate + classifier (no mocks).
- **PENDING (operator):** live crop-photo accuracy across the Phase-6 dataset
  (30 crops / 20 fruits / 20 vegetables / 20 flowers / 15 trees / 20 diseases /
  15 insects). Targets Plant >95% / Disease >90% / Insect >90% are verified by
  `npm run scan:acceptance` against production — never fabricated here.
- Sentinel Hub: NOT_INTEGRATED. Mushroom never claims edible.
