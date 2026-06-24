# SCAN_FAILURE_ROOT_CAUSE_REPORT.md

**P0 — "Clear farmer scan produced 'Scan unclear' with Create Task visible."**
Sprint #220. Date: 2026-06-23. Allowed under Pilot Mode (bug/scan-trust).

## The screenshot evidence changed the diagnosis

The screenshot shows the **"Scan Command Center"** with **Create Task
visible** next to "Scan unclear / Needs Review". In #219 I concluded
Create Task was correctly gated — but that gating lived only in
`IntelligentScanResult.jsx`. The screenshot is a DIFFERENT surface:
**`UsefulResultCard.jsx`** (the card explicitly "shown even on a
low-confidence result") and **`ScanResultCard.jsx`** both rendered a
Create/Add Task button with **no trust gate at all**. That is the bug.

## 1. Root cause (two parts)

**A. Display (why "Scan unclear"):** the consensus engine returned
**zero candidates** — almost certainly because the classifier was
**unconfigured/unavailable** (`PLANT_ID_API_KEY` unset, or a provider
error). The pipeline is honest: no provider result → no candidates →
unidentified. (Full server trace in [SCAN_UNCLEAR_AUDIT.md](SCAN_UNCLEAR_AUDIT.md).)

**B. Task bug (the actual code defect):** `UsefulResultCard` /
`ScanResultCard` rendered the task button gated only on
`!taskAdded` / `category && TASK_SUGGESTIONS[category]` — NOT on
plant-known/confidence. For an unidentified scan `category` is
`needs_review`, which HAD a `TASK_SUGGESTIONS` entry, so the button
showed.

## 2. Exact code path
`UsefulResultCard.jsx:703-735` (task block) and
`ScanResultCard.jsx:679` (suggestion block) → `addScanTasks(...)`.

## 3. Why the candidate was rejected
It was never produced — `scanConsensusEngine.js:230-244` returns
`candidates: []` when both providers return no parsed identification.
No client-side discard exists.

## 4. Why the UI showed "Scan unclear"
Fallback label when `plantName` empty AND `topCandidates` empty
(`ScanCommandCard.jsx:73`, `ScanDecisionComposer.ts:100/173`).

## 5. Why Create Task appeared
The two non-IntelligentScanResult cards had no trust gate (part B above).

## 6. Fix applied
- **`canCreateTask = plantKnown && confidence ≥ 70 && diagnosisKnown`**
  added to BOTH `UsefulResultCard` and `ScanResultCard`; the task
  button now renders only when true.
- When false, `UsefulResultCard` shows the **unidentified explanation**
  ("We couldn't confidently identify this plant." + "Better photo
  needed before creating a task.") — the retake / save-for-review
  buttons below it ARE the review flow.
- Wording: "Scan unclear" is KEPT as the internal non-empty plant
  *token* (check-scan-mythos / check-scan-no-dead-ends / the server
  `scanRecoveryEnvelope` all depend on it as the floor that prevents an
  empty plant). Fully renaming the token would cascade across 4 gates +
  server code — out of scope for a P0. The farmer-facing fix is
  structural, not cosmetic: an unidentified scan now shows **no Create
  Task** + the unidentified explanation block, so "Scan unclear" never
  appears *without* an explanation. A clean follow-up can swap the
  display string (token → friendly copy at the render layer) if desired.
- **`window.__scanDebug()`** (#219) extended to the full forensic shape:
  `imageId, imageQuality, photoQuality, providerStatus, providerLatency,
  candidates, topCandidate, confidence, mythosDecision, trustGate,
  reviewQueueDecision, uiDecision, failureReason`. `providerStatus` =
  `unavailable` when the classifier isn't configured — the smoking gun.
- **`check:scan-unclear-safety`** (in build:safe) now FAILS the build if:
  Create Task can render for an unknown plant on ANY of the three cards;
  the unidentified explanation is missing; the composer emits bare "Scan
  unclear"; or `__scanDebug` drops a forensic field.

## 7. Acceptance tests
- Unidentified scan (empty candidates) → no Create Task on any card;
  unidentified explanation shown; retake/save-for-review available. ✓ gate
- Identified, confidence ≥70, diagnosis known → Create Task shows. ✓
- `window.__scanDebug().providerStatus` reveals `unavailable` when the
  classifier is unconfigured. ✓
- build:safe green.

## Operational follow-up (highest leverage, non-code)
Run one scan in prod and read `window.__scanDebug().providerStatus` +
`.providerResponse.classifierAvailable`. If `unavailable` / `false`,
**set `PLANT_ID_API_KEY` on Railway** — that unblocks real plant
identification and First Scan %.
