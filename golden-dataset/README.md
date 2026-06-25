# Golden Dataset

Operator-populated. Each entry is a VERIFIED image with its ground truth:

```json
[
  { "image": "maize_healthy_01.jpg", "objectType": "wholePlant", "crop": "maize", "label": "healthy" },
  { "image": "tomato_blight_01.jpg", "objectType": "leaf", "crop": "tomato", "label": "late_blight" }
]
```

Target: **1000+ verified images** across crops/fruits/flowers/weeds/trees/
vegetables/mushrooms/insects/diseases + unknown objects. Images live next to this
file (git-ignored if large) or in `GOLDEN_DATASET_DIR`.

Run: `SCAN_API_BASE=… SCAN_API_TOKEN=… npm run golden:dataset`
The accuracy is recorded to `golden-dataset/baseline.json`; a later run that
DECREASES accuracy fails (check:provider-reliability). Accuracy is never
fabricated — an empty manifest reports PENDING, which is allowed pre-population.
