# Full decision-intelligence wiring guide

This is the consolidated guide covering all three intelligence layers:

1. **Analytics ingest + signal extraction**
2. **Product intelligence reports**
3. **Decision engine + arbitration + actionability**

Every step below is an insertion into an existing file. Nothing requires rewriting or restructuring. Estimated total effort: **30–45 minutes**.

Each step is reversible — remove the new import + call and the code goes back to exactly where it was.

---

## Contents

| Section | What it wires | Effort |
|---------|---------------|--------|
| A. Server mount points (v2 analytics + decision engine) | ~5 lines in `app.js` | 3 min |
| B. Event ingest handler | already in step A | 0 min |
| C. Onboarding funnel instrumentation | change 6 export lines | 6 min |
| D. Recommendation engine wrap (adapter) | 3 lines | 3 min |
| E. Today task pipeline wrap | 3 lines | 3 min |
| F. Listing lifecycle wrap | 3 lines | 3 min |
| G. Confidence-aware wording (3 locales × 3 places) | 3 × 2-line JSX changes | 4 min |
| H. Location trust events (Yes/Manual/Retry) | 3 one-liners in LocationStep | 3 min |
| I. Today decision events | 4 one-liners in FarmerTodayPage | 4 min |
| J. Harvest + marketplace decision events | 6 one-liners across 3 files | 5 min |
| K. i18n overlay merge | 2 lines in translations.js | 1 min |
| L. Harvest → feedback signal loop | 5 lines in post-harvest service | 4 min |
| M. Dev panels at the root | 2 lines in the root layout | 2 min |
| N. Prisma schema migrations | 3 new models | 5 min |
| O. Smoke test the whole chain | curl commands | 3 min |

---

## A. Server mount points

**File:** `server/src/app.js` (or wherever you `app.use(...)` the existing routers).

Add imports near the other module imports:

```js
import { createV2AnalyticsRouter } from './modules/analytics/v2/routes.js';
import { inMemoryStore as v2InMemoryStore } from './modules/analytics/v2/reportsService.js';
// Production: swap for `createPrismaStore({ prisma })` after the migrations in §N.

import { createDecisionEngineRouter } from './modules/decision/engine/routes.js';
import { createInMemoryReasonStore } from './modules/decision/reasonHistoryStore.js';
// Production: swap for `createPrismaReasonStore({ prisma })`.
```

Then near the existing `app.use(...)` calls:

```js
const v2Store     = v2InMemoryStore();       // or createPrismaStore({ prisma })
const reasonStore = createInMemoryReasonStore(); // or createPrismaReasonStore({ prisma })

app.use('/api/v2/analytics', createV2AnalyticsRouter({
  store: v2Store,
  authMiddleware:  authenticate,
  adminMiddleware: authorize('super_admin', 'institutional_admin'),
}));

app.use('/api/v2/decision', createDecisionEngineRouter({
  reasonStore,
  loadUserEvents: async (userId) => {
    // Adapt to your analytics-event table. Simplest version:
    const users = await v2Store.loadUsers();
    const me = users.find((u) => u.userId === userId);
    return me?.events || [];
  },
  authMiddleware:  authenticate,
  adminMiddleware: authorize('super_admin', 'institutional_admin'),
}));
```

That's it for the server. Every other backend step below is optional instrumentation that makes the reports more useful.

## B. Event ingest

Handled automatically by the v2 router. The client (via `useAnalytics` or `trackDecision`) posts to `/api/v2/analytics/events`; the router validates and persists through `v2Store.persistFn`.

## C. Onboarding funnel instrumentation

Wrap each onboarding step's default export with the funnel HOC. Six one-line changes:

```jsx
// src/components/onboarding/LocationStep.jsx (and siblings)
import withFunnelInstrumentation from '@/components/onboarding/withFunnelInstrumentation';
import { FUNNEL_STEPS } from '@/utils/funnelEventTypes';

export default withFunnelInstrumentation(LocationStep, {
  step: FUNNEL_STEPS.LOCATION,
  hesitationThresholdMs: 45_000,
});
```

Step-to-component mapping:

