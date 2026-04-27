"""
train_pest_drought.py
─────────────────────
Trainer for the Farroway pest + drought logistic-regression
predictors. Consumes the JSON bundle produced by
`exportTrainingData()` (src/data/export.js) and emits two
app-friendly model files:

    public/models/pest.json
    public/models/drought.json

Each output JSON matches the shape `isValidModelSpec` checks
in src/ai/modelSpec.js, so the runtime can adopt the new
weights with no code change.

Strict rules
────────────
* Simple        : sklearn.linear_model.LogisticRegression.
                  Linear, fully explainable. No deep nets.
* Explainable   : the same `weights[]` + `bias` the runtime
                  uses in src/ai/modelRunner.js.
* Small data    : C=1.0 + class_weight='balanced' so the model
                  is robust at low N. Scaling is intentionally
                  OFF - the runtime feeds raw feature values.
* App-friendly  : output JSON only; no pickle, no numpy floats.

Usage
─────
    pip install scikit-learn
    python scripts/ml/train_pest_drought.py \\
        --bundle path/to/farroway_training_<ts>.json \\
        --out    public/models

The bundle file is the JSON saved by `downloadTrainingData()`
in the NGO admin tool. The script joins events + outcomes by
farmId and labels each (farmId, time-window) pair with the
NEXT outcome observation within the window.

If the bundle has fewer than MIN_SAMPLES rows for a task, the
script SKIPS that task and reports the gap - the runtime
keeps its cold-start defaults until enough labels exist.
"""

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone

try:
    from sklearn.linear_model import LogisticRegression
except ImportError:
    sys.stderr.write(
        "[train] scikit-learn is required. `pip install scikit-learn`.\n"
    )
    sys.exit(1)


SCHEMA_VERSION = 1
MIN_SAMPLES    = 30   # below this, keep the cold-start defaults

# Feature ordering MUST match src/ai/modelSpec.js FEATURE_ORDER.
FEATURE_ORDER = [
    "temp_high",
    "rain_last_3_days",
    "humidity_high",
    "days_since_planting",
    "pest_reports",
    "inactivity_days",
]

# Outcome -> task -> binary label.
PEST_POSITIVE_LABELS    = {"pest_detected", "disease_detected"}
PEST_NEGATIVE_LABELS    = {"healthy", "harvest_ok"}

DROUGHT_POSITIVE_LABELS = {"drought_affected", "harvest_loss"}
DROUGHT_NEGATIVE_LABELS = {"healthy", "harvest_ok"}


# ─── Bundle parsing ───────────────────────────────────────────────


def load_bundle(path):
    with open(path, "r", encoding="utf-8") as fh:
        bundle = json.load(fh)
    if not isinstance(bundle, dict):
        raise ValueError(f"bundle at {path} is not a JSON object")
    bundle.setdefault("events",   [])
    bundle.setdefault("outcomes", [])
    return bundle


def build_examples(bundle, task):
    """
    Walk events + outcomes, produce (X, y) for the requested task.

    Each row is a per-farm snapshot computed at the timestamp of
    one of that farm's outcome rows. Features count events that
    happened BEFORE the outcome timestamp.
    """
    if task == "pest":
        pos, neg = PEST_POSITIVE_LABELS, PEST_NEGATIVE_LABELS
    elif task == "drought":
        pos, neg = DROUGHT_POSITIVE_LABELS, DROUGHT_NEGATIVE_LABELS
    else:
        raise ValueError(f"unknown task {task!r}")

    events_by_farm = {}
    for e in bundle.get("events", []):
        if not isinstance(e, dict):
            continue
        payload = e.get("payload") or {}
        fid = payload.get("farmId")
        if fid is None:
            continue
        events_by_farm.setdefault(str(fid), []).append(e)

    rows = []
    for o in bundle.get("outcomes", []):
        if not isinstance(o, dict):
            continue
        outcome = (o.get("outcome") or "").lower()
        if outcome in pos:
            label = 1
        elif outcome in neg:
            label = 0
        else:
            continue
        fid = o.get("farmId")
        if fid is None:
            continue
        ts  = o.get("timestamp")
        try:
            ts = float(ts)
        except (TypeError, ValueError):
            continue

        farm_events = events_by_farm.get(str(fid), [])
        before = [e for e in farm_events if _ts_or_zero(e.get("timestamp")) < ts]
        x = featurise(before, payload_meta=(o.get("payload") or {}))
        rows.append((x, label))

    if not rows:
        return [], []
    X = [r[0] for r in rows]
    y = [r[1] for r in rows]
    return X, y


