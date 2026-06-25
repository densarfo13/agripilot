# FRUIT_VEGETABLE_SCAN_REPORT.md

**Fruit & vegetable scans get a quality card, not the plant-only path.**
Sprint #231.

## The card — `FruitVegResultCard.jsx`

Routed to when `scanType` is `fruit` or `vegetable`. Renders:

| Field | Source | Example |
|---|---|---|
| **Detected** | candidate name + kind | "Tomato fruit" |
| **Status** | `fruitStatus` | Ripening / Ripe / Overripe / Damaged / Not yet clear |
| **Quality** | `qualityBand` | Good / Watch / At risk / Checking |
| **Issue** | `possibleIssue` / FarmBrain | Surface damage / rot / pest damage / disease spot |
| **Action** | FarmBrain `nextAction` | Harvest soon · Inspect nearby fruit · Remove damaged fruit · Retake |
| **Follow-up** | FarmBrain `followUpTask` | Today / 2 days / 7 days |

## What it never shows (§3, gate-enforced)

- ❌ "Unknown plant"
- ❌ "Needs review"
- ❌ a crop-health-only card

When the species name is missing it falls back to the generic kind
("Fruit" / "Vegetable") — never a dead label.

## Honest degrade

Detailed ripeness/damage analysis needs the Crop.health / quality
provider (key unset today), so `status`/`quality` show "Not yet clear" /
"Checking" with a one-line note ("judge by colour and firmness for now").
The card is real and useful immediately; the scored ripeness/damage fills
in when `CROP_HEALTH_API_KEY` is set — no code change.

## Acceptance

- tomato fruit → FruitVeg card, "Tomato fruit", no "Unknown plant" ✓
- pepper fruit → FruitVeg card, "Pepper fruit" ✓
- onion (vegetable candidate) → FruitVeg card, "Onion vegetable" ✓
