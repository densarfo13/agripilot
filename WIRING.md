# Decision-intelligence wiring guide

This file lists every one-line change you (the human) need to make in existing files to connect the decision-intelligence layer to the running app. Everything else (services, helpers, hooks, components, routes, tests) is already written and tested.

Estimated effort: ~10–15 minutes.
Reversibility: every change is isolated — revert by removing the new line.

## A. Server — mount the v2 analytics router

**File:** `server/src/app.js` (wherever `/api/v1/analytics` is mounted)

Add these imports near the other module imports:

```js
import { createV2AnalyticsRouter } from './modules/analytics/v2/routes.js';
import { inMemoryStore }           from './modules/analytics/v2/reportsService.js';
// In production, swap inMemoryStore for:
// import { createPrismaStore } from './modules/analytics/v2/prismaStore.js';
```

Then after the v1 analytics mount, add:

```js
const v2Store = inMemoryStore(); // or createPrismaStore({ prisma })
app.use('/api/v2/analytics', createV2AnalyticsRouter({
  store: v2Store,
  authMiddleware: authenticate,   // your existing auth middleware
  adminMiddleware: authorize('super_admin', 'institutional_admin'),
}));
```

If you use the Prisma-backed store, run the migration described in `server/src/modules/analytics/v2/prismaStore.js` first (two new models: `AnalyticsEventV2` and `RecommendationFeedback`).

## B. Server — feed harvest outcomes into the feedback loop

**File:** wherever `HARVEST_SUBMITTED` lands on the server (likely `server/src/modules/postHarvest/service.js` or similar).

After a harvest record is saved:

```js
import { buildRecommendationFeedbackSignal } from
  '../../services/recommendations/recommendationFeedbackService.js';

const signal = buildRecommendationFeedbackSignal({
  crop: harvest.crop,
  country: farmer.country,
  stateCode: farmer.stateCode,
  cycleId: harvest.cycleId,
  events: eventsForThisCycle, // load from your analytics store
  harvestOutcome: harvest.outcomeClass, // 'good' | 'bad' | 'mixed'
});
await v2Store.mergeFeedbackSignal(signal); // inMemoryStore + prismaStore both expose this
```

## C. Server — bias the recommendation engine

**File:** wherever your existing recommendation engine emits its score map.

```js
import { createBiasAdapter, wrapRecommendationEngine } from
  './modules/recommendations/biasAdapter.js';

const biasAdapter = createBiasAdapter({ store: v2Store });

// Option A — filter explicit score maps:
const finalScores = await biasAdapter.apply(baseScores, { country });

// Option B — wrap the whole engine:
export const recommendEngine = wrapRecommendationEngine(
  originalRecommendEngine, biasAdapter,
);
```

## D. Client — merge the confidence i18n keys

**File:** `src/i18n/translations.js` (or wherever your flat dictionary lives).

```js
import { applyConfidenceOverlay } from './confidenceTranslations.js';
applyConfidenceOverlay(translations); // mutates in place, returns same ref
```

## E. Client — add debug panel to the root layout

**File:** root app shell (e.g. `src/pages/FarmerHomePage.jsx` or whatever wraps every screen).

```jsx
import MountDebugPanel from '@/components/dev/MountDebugPanel';
// ...somewhere near the end of the root tree:
<MountDebugPanel />
```

Production builds tree-shake this unless the user sets `localStorage.farroway.debug = '1'`.

## F. Client — instrument onboarding steps

For each onboarding step component (`LocationStep`, `FarmTypeStep`, `FarmSizeStep`, `ExperienceStep`, `CropRecommendationStep`), change the export line.

Before:
```jsx
export default LocationStep;
```

After:
```jsx
import withFunnelInstrumentation from '@/components/onboarding/withFunnelInstrumentation';
import { FUNNEL_STEPS } from '@/utils/funnelEventTypes';

export default withFunnelInstrumentation(LocationStep, {
  step: FUNNEL_STEPS.LOCATION,
  hesitationThresholdMs: 45_000,
});
```