| File | `step` value |
|------|--------------|
| `FirstLaunchConfirm.jsx`     | `FUNNEL_STEPS.WELCOME` |
| `LocationStep.jsx`           | `FUNNEL_STEPS.LOCATION` |
| `FarmTypeStep.jsx`           | `FUNNEL_STEPS.GROWING_TYPE` |
| `ExperienceStep.jsx`         | `FUNNEL_STEPS.EXPERIENCE` |
| `FarmSizeStep.jsx`           | `FUNNEL_STEPS.SIZE_DETAILS` |
| `CropRecommendationStep.jsx` | `FUNNEL_STEPS.RECOMMENDATIONS` |

Inside each step, when the user commits and moves forward, call the injected prop:

```jsx
function onContinue() {
  props.funnelCompleted({
    confidence: locationConfidence,
    meta: { method: 'detect' }, // or 'manual'
  });
  props.onNext();
}
```

## D. Recommendation engine wrap

**File:** wherever your existing recommendation function produces crop scores.

```js
import { createRecommendationAdapter } from '../modules/decision/engineAdapters.js';

const recommend = createRecommendationAdapter({
  guardrails:   (ctx) => agronomicExclusionsFor(ctx.country, ctx.climate),
  commodities:  () => ['maize', 'rice', 'soy', 'wheat'],
  supportTier:  (ctx) => countrySupport(ctx.country).tier, // 'full'|'partial'|'limited'
  confidence:   (ctx) => ctx.recommendationConfidence || { level: 'medium', score: 55 },
});

// Wherever you currently call the base engine:
const result = await recommend(ctx, originalScorerFn);
// result.value   — final { crop: score } after guardrails + mode + base + optimization + locks
// result.wordingKeys.header    — 'recommendations.header.<tier>'
// result.wordingKeys.subheader — 'recommendations.sub.<tier>'
// result.locks   — what got excluded and why
// result.trace   — per-stage execution log for debugging
```

Return `result.value` where you used to return the raw scores; pass `result.wordingKeys` and `result.confidence` to the UI.

## E. Today task pipeline wrap

**File:** `src/pages/farmer/FarmerTodayPage.jsx` (or whoever produces the primary task).

```js
import { createTaskAdapter } from '@/modules/decision/engineAdapters'; // via a thin client import path — see §E1 below

const selectPrimaryTask = createTaskAdapter({
  guardrails: (ctx) => guardrailsForStage(ctx.cropStage, ctx.weatherNow),
  confidence: (ctx) => ctx.taskConfidence,
});

const { value: orderedTasks, wordingKeys, confidence } =
  await selectPrimaryTask(ctx, candidateTasks);
const primary = orderedTasks[0];
// Render primary with t(wordingKeys.title) / t(wordingKeys.detail) fallbacks.
```

### E1. Client-side adapter shim

If you'd rather run adapter logic client-side (to avoid a network round-trip for every Today render), create a thin shim that imports the pipeline directly. If you prefer server-side, call `/api/v2/decision/pipeline/recommend` or add a similar `/pipeline/task` route.

## F. Listing lifecycle wrap

**File:** marketplace listing service / component.

```js
import { createListingAdapter } from '@/modules/decision/engineAdapters';
import { getListingConfidence }  from '@/utils/getListingConfidence';

const resolveListing = createListingAdapter({
  confidence: ({ listing }) => getListingConfidence(listing),
});

const { value: listingState, wordingKeys, locks } = resolveListing({}, listing);
// Use listingState.state for the canonical lifecycle state — expired can't be overridden.
// Use wordingKeys.freshness to render the freshness badge.
```

## G. Confidence-aware wording

Three places to swap hardcoded strings for tier-aware components.

### G1. Recommendation screen

```jsx
// Before:
<h2>Best crops for your area</h2>

// After:
import RecommendationHeader from '@/components/confidence/RecommendationHeader';
<RecommendationHeader confidence={recommendationConfidence} t={t} />
```

### G2. Location step

```jsx
import LocationConfidenceHint from '@/components/confidence/LocationConfidenceHint';
<LocationConfidenceHint confidence={locationConfidence} t={t} />
```

### G3. Listing card

