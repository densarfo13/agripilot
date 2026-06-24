# SCAN_UNCLEAR_AUDIT.md

**Sprint #219 — "Scan unclear despite a clear photo" — full pipeline audit.**
Date: 2026-06-23. Allowed under Pilot Mode (bug + scan-trust; serves First Scan %).

## TL;DR — it is almost certainly a PROVIDER/CONFIG issue, not a code bug

The pipeline is **field-clean end to end** — `plantName` and
`topCandidates` are never renamed or confidence-blanked between the
server and the UI. "Scan unclear" is the HONEST fallback the UI shows
when `topCandidates` is empty AND there is no plant name. The only way a
**clear** photo reaches that state is if the **classifier returned no
identification** — and the dominant real-world cause is the provider
being **unconfigured (`PLANT_ID_API_KEY` unset on Railway) or erroring**,
not the photo.

The new `window.__scanDebug()` trace + the `failureReason` field confirm
which it is on the next scan.

## The 7 questions

**1. Exact code path to "Scan unclear":**
UI renderers fall back to it when `topCandidates.length === 0` and no name —
[`ScanCommandCard.jsx:73`](src/components/scan/ScanCommandCard.jsx:73) and
[`ScanDecisionComposer.ts:100`](src/runtime/scanMythos/ScanDecisionComposer.ts:100).
`topCandidates` empties at the SERVER:
[`scanConsensusEngine.js:230-244`](server/src/ml/scanConsensusEngine.js:230) returns
`candidates: []` when **both Plant.id and PlantNet return no parsed
identification**; the envelope preserves it
([`scanRecoveryEnvelope.js:309`](server/src/ml/scanRecoveryEnvelope.js:309)).

**2. Provider response:** plant.id parses `classification.suggestions`
([`plantIdProvider.js:147`](server/src/ml/providers/plantIdProvider.js:147)).
If the request fails (no API key → 401, timeout, or zero suggestions),
`pidParsed` is null; with PlantNet also unavailable, consensus has no
candidates. **Field names are correct** — the client passes them through
verbatim ([`scanApiService.js`](src/services/scanApiService.js) returns
JSON as-is; [`scanDetectionEngine.js:322`](src/core/scanDetectionEngine.js:322)
spreads `...apiResult`).

**3. Confidence score:** when consensus fails, `confidencePct: 0` /
`confidence: 'low'`. There is **no confidence-gate that blanks a name** —
a moderate-confidence clear photo keeps its name. So 0% here means "no
provider result", not "low-quality photo".

**4. Trust-gate decision:** with empty candidates + unknown plant, the
#214 trust gate correctly returns `allowPlantCreation:false`,
`allowTaskCreation:false`, `gateStatus:'review'` (photo exists). This is
CORRECT — it's protecting against a non-result.

**5. Why candidates were discarded:** they were **never produced**. No
client-side discard exists; the empty array originates at the server
consensus when both providers return nothing.

**6. Why the review queue wasn't triggered:** it IS the correct path —
`gateStatus:'review'` routes a photographed-but-unidentified scan to the
review queue (#214). If it didn't visibly trigger, the scan likely
rendered before #214 shipped, or the UI showed the coach card instead
(also correct). `__scanDebug().trustGate` shows the live decision.

**7. Why Create Task was still shown:** under the current code it is NOT —
Create Task requires `_trust.allowTaskCreation`
([IntelligentScanResult](src/components/scan/IntelligentScanResult.jsx)),
which is false for an unknown plant. If the screenshot predates #214,
the gate wasn't there yet. `check:scan-unclear-safety` now FAILS the
build if Create Task can render for an unknown plant.

## window.__scanDebug()

```
{ photoQuality, providerResponse:{ plantName, candidateCount,
  confidencePct, objectType, classifierAvailable, serverReason },
  candidates, confidence, trustGate, uiDecision:{ plantShown,
  createTaskVisible, coachCardShown }, failureReason }
```
`failureReason` values: `provider_unconfigured_or_unavailable` ·
`provider_error:<msg>` · `both_providers_returned_no_identification` ·
`no_candidates_from_providers` · `null` (scan was fine).

## Build gates added (`check:scan-unclear-safety`)
- FAIL if Create Task can render while plant is unknown.
- FAIL if a scan-unclear/blocked result renders without a failure
  explanation (the coach card).
- FAIL if `__scanDebug` is missing the 7 fields or not wired.

## Recommended NEXT action (operational, not code)
**Verify `PLANT_ID_API_KEY` is set on Railway prod.** Then run one scan
and read `window.__scanDebug().providerResponse.classifierAvailable` +
`.failureReason`. If `classifierAvailable:false` → set the key; that
single env var is the most likely fix for "every clear photo reads
unclear", and it directly unblocks First Scan %.
