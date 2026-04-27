# Farroway ML — baseline training pipeline

This folder is the **offline** half of Farroway's first ML loop. The
app collects labeled task events, exports them as a flat JSON
dataset, a Python script trains a logistic-regression baseline per
risk domain, and the resulting model JSONs get committed back into
`ml/model_exports/` for the app to read at runtime.

The pipeline is intentionally simple. **It is not production ML**:
no GPU, no MLOps platform, no continuous training. The goal is to
graduate from pure rule-engine risk scoring to a calibrated baseline
that improves as the labeled dataset grows.

## Data flow

```
┌────────────────────┐    download    ┌──────────────────────┐    train     ┌──────────────────────┐
│ Farroway frontend  │ ─────────────► │ farroway_training_   │ ───────────► │ pest_model.json      │
│ (labels + events + │                │   dataset.json       │              │ drought_model.json   │
│  weather + farms)  │                │   (flat row table)   │              │  (weights + bias)    │
└────────────────────┘                └──────────────────────┘              └──────────────────────┘
                                                                                       │
                                                                                       │  ship in repo
                                                                                       ▼
                                                                            ┌──────────────────────┐
                                                                            │ src/ai/mlRiskEngine  │
                                                                            │  loads + infers,     │
                                                                            │  falls back to       │
                                                                            │  rule engine if      │
                                                                            │  weights are zero    │
                                                                            └──────────────────────┘
```

## Step 1 — export from the app

Open Farroway in a browser, sign in, and run from the DevTools
console (or wire to a "Download training data" button on an admin
page):

```js
import('./src/data/exportTrainingDataset.js').then(m => m.downloadTrainingDataset());
```

The browser saves `farroway_training_dataset.json` with one row per
labeled task event:

```json
{
  "schema": "farroway-training-dataset",
  "schemaVersion": 1,
  "exportedAt": "2026-04-27T...",
  "rowCount": 137,
  "rows": [
    {
      "farmId": "...",
      "crop": "cassava",
      "region": "Ashanti",
      "daysSincePlanting": 32,
      "temperatureHigh": 1,
      "rainLast3Days": 0,
      "humidityHigh": 1,
      "nearbyPestReports": 4,
      "inactiveDays": 2,
      "tasksCompleted7d": 3,
      "labelPest": 1,
      "labelDrought": 0,
      "confidence": "medium",
      "timestamp": 1714175873000
    }
  ]
}
```

## Step 2 — train

```bash
pip install pandas scikit-learn
python ml/train_baseline.py \
  --input  ml/data/farroway_training_dataset.json \
  --output ml/model_exports
```

The script:

1. Loads the dataset (raw array OR `{ rows: [...] }` shape).
2. Drops rows where the relevant label (`labelPest` / `labelDrought`)
   is null.
3. Fits a `sklearn.linear_model.LogisticRegression` per label, with
   an 80/20 stratified split when n ≥ 50.
4. Prints accuracy / precision / recall / confusion matrix.
5. Writes `ml/model_exports/pest_model.json` and
   `ml/model_exports/drought_model.json` in the format the app's
   `src/ai/modelRunner.js` already consumes.

If a label has fewer than 30 examples or only one class is present,
the script writes a **zero-weight placeholder** so the app side
always has files to load. The app's `mlRiskEngine` detects zero
weights and routes back to the rule engine — never crashes, never
mis-predicts.

## Step 3 — ship

Commit the new model JSONs into the repo. The app's
`src/ai/mlRiskEngine.js` loads them via dynamic import and uses them
for inference on the next build. If the JSONs are absent or
zero-weight, the rule engine in `src/outbreak/riskEngine.js` is the
authoritative source — exactly the behaviour before ML existed.

```bash
git add ml/model_exports/pest_model.json ml/model_exports/drought_model.json
git commit -m "ml: refresh baseline weights from N labeled rows"
git push
```

## Guardrails (per spec § 9)

- **Under 500 rows of dataset**: every model JSON carries
  `"warning": "Baseline model only — more data needed."`. The app
  can choose to display this on the NGO dashboard so trust
  expectations stay calibrated.
- **Zero-weight model**: app falls back to rule engine. Never
  crashes, never claims an unearned accuracy.
- **No raw weights to users**: the app only ever shows risk level
  (`HIGH` / `MEDIUM` / `LOW`) plus the explainability strings
  (`src/ai/explainability.js`). Weights stay internal.
- **Single-class labels** (e.g. all `labelPest = 0`): the script
  detects this and emits a zero-weight model rather than train a
  degenerate classifier.

## Files in this folder

| File | Purpose |
|---|---|
| `train_baseline.py` | Offline trainer (pandas + sklearn) |
| `model_exports/pest_model.json` | Pest model weights (zero-weight placeholder until the first real run) |
| `model_exports/drought_model.json` | Drought model weights (zero-weight placeholder until the first real run) |
| `data/` | (gitignored) Place to drop dataset files for training |

## Related code

- Frontend exporter: `src/data/exportTrainingDataset.js`
- Inference: `src/ai/modelRunner.js`
- App-side risk engine with rule-engine fallback: `src/ai/mlRiskEngine.js`
- Risk-level mapping: `src/ai/riskMapper.js`
- Explainability: `src/ai/explainability.js`
- Rule engine (fallback / source of truth pre-ML):
  `src/outbreak/riskEngine.js`