Inside each step, when the user moves forward, call the `funnelCompleted` prop that the HOC injects:

```jsx
// existing "next" handler:
function handleContinue() {
  props.funnelCompleted({
    confidence: locationConfidence,
    meta: { method: 'detect' },
  });
  props.onNext(); // your existing forward navigation
}
```

Step constants map as follows:

| Component               | Step                          |
|-------------------------|-------------------------------|
| `FirstLaunchConfirm`    | `FUNNEL_STEPS.WELCOME`        |
| `LocationStep`          | `FUNNEL_STEPS.LOCATION`       |
| `FarmTypeStep`          | `FUNNEL_STEPS.GROWING_TYPE`   |
| `ExperienceStep`        | `FUNNEL_STEPS.EXPERIENCE`     |
| `FarmSizeStep`          | `FUNNEL_STEPS.SIZE_DETAILS`   |
| `CropRecommendationStep`| `FUNNEL_STEPS.RECOMMENDATIONS`|

At the end of the final screen:
```jsx
funnelTrack(FUNNEL_EVENT_TYPES.STEP_COMPLETED, {
  meta: { step: FUNNEL_STEPS.ONBOARDING_COMPLETED },
});
```

## G. Client — replace hardcoded recommendation headers

**File:** `src/pages/CropRecommendations.jsx` (or equivalent).

Before:
```jsx
<h2>Best crops for your area</h2>
```

After:
```jsx
import RecommendationHeader from '@/components/confidence/RecommendationHeader';
import { getRecommendationConfidence } from '@/utils/getRecommendationConfidence';

const confidence = getRecommendationConfidence(/* your existing input */);
<RecommendationHeader confidence={confidence} t={t} />
```

When a user taps a crop in the shortlist:
```jsx
import { trackDecision } from '@/utils/trackDecision';
trackDecision.recommendationSelected({
  confidence,
  country, language, mode,
  meta: { crop: pickedCrop },
});
```

When they explicitly reject the shortlist and pick something else:
```jsx
trackDecision.recommendationRejected({ meta: { crop: shownCrop } });
trackDecision.cropChangedAfterRecommendation({ meta: { from: shownCrop, to: newCrop } });
```

## H. Client — instrument the Today screen

**File:** `src/pages/farmer/FarmerTodayPage.jsx`.

```jsx
import { trackDecision } from '@/utils/trackDecision';

// on mount, for the primary task:
useEffect(() => {
  if (primaryTask) {
    trackDecision.todayPrimaryTaskViewed({
      confidence: primaryTask.confidence,
      meta: { taskId: primaryTask.id, intent: primaryTask.intent },
    });
  }
}, [primaryTask?.id]);

// on complete:
trackDecision.taskCompleted({ meta: { taskId: primaryTask.id } });
// on skip:
trackDecision.taskSkipped({ meta: { taskId: primaryTask.id } });
// when the same task has been skipped twice:
trackDecision.taskRepeatSkipped({ meta: { taskId, skipCount: 2 } });
```

## I. Client — instrument harvest + post-harvest

**File:** `src/pages/farmer/PostHarvestSummaryPage.jsx`.

```jsx
trackDecision.harvestSubmitted({
  meta: { crop, cycleId, outcomeClass: 'good' | 'bad' | 'mixed' },
});

// when the user picks their next cycle:
trackDecision.postHarvestNextCycleChosen({ meta: { crop: nextCrop } });

// when they list the produce for sale:
trackDecision.listingCreatedFromHarvest({ meta: { listingId } });
```

## J. Client — instrument marketplace

**Seller side** (`src/pages/farmer/CreateListingPage.jsx`, `MyListingsPage.jsx`):

```jsx
import { trackDecision } from '@/utils/trackDecision';
import ListingFreshnessBadge from '@/components/confidence/ListingFreshnessBadge';

// inside a listing card:
<ListingFreshnessBadge listing={listing} t={t} />
```

**Buyer side** (`src/pages/buyer/*.jsx`):

