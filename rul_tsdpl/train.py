"""
TSDPL — RUL Model Training
===========================
Algorithm  : Gradient Boosting Regressor (scikit-learn)
Why GBR?   : handles small tabular datasets well, no scaling needed,
             gives feature importances natively, interpretable for an interview.
             XGBoost / LightGBM are drop-in upgrades once data grows.

Run:
    python train.py --data ../sampledata
    python train.py --csv rul_features.csv   # use pre-built features
"""

import argparse
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, KFold, train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.inspection import permutation_importance

from feature_engineering import build_full_dataset


# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

FEATURE_COLS = [
    "mtbf_days",
    "mtbf_std",
    "mtbf_trend",
    "mttr_min",
    "days_since_last_bd",
    "bd_freq_30d",
    "avg_avail_7d",
    "avg_avail_30d",
    "avg_tonnage_7d",
    "delay_min_7d",
    "delay_min_30d",
    "delay_diversity",
    "machine_id",
]

TARGET_COL = "rul_days"

MODEL_PATH   = "rul_model.pkl"
META_PATH    = "rul_model_meta.json"


# ──────────────────────────────────────────────
# TRAIN
# ──────────────────────────────────────────────

def train(df: pd.DataFrame):
    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    print(f"\nSamples: {len(y)}  |  Target range: {y.min():.1f} - {y.max():.1f} days")

    # ── Hyper-parameters (tuned for small industrial datasets) ──
    model = GradientBoostingRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=2,
        loss="huber",          # robust to outlier breakdown events
        random_state=42,
    )

    # ── Cross-validation (use LeaveOneOut if dataset < 20 rows) ──
    if len(y) >= 10:
        cv = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_mae = -cross_val_score(model, X, y, cv=cv, scoring="neg_mean_absolute_error")
        cv_r2  =  cross_val_score(model, X, y, cv=cv, scoring="r2")
        print(f"\nCross-validation (5-fold):")
        print(f"  MAE : {cv_mae.mean():.2f} ± {cv_mae.std():.2f} days")
        print(f"  R²  : {cv_r2.mean():.3f} ± {cv_r2.std():.3f}")
    else:
        print(f"\n[WARN] Only {len(y)} samples — cross-validation skipped.")
        print("       Collect more shift data for reliable CV.")
        cv_mae = np.array([0.0])
        cv_r2  = np.array([0.0])

    # ── Final fit on full dataset ──────────────────────────────
    # (In production with more data: keep a held-out test set)
    model.fit(X, y)

    train_pred = model.predict(X)
    train_mae  = mean_absolute_error(y, train_pred)
    train_r2   = r2_score(y, train_pred)
    print(f"\nTrain fit:  MAE={train_mae:.2f}d   R²={train_r2:.3f}")

    # ── Feature importance ─────────────────────────────────────
    importances = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    sorted_imp  = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print("\nFeature importances:")
    for fname, imp in sorted_imp:
        bar = "#" * int(imp * 40)
        print(f"  {fname:<22} {imp:.4f}  {bar}")

    # ── Save model ─────────────────────────────────────────────
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    # Metadata sent to the frontend via /model-info endpoint
    meta = {
        "feature_cols":    FEATURE_COLS,
        "target":          TARGET_COL,
        "n_training_rows": int(len(y)),
        "cv_mae_mean":     round(float(cv_mae.mean()), 2),
        "cv_mae_std":      round(float(cv_mae.std()),  2),
        "cv_r2_mean":      round(float(cv_r2.mean()),  3),
        "feature_importance": {k: round(v, 4) for k, v in sorted_imp},
        "y_min": round(float(y.min()), 1),
        "y_max": round(float(y.max()), 1),
        "y_mean": round(float(y.mean()), 1),
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nModel saved -> {MODEL_PATH}")
    print(f"Metadata   -> {META_PATH}")
    return model, meta


# ──────────────────────────────────────────────
# CLI ENTRY
# ──────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--data", help="Path to sampledata/ folder")
    group.add_argument("--csv",  help="Path to pre-built rul_features.csv")
    args = parser.parse_args()

    if args.csv:
        df = pd.read_csv(args.csv)
    else:
        df = build_full_dataset(args.data)

    train(df)