```jsx
import ListingFreshnessBadge from '@/components/confidence/ListingFreshnessBadge';
<ListingFreshnessBadge listing={listing} t={t} />
```

## H. Location trust events

**File:** `src/components/onboarding/LocationStep.jsx` (or `FirstLaunchConfirm.jsx`).

```js
import { trackDecision } from '@/utils/trackDecision';

// User tapped "Yes, that's my field":
trackDecision.locationConfirmedYes({ confidence: locationConfidence });

// User fell back to manual:
trackDecision.locationConfirmedManual({
  confidence: locationConfidence,
  meta: { country, stateCode },
});

// User tapped "Retry detection":
trackDecision.locationRetryClicked({});

// User abandoned detection flow entirely:
trackDecision.locationDetectionAbandoned({});
```

These feed both the analytics layer AND the decision engine's `detect_overridden_by_manual` trust-break pattern.

## I. Today decision events

**File:** `src/pages/farmer/FarmerTodayPage.jsx`.

```js
import { trackDecision } from '@/utils/trackDecision';

// When the primary task is rendered:
useEffect(() => {
  if (primaryTask) {
    trackDecision.todayPrimaryTaskViewed({
      confidence: primaryTask.confidence,
      meta: { taskId: primaryTask.id, intent: primaryTask.intent },
    });
  }
}, [primaryTask?.id]);

// On complete:  trackDecision.taskCompleted({ meta: { taskId } });
// On skip:      trackDecision.taskSkipped ({ meta: { taskId } });
// On 2nd skip:  trackDecision.taskRepeatSkipped({ meta: { taskId, skipCount: 2 } });
```

## J. Harvest + marketplace decision events

**Post-harvest screen:**

```js
trackDecision.harvestSubmitted({
  meta: { crop, cycleId, outcomeClass: 'good' /* | 'bad' | 'mixed' */ },
});
trackDecision.postHarvestNextCycleChosen({ meta: { crop: nextCrop } });
trackDecision.listingCreatedFromHarvest({ meta: { listingId } });
```

**Listing + buyer pages:**

```js
trackDecision.listingViewed({ meta: { listingId } });
trackDecision.buyerInterestSubmitted({ meta: { listingId } });
trackDecision.interestAccepted({ meta: { interestId } });
trackDecision.interestDeclined({ meta: { interestId, reason } });
```

## K. i18n overlay

**File:** `src/i18n/translations.js` (wherever your flat dictionary is built).

```js
import { applyConfidenceOverlay } from './confidenceTranslations.js';
applyConfidenceOverlay(translations);  // mutates in place, returns same ref
```

That's the whole step — 12 keys × 9 locales merge in.

## L. Harvest → feedback signal loop

**File:** whichever backend handler persists `HARVEST_SUBMITTED` (e.g. `server/src/modules/postHarvest/service.js`).

```js
import { buildRecommendationFeedbackSignal } from
  '../../services/recommendations/recommendationFeedbackService.js';

// After the harvest row is saved:
const signal = buildRecommendationFeedbackSignal({
  crop:     harvest.crop,
  country:  farmer.country,
  stateCode: farmer.stateCode,
  cycleId:  harvest.cycleId,
  events:   await loadEventsForCycle(harvest.cycleId),
  harvestOutcome: harvest.outcomeClass,
});
await v2Store.mergeFeedbackSignal(signal);

// Also persist a decision-layer reason snapshot:
await reasonStore.append({
  contextKey: `${farmer.country}:${harvest.crop}`.toLowerCase(),
  reason:     `harvest_${harvest.outcomeClass}`,
  signalType: 'harvest_outcome',
  direction:  harvest.outcomeClass, // 'good' | 'bad' | 'mixed'
  weight:     signal.weight,
  confidence: 0.9,
  timestamp:  Date.now(),
});
```

That single hook gives you two things:
- the recommendation bias score for future runs
- an explainable reason trail on the decision engine's dashboard

## M. Dev panels at the root

**File:** root app shell (e.g. `src/pages/FarmerHomePage.jsx`).