```jsx
// when the buyer opens a listing:
trackDecision.listingViewed({ meta: { listingId } });

// when they click Interested:
trackDecision.buyerInterestSubmitted({ meta: { listingId, quantity } });

// seller accepts / declines an interest:
trackDecision.interestAccepted({ meta: { interestId } });
trackDecision.interestDeclined({ meta: { interestId, reason } });
```

## K. Client — location confirmation

**File:** `src/components/onboarding/LocationStep.jsx` or `FirstLaunchConfirm.jsx`.

```jsx
import { trackDecision } from '@/utils/trackDecision';
import LocationConfidenceHint from '@/components/confidence/LocationConfidenceHint';
import { getLocationConfidence } from '@/utils/getLocationConfidence';

const confidence = getLocationConfidence({
  source: detectResult ? 'detect' : 'manual',
  confirmed: isConfirmed,
  accuracyM: detectResult?.accuracy,
  countryCode: country,
  stateCode,
  supportTier, // from countrySupport
});

<LocationConfidenceHint confidence={confidence} t={t} />

// on "Yes, that's my field":
trackDecision.locationConfirmedYes({ confidence });

// on manual entry:
trackDecision.locationConfirmedManual({ confidence, meta: { country, stateCode } });

// on retry:
trackDecision.locationRetryClicked({});

// if they abandon detection without continuing:
trackDecision.locationDetectionAbandoned({});
```

## L. Server — verify the end-to-end path

After the mount in step A, this smoke check should pass:

```bash
# Get a token however your auth flow works, then:
curl -X POST http://localhost:3001/api/v2/analytics/events \
  -H 'Content-Type: application/json' \
  -b 'Auth-Cookie...' \
  -d '{"events":[
    {"type":"funnel_step_viewed","timestamp":'$(date +%s%3N)',"mode":"farm","meta":{"step":"welcome"}}
  ]}'
# → { "accepted": 1, "rejected": [], "persisted": true }

curl http://localhost:3001/api/v2/analytics/reports/onboarding
# → JSON report with funnel[], insights[]
```

## What each wiring step buys you

| Step | Unlocks |
|------|---------|
| A    | Any client call to `/api/v2/analytics/events` works end-to-end |
| B    | Every harvest becomes a feedback signal that moves the bias score |
| C    | Recommendations ranked by real outcomes, per country |
| D    | Confidence-aware copy renders in all 9 languages |
| E    | Real-time visibility of journey + drop-off inference in dev |
| F    | Onboarding funnel reconstruction + hesitation detection |
| G    | Tier-appropriate headlines on the recommendation screen |
| H    | Today-screen decision signals |
| I    | Recommendation feedback loop feedstock |
| J    | Marketplace lifecycle + listing-freshness trust signals |
| K    | Location trust-break detection |
| L    | Dashboards are live |

## What's fully wired already (no action needed)

- All confidence scoring helpers (location, listing, recommendation, task)
- Offline buffering + reconnect flush (installed automatically by `useAnalytics`)
- Client/server event-type alignment test
- 139 passing tests across 10 test files

## Prisma schema additions (if using the prismaStore)

```prisma
model AnalyticsEventV2 {
  id          String   @id @default(cuid())
  userId      String?  @db.VarChar(64)
  type        String   @db.VarChar(80)
  timestamp   BigInt
  sessionId   String?  @db.VarChar(64)
  mode        String?  @db.VarChar(16)
  language    String?  @db.VarChar(8)
  country     String?  @db.VarChar(8)
  stateCode   String?  @db.VarChar(16)
  confidence  Json?
  meta        Json?
  clientKey   String?  @db.VarChar(128)
  createdAt   DateTime @default(now())

  @@index([userId, timestamp])
  @@index([type, timestamp])
  @@unique([userId, clientKey])
}

model RecommendationFeedback {
  id           String   @id @default(cuid())
  countryCrop  String   @unique
  score        Float
  n            Int
  reasons      Json
  updatedAt    DateTime @updatedAt
}
```
