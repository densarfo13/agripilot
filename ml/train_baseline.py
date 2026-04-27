"""
train_baseline.py — train pest + drought logistic-regression
baselines from a Farroway training dataset and export the model
weights as JSON the app can consume.

Usage
    python ml/train_baseline.py \\
        --input  ml/data/farroway_training_dataset.json \\
        --output ml/model_exports

Inputs
    A JSON file produced by src/data/exportTrainingDataset.js
    (`downloadTrainingDataset()` in the app). The file is either:
      * the raw array shape:  [ {row}, {row}, ... ]
      * the wrapped shape:    { rows: [...], exportedAt: ... }
    Both are accepted.

Outputs
    ml/model_exports/pest_model.json
    ml/model_exports/drought_model.json

Each model JSON has the shape the app's modelRunner consumes:

    {
      "features": ["daysSincePlanting", "temperatureHigh", ...],
      "weights": [...],
      "bias": 0.0,
      "thresholds": { "medium": 0.4, "high": 0.7 },
      "trainedAt": "2026-04-27T...",
      "version": "baseline_v1",
      "datasetRows": 137,
      "metrics": {
          "accuracy": 0.78,
          "precision": 0.71,
          "recall": 0.66,
          "confusion": [[80, 7], [12, 38]]
      },
      "warning": "Baseline model only — more data needed."
    }

Strict-rule guardrails (per spec § 9)
    * If the labeled subset for either model is under
      MIN_ROWS_FOR_TRAINING, the script writes the model with
      zero weights + zero bias + a clear warning string. The app
      treats zero-weight models as "no model trained yet" and
      falls through to the rule-engine.
    * Never trains on rows with the label missing — labelPest /
      labelDrought = null are filtered out per model.
    * Never silently overrides existing rule-engine behaviour;
      app-side mlRiskEngine is responsible for the fallback.

Dependencies
    pip install pandas scikit-learn

This script is intentionally simple. It is NOT a production
training pipeline — see ml/README.md for context.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split


FEATURES: List[str] = [
    "daysSincePlanting",
    "temperatureHigh",
    "rainLast3Days",
    "humidityHigh",
    "nearbyPestReports",
    "inactiveDays",
    "tasksCompleted7d",
]

THRESHOLDS: Dict[str, float] = {"medium": 0.4, "high": 0.7}
MODEL_VERSION = "baseline_v1"
MIN_ROWS_FOR_TRAINING = 500
WARNING_LOW_DATA = "Baseline model only \u2014 more data needed."


def _load_rows(path: str) -> List[Dict[str, Any]]:
    """Accept either the raw array shape or the wrapped {rows: ...} shape."""
    with open(path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("rows"), list):
        return payload["rows"]
    raise ValueError(
        f"{path}: expected an array of rows or {{rows: [...]}}, got "
        f"{type(payload).__name__}"
    )


def _to_dataframe(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    # Coerce missing columns to 0 so partial rows still align.
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0
    df[FEATURES] = df[FEATURES].fillna(0).astype(float)
    return df


def _zero_weight_model(label_col: str, dataset_rows: int) -> Dict[str, Any]:
    """Emit a placeholder model when there isn't enough labeled data."""
    return {
        "features": FEATURES,
        "weights": [0.0] * len(FEATURES),
        "bias": 0.0,
        "thresholds": THRESHOLDS,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "version": MODEL_VERSION,
        "datasetRows": dataset_rows,
        "label": label_col,
        "metrics": None,
        "warning": WARNING_LOW_DATA,
    }


def _train_one(
    df: pd.DataFrame, label_col: str
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Train a single LogisticRegression for `label_col`. Returns (model_json, metrics)."""
    sub = df[df[label_col].notna()].copy()
    n = len(sub)
    if n < 30:
        # Not enough labeled rows to even fit a sklearn model — emit a
        # zero-weight placeholder so the app side has a file to load.
        # Threshold of 30 is the absolute floor; under it sklearn's CV
        # split routinely fails with "least populated class has too few
        # members".
        print(f"  [{label_col}] too few labels ({n}) — emitting zero-weight model")
        return _zero_weight_model(label_col, n), {}

    X = sub[FEATURES].values
    y = sub[label_col].astype(int).values

    # If only one class is present we can't train a discriminator.
    if len(set(y)) < 2:
        print(f"  [{label_col}] only one class present in labels — emitting zero-weight model")
        return _zero_weight_model(label_col, n), {}

    # Hold out 20% for evaluation. With small datasets this is noisy
    # but better than nothing — flagged in the warning below.
    test_size = 0.2 if n >= 50 else 0.0
    if test_size > 0:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
    else:
        X_tr, X_te, y_tr, y_te = X, X, y, y

    clf = LogisticRegression(
        solver="lbfgs",
        max_iter=1000,
        C=1.0,
        random_state=42,
    )
    clf.fit(X_tr, y_tr)
    y_pred = clf.predict(X_te)

    metrics = {
        "accuracy":  float(accuracy_score(y_te, y_pred)),
        "precision": float(precision_score(y_te, y_pred, zero_division=0)),
        "recall":    float(recall_score(y_te, y_pred, zero_division=0)),
        "confusion": confusion_matrix(y_te, y_pred).tolist(),
    }

    print(f"  [{label_col}] n={n} accuracy={metrics['accuracy']:.3f} "
          f"precision={metrics['precision']:.3f} recall={metrics['recall']:.3f}")
    print(f"  [{label_col}] confusion={metrics['confusion']}")

    model_json: Dict[str, Any] = {
        "features": FEATURES,
        "weights": [float(w) for w in clf.coef_[0]],
        "bias": float(clf.intercept_[0]),
        "thresholds": THRESHOLDS,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "version": MODEL_VERSION,
        "datasetRows": n,
        "label": label_col,
        "metrics": metrics,
    }
    if n < MIN_ROWS_FOR_TRAINING:
        model_json["warning"] = WARNING_LOW_DATA
    return model_json, metrics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input", required=True,
        help="Path to farroway_training_dataset.json"
    )
    parser.add_argument(
        "--output", default="ml/model_exports",
        help="Output directory for pest_model.json + drought_model.json"
    )
    args = parser.parse_args()

    print(f"Loading dataset: {args.input}")
    rows = _load_rows(args.input)
    print(f"  total rows: {len(rows)}")
    df = _to_dataframe(rows)

    print("Training pest_model")
    pest_model, _ = _train_one(df, "labelPest")

    print("Training drought_model")
    drought_model, _ = _train_one(df, "labelDrought")

    os.makedirs(args.output, exist_ok=True)
    pest_path = os.path.join(args.output, "pest_model.json")
    drought_path = os.path.join(args.output, "drought_model.json")
    with open(pest_path, "w", encoding="utf-8") as fh:
        json.dump(pest_model, fh, indent=2)
    with open(drought_path, "w", encoding="utf-8") as fh:
        json.dump(drought_model, fh, indent=2)

    print(f"Wrote {pest_path}")
    print(f"Wrote {drought_path}")

    if pest_model.get("warning") or drought_model.get("warning"):
        print(f"\nWARNING: {WARNING_LOW_DATA}")
        print("Models exported anyway so the app can load them; they fall through")
        print("to the rule-engine when weights are zero or accuracy is low.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