def _ts_or_zero(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0


def _payload_get(e, key, default=None):
    p = (e or {}).get("payload") or {}
    return p.get(key, default)


def featurise(events, payload_meta=None):
    """
    Reduce a per-farm event list to the FEATURE_ORDER vector.
    Pure function, no I/O. Defensive on every field.
    """
    payload_meta = payload_meta or {}

    pest_reports     = sum(1 for e in events if (e or {}).get("type") == "PEST_REPORTED")
    inactivity_days  = sum(1 for e in events if (e or {}).get("type") == "FARM_INACTIVE")

    # Latest weather signals seen in WEATHER_FETCHED events,
    # with sensible defaults when nothing's been logged yet.
    temp_high          = 0
    rain_last_3_days   = 0
    humidity_high      = 0
    for e in events:
        if (e or {}).get("type") != "WEATHER_FETCHED":
            continue
        p = (e.get("payload") or {})
        if "temp_high" in p:        temp_high        = 1 if p["temp_high"]        else 0
        if "rain_last_3_days" in p: rain_last_3_days = 1 if p["rain_last_3_days"] else 0
        if "humidity_high" in p:    humidity_high    = 1 if p["humidity_high"]    else 0

    # days_since_planting: lifted from the outcome payload when
    # available; 0 otherwise.
    dsp = payload_meta.get("days_since_planting", 0)
    try:
        days_since_planting = float(dsp) if dsp is not None else 0.0
    except (TypeError, ValueError):
        days_since_planting = 0.0

    return [
        float(temp_high),
        float(rain_last_3_days),
        float(humidity_high),
        float(days_since_planting),
        float(pest_reports),
        float(inactivity_days),
    ]


# ─── Training ────────────────────────────────────────────────────


def train_one(task, X, y, *, source):
    """
    Fit a single LogisticRegression. Returns the JSON-ready
    model spec (or None when there isn't enough data).
    """
    n = len(X)
    if n < MIN_SAMPLES:
        return None

    pos = sum(1 for v in y if v == 1)
    neg = n - pos
    if pos == 0 or neg == 0:
        # Single-class data won't train usefully; bail out so the
        # runtime keeps the cold-start defaults.
        return None

    model = LogisticRegression(
        solver="lbfgs",
        C=1.0,
        max_iter=1000,
        class_weight="balanced",
    )
    model.fit(X, y)

    # Coerce to plain Python floats. NumPy floats serialise but
    # the runtime's isValidModelSpec does explicit `typeof === 'number'`.
    weights = [float(w) for w in model.coef_[0]]
    bias    = float(model.intercept_[0])

    return {
        "schemaVersion": SCHEMA_VERSION,
        "task":          task,
        "trainedAt":     datetime.now(timezone.utc).isoformat(),
        "source":        source,
        "feature_order": list(FEATURE_ORDER),
        "weights":       weights,
        "bias":          bias,
        "n_samples":     n,
        "n_positive":    pos,
        "n_negative":    neg,
    }


def write_model(out_dir, task, spec):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{task}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(spec, fh, indent=2, sort_keys=False)
        fh.write("\n")
    return path


# ─── CLI ─────────────────────────────────────────────────────────


def main():
    ap = argparse.ArgumentParser(description="Train Farroway pest + drought models.")
    ap.add_argument("--bundle", required=True,
        help="Path to a farroway_training_<ts>.json bundle.")
    ap.add_argument("--out", default="public/models",
        help="Directory to write pest.json + drought.json.")
    ap.add_argument("--source", default="trained",
        help="Free-form source tag stored on the model spec.")
    args = ap.parse_args()

    bundle = load_bundle(args.bundle)
    print(f"[train] events={len(bundle['events'])}  "
          f"outcomes={len(bundle['outcomes'])}")

    summary = {}
    for task in ("pest", "drought"):
        X, y = build_examples(bundle, task)
        spec = train_one(task, X, y, source=args.source)
        if spec is None:
            print(f"[train] {task}: skipped "
                  f"(need >= {MIN_SAMPLES} balanced samples; got {len(X)})")
            summary[task] = {"trained": False, "n": len(X)}
            continue
        path = write_model(args.out, task, spec)
        print(f"[train] {task}: wrote {path} "
              f"(n={spec['n_samples']}, pos={spec['n_positive']}, "
              f"neg={spec['n_negative']})")
        summary[task] = {"trained": True, "path": path,
                         "n": spec["n_samples"]}

    return 0 if any(v.get("trained") for v in summary.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
