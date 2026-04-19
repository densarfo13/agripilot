# U.S. Crop Recommendation Engine

State-aware, farm-type-aware crop recommendations for all 50 U.S. states + D.C.

## Modules

| File | Purpose |
| --- | --- |
| `usStates.js` | All 50 states + D.C. with display region + internal climate subregion + frost/rain/heat bands. Resolver helpers. |
| `cropProfiles.js` | Static per-crop attributes (difficulty, waterNeed, frost/heat sensitivity, container friendliness, growth weeks). |
| `cropRules.js` | Per `(farmType × climateSubregion × crop)` rules with base suitability, planting windows, market strength, beginner-friendly flag. |
| `scoringEngine.js` | Pure functions that score a single crop and bucket results. |
| `recommend.js` | Top-level `recommendCropsForUSFarm(ctx)` entry point. |

## Wire-up

Route is mounted at `/api/v2/recommend/us` in `server/src/app.js`.

Endpoints:
- `GET  /api/v2/recommend/us/states`   — states grouped by display region
- `GET  /api/v2/recommend/us/location` — location profile for a state
- `POST /api/v2/recommend/us`          — bucketed recommendations

Tests:
- `server/src/__tests__/usRecommendations.test.js` (Vitest; runs with `npm test`)

## Request / response shape

```json
POST /api/v2/recommend/us
{
  "country": "USA",
  "state": "Texas",
  "farmType": "backyard",
  "growingStyle": "container",
  "purpose": "home_food",
  "beginnerLevel": "beginner",
  "currentMonth": 4
}
```

```json
{
  "ok": true,
  "location": {
    "country": "USA",
    "state": "Texas",
    "stateCode": "TX",
    "displayRegion": "Southwest",
    "climateSubregion": "SOUTH_CENTRAL_MIXED"
  },
  "farmType": "backyard",
  "bestMatch": [
    {
      "name": "Pepper",
      "score": 92,
      "difficulty": "easy",
      "waterNeed": "medium",
      "growthWeeksMin": 10,
      "growthWeeksMax": 14,
      "reasons": ["Known to grow well in Southwest", "Right time to plant this crop", "Great in containers"],
      "riskNotes": [],
      "marketStrength": "medium",
      "plantingWindow": { "startMonth": 3, "endMonth": 5, "active": true },
      "harvestWindow": { "startMonth": 6, "endMonth": 8 },
      "tags": ["beginner_friendly", "container_friendly", "heat_tolerant"]
    }
  ],
  "alsoConsider": [...],
  "notRecommendedNow": [...]
}
```

## Prisma changes

`FarmProfile` gained 5 optional columns (all nullable; legacy rows unaffected):

```prisma
stateCode      String?  @map("state_code")
farmType       String?  @map("farm_type")
beginnerLevel  String?  @map("beginner_level")
growingStyle   String?  @map("growing_style")
farmPurpose    String?  @map("farm_purpose")
```

Apply with:
```bash
cd server
npx prisma db push          # dev / same-shape migration
# or
npx prisma migrate dev --name add-us-farm-fields
```

No new tables — rule data lives in-code (JS modules), which keeps the
scoring engine testable without a DB round-trip. If persistence
becomes necessary later, each JS table in `cropRules.js` / `usStates.js`
/ `cropProfiles.js` mirrors a future Prisma model 1:1.

## Scoring model (brief)

Starting from the per-rule `suitabilityBaseScore` (which already bakes
in climate subregion × farm type × crop), the engine adds or subtracts
in the range ±25 based on:

- **Season / planting window** (±12): in-window bonus, out-of-window penalty
- **Frost sensitivity vs state frost risk** (-8)
- **Heat tolerance vs state heat band** (±10)
- **Growing style × container/raised-bed/in-ground fit** (±10) — backyard only
- **Beginner level × crop difficulty** (±10)
- **Purpose** (home_food / sell_locally / learning) (±6) — backyard only
- **Market strength** (-4..+8) — commercial / small_farm only
- **Water need vs rainfall band** (-8) — penalizes thirsty crops in dry zones

Final score is clamped 0..100. Buckets: `bestMatch` (≥75), `alsoConsider`
(55–74), `notRecommendedNow` (<55 or out-of-window).

## Frontend integration

- `src/hooks/useUSRecommendations.js` — React hook that calls the POST endpoint
- `src/components/onboarding/USStateSelector.jsx` — dropdown grouped by display region, with a static fallback so onboarding works offline

Example:

```jsx
import USStateSelector from './components/onboarding/USStateSelector.jsx';
import { useUSRecommendations } from './hooks/useUSRecommendations.js';

function CropFit() {
  const [state, setState] = useState('');
  const [farmType, setFarmType] = useState('backyard');
  const [growingStyle, setGrowingStyle] = useState('container');
  const { loading, error, data } = useUSRecommendations({
    state, farmType, growingStyle, enabled: !!state,
  });
  return (
    <>
      <USStateSelector value={state} onChange={setState} />
      {data && <h2>Best crops for {data.location.state}, USA</h2>}
      {data?.bestMatch.map((c) => <CropCard key={c.name} crop={c} />)}
    </>
  );
}
```
