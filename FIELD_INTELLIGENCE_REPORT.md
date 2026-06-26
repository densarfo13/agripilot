# FIELD_INTELLIGENCE_REPORT — v11

`estimateFieldIntelligence()` produces field estimates after an object is
identified, split HONESTLY into what code can estimate and what it cannot.

## Calendar-based — real estimates (from planting date + crop calendar)
| Field | Source | Without planting date |
|---|---|---|
| Plant age | days since planting (computeLifecycleSnapshot) | unknown (asks for date) |
| Maturity date | crop calendar harvest window | unknown |
| Harvest window | crop calendar (or typical duration) | typical duration or unknown |
| Growth velocity | % through the crop cycle | unknown |

Each carries value + status + confidence + reason. No planting date → honest
`unknown` ("Add your planting date") — never inferred.

## CV-dependent — honest `unavailable` (NEVER fabricated)
Fruit count · flower count · canopy coverage · plant density · row spacing ·
estimated yield · estimated biomass · field coverage.

Counting from a single photo needs a vision model we don't run. So these return
**value: null, status: unavailable, confidence: 0** with an honest next step
("sample a row by hand"). The gate fails the build if any of them is given a
number. **Unknown is always acceptable; a fabricated count is not.**

`__fieldIntelligenceHealth()` attests `cvNeverFabricated: true`.

## Location awareness + intelligence
The engine accepts crop / planting date / climate / setting; location, season,
weather, and soil context come from the existing pipeline (useLiveWeather,
cropSeasonality, SoilGrids) and the Decision Engine — composed, not duplicated.
