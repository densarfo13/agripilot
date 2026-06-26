# FIELD_INTELLIGENCE — v12

The field-intelligence section reports 10 spatial metrics: plant population,
spacing, row alignment, missing plants, poor germination, lodging, canopy coverage,
weed pressure, growth uniformity, ripeness %.

**Every one is CV-dependent and therefore `unavailable` (value null, confidence 0)**
with a real next step ("sample a row by hand"). Counting plants or measuring canopy
from a photo requires a vision model the platform does not run — so v12 returns an
honest gap, not a fabricated count.

The calendar-based estimates that CAN be made honestly (plant age, maturity,
harvest window, growth velocity) come from the v11 field engine and the crop
calendar, and appear under `yield.harvestWindow` / identity growth context when a
planting date is present.

This is the line the whole sprint holds: **the spatial field metrics become real
the day a CV model lands — until then they stay `unavailable`, never invented.**
