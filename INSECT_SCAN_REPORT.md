# INSECT_SCAN_REPORT.md

**Insect scans go to a pest card via the Insect.id route — never
"Unknown plant".** Sprint #231.

## The card — `InsectResultCard.jsx`

Routed to when `scanType` is `insect` (route `insect_pest`, provider
**insect.id**). Renders:

| Field | Source |
|---|---|
| **Detected pest** | `detectedInsect` / candidate / possibleIssue |
| **Confidence** | `confidencePct` / FarmBrain `confidenceScore` |
| **Threat level** | `threatLevel` → Low / Moderate / High / Not yet clear |
| **Crop impact** | `cropImpact` / generic guidance |
| **Safe next action** | FarmBrain `nextAction` / safe default |
| **Follow-up** | FarmBrain `followUpTask` / 2 days |

Plus a standing safety note: start with hand-picking + traps; only spray
if it spreads, and follow the label.

## Routing integrity (§4, gate-enforced)

- The insect route's provider list is **`['insect.id']`** — the build
  gate fails if an insect scan could bypass Insect.id.
- The card never renders the plant-only label.

## Honest degrade

`INSECT_ID_API_KEY` is unset today, so until it's configured the card
shows **"Pest not yet identified"** + "take a closer, well-lit photo so we
can identify it" rather than a fabricated pest name. The route is wired;
adding the key turns on real Insect.id identification with no code change.

## Acceptance

- insect on leaf → Insect card, route `insect_pest`, no "Unknown plant" ✓
- low-confidence insect → no plant/task created; coaching shown ✓