```jsx
import MountDebugPanel           from '@/components/dev/MountDebugPanel';
import MountDecisionDebugPanel   from '@/components/dev/MountDecisionDebugPanel';

// Near the end of the tree:
<>
  <MountDebugPanel />
  <MountDecisionDebugPanel intervalMs={15_000} />
</>
```

Both are hidden in production unless the user sets `localStorage.farroway.debug = '1'`.

## N. Prisma schema migrations

Add these three models to your `schema.prisma` and run `npx prisma migrate dev`.

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

model ReasonSnapshot {
  id          String   @id @default(cuid())
  contextKey  String?  @db.VarChar(128)
  reason      String   @db.VarChar(128)
  signalType  String   @db.VarChar(80)
  direction   String   @db.VarChar(12)
  weight      Float
  confidence  Float?
  timestamp   BigInt
  createdAt   DateTime @default(now())

  @@index([contextKey, timestamp])
  @@index([signalType, timestamp])
}
```

After migration, swap the in-memory stores in §A for:

```js
import { createPrismaStore }       from './modules/analytics/v2/prismaStore.js';
import { createPrismaReasonStore } from './modules/decision/reasonHistoryStore.js';

const v2Store     = createPrismaStore({ prisma });
const reasonStore = createPrismaReasonStore({ prisma });
```

## O. Smoke-test the whole chain

Once the server restarts with the new mounts, these three calls should all succeed:

```bash
# Ingest
curl -X POST http://localhost:3001/api/v2/analytics/events \
  -H 'Content-Type: application/json' -b 'your-auth-cookie' \
  -d '{"events":[{"type":"funnel_step_viewed","timestamp":'$(date +%s%3N)',"mode":"farm","meta":{"step":"welcome"}}]}'

# Decision snapshot
curl -X POST http://localhost:3001/api/v2/decision/snapshot \
  -H 'Content-Type: application/json' -b 'your-auth-cookie' \
  -d '{"events":[]}'

# Product intelligence report
curl http://localhost:3001/api/v2/analytics/reports/product-intelligence -b 'your-auth-cookie'
```

Expected responses: `{ accepted: 1, rejected: [], persisted: true }`, the snapshot JSON, and the full PI report. If any of these fail with `cannot POST` or `cannot GET`, the mount in §A didn't take.

---

## What each step unlocks

| Step | Unlocks |
|------|---------|
| A | All three layers addressable via HTTP |
| B-C | Funnel reconstruction + hesitation detection visible in dashboards |
| D | Recommendations obey guardrails, commodity bans, support-tier caps |
| E | Today tasks obey guardrails + mode + tier-appropriate wording |
| F | Listings can't be un-expired by downstream code |
| G | Tier-appropriate copy renders in-product |
| H-J | Decision-quality events populate the arbitration layer with real data |
| K | 12 new keys × 9 locales render |
| L | Every harvest updates the per-country bias history AND the reason trail |
| M | Dev panels show journey health + decision engine state in real time |
| N | All of the above persists across restarts |

## What's still optional after this

- **Per-user reason-history pruning.** The Prisma store has no TTL cron — add one if your table grows too fast (`DELETE WHERE timestamp < now - 180d`).
- **Dedicated admin dashboard page** that renders `buildFullProductReport` JSON as visualizations. The data is already there via the reports endpoints.
- **Client-side response application.** Today/recommendation screens can either poll `/api/v2/decision/snapshot` and apply `responses.*` or call the decision engine synchronously per-render. Polling is cheaper at scale; per-render is snappier.
- **Automated signal quality audits.** Write a nightly cron that runs `buildSignalConfidenceSummary` across the whole population and alerts if a signal type collapses to near-zero reliability — it probably means the event naming drifted.

---

## Total inventory

After wiring, you have:

- **3 intelligence layers** (analytics, product-intelligence, decision-engine) with **39 new files** under `src/` and `server/src/`
- **16 test files, 246 tests** — all rule-based, bounded, explainable
- **3 new Prisma models** for persistence
- **2 new Express routers** at `/api/v2/analytics` and `/api/v2/decision`
- **7 new client hooks + components** for confidence-aware UI and dev panels
- **Zero ML** — every score has a traceable explanation
