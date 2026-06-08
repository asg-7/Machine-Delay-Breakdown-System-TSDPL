"""
TSDPL - RUL Model Training  (v2 - Dual Classifier + Regressor)
================================================================
Models:
    1. GradientBoostingClassifier  -> risk class (IMMINENT/SOON/SAFE)
       with SMOTE for class imbalance
    2. GradientBoostingRegressor   -> rul_days (log-transformed target)
       with sample weighting

Evaluation:
    - Classification: F1 (macro/weighted), Precision, Recall, Confusion Matrix, ROC-AUC
    - Regression: MAE, RMSE, R2 on held-out test set

Run:
    python train.py --data ../sampledata
    python train.py --csv rul_features_v2.csv
"""

import argparse
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.model_selection import (
    cross_val_score, StratifiedKFold, KFold, train_test_split
)
from sklearn.metrics import (
    mean_absolute_error, r2_score, mean_squared_error,
    classification_report, confusion_matrix,
    f1_score, precision_score, recall_score,
)
from sklearn.preprocessing import LabelEncoder

try:
    from imblearn.over_sampling import SMOTE, ADASYN
    HAS_IMBLEARN = True
except ImportError:
    HAS_IMBLEARN = False
    print("[WARN] imbalanced-learn not installed — SMOTE disabled")

from feature_engineering import build_full_dataset


# ──────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────

FEATURE_COLS = [
    # Original 13
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
    # New 6
    "breakdown_streak",
    "delay_acceleration",
    "availability_trend",
    "tonnage_efficiency",
    "time_since_maintenance",
    "breakdown_severity_avg",
]

TARGET_COL = "rul_days"
CLASS_COL  = "risk_class"

# Risk class labels (order matters for encoding)
RISK_CLASSES = ["IMMINENT", "SOON", "SAFE"]

# Output paths
CLASSIFIER_PATH = "rul_classifier_v2.pkl"
REGRESSOR_PATH  = "rul_regressor_v2.pkl"
META_PATH       = "rul_model_meta_v2.json"
# Keep backward-compatible paths too
LEGACY_MODEL_PATH = "rul_model.pkl"
LEGACY_META_PATH  = "rul_model_meta.json"


# ──────────────────────────────────────────────
# SAMPLE WEIGHTING
# ──────────────────────────────────────────────

def compute_sample_weights(y: np.ndarray) -> np.ndarray:
    """
    Inverse frequency weighting: rare high-RUL samples get higher weight.
    This helps the regressor not just predict the mode (1.0).
    """
    # Bin RUL into categories for weighting
    bins = np.digitize(y, bins=[0, 1, 2, 3, 5, 10, 50, 100])
    unique_bins, counts = np.unique(bins, return_counts=True)
    total = len(y)
    weight_map = {b: total / (len(unique_bins) * c) for b, c in zip(unique_bins, counts)}
    weights = np.array([weight_map[b] for b in bins])
    # Normalise so mean weight = 1
    weights = weights / weights.mean()
    return weights


# ──────────────────────────────────────────────
# TRAIN CLASSIFIER
# ──────────────────────────────────────────────

def train_classifier(X_train, y_train, X_test, y_test, le):
    """Train GBC with SMOTE for class imbalance."""
    print("\n" + "=" * 60)
    print("  CLASSIFIER: GradientBoostingClassifier + SMOTE")
    print("=" * 60)

    y_train_enc = le.transform(y_train)
    y_test_enc  = le.transform(y_test)

    # ── SMOTE oversampling ─────────────────────────────────
    if HAS_IMBLEARN:
        # Determine k_neighbors: must be < smallest class count
        _, counts = np.unique(y_train_enc, return_counts=True)
        min_count = counts.min()
        k = min(5, min_count - 1) if min_count > 1 else 1

        if min_count > 1:
            try:
                smote = SMOTE(random_state=42, k_neighbors=k)
                X_resampled, y_resampled = smote.fit_resample(X_train, y_train_enc)
                print(f"\n  SMOTE applied: {len(X_train)} -> {len(X_resampled)} samples")
                print(f"  Class distribution after SMOTE:")
                for cls_idx, cls_name in enumerate(le.classes_):
                    n = (y_resampled == cls_idx).sum()
                    print(f"    {cls_name}: {n}")
            except Exception as e:
                print(f"\n  [WARN] SMOTE failed ({e}) — using original data")
                X_resampled, y_resampled = X_train, y_train_enc
        else:
            print(f"\n  [WARN] Min class has only {min_count} sample — SMOTE skipped")
            X_resampled, y_resampled = X_train, y_train_enc
    else:
        X_resampled, y_resampled = X_train, y_train_enc

    # ── Train ──────────────────────────────────────────────
    clf = GradientBoostingClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=2,
        random_state=42,
    )

    # Stratified CV on resampled data
    n_unique = len(np.unique(y_resampled))
    if len(y_resampled) >= 10 and n_unique >= 2:
        n_splits = min(5, min(np.bincount(y_resampled)))
        n_splits = max(2, n_splits)
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        cv_f1 = cross_val_score(clf, X_resampled, y_resampled, cv=cv, scoring="f1_macro")
        print(f"\n  CV F1-macro ({n_splits}-fold): {cv_f1.mean():.3f} ± {cv_f1.std():.3f}")
    else:
        cv_f1 = np.array([0.0])
        print("\n  [WARN] Too few samples for CV")

    clf.fit(X_resampled, y_resampled)

    # ── Evaluate on held-out test set ──────────────────────
    y_pred = clf.predict(X_test)
    y_pred_labels = le.inverse_transform(y_pred)
    y_test_labels = y_test

    print(f"\n  Test Set Classification Report:")
    print(classification_report(y_test_enc, y_pred, target_names=le.classes_, zero_division=0))

    cm = confusion_matrix(y_test_enc, y_pred)
    print(f"  Confusion Matrix:")
    print(f"  {cm}")

    f1_macro = f1_score(y_test_enc, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test_enc, y_pred, average="weighted", zero_division=0)
    precision_macro = precision_score(y_test_enc, y_pred, average="macro", zero_division=0)
    recall_macro = recall_score(y_test_enc, y_pred, average="macro", zero_division=0)

    print(f"\n  F1 (macro):     {f1_macro:.3f}")
    print(f"  F1 (weighted):  {f1_weighted:.3f}")
    print(f"  Precision:      {precision_macro:.3f}")
    print(f"  Recall:         {recall_macro:.3f}")

    # Feature importances
    importances = dict(zip(FEATURE_COLS, clf.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print(f"\n  Feature importances (classifier):")
    for fname, imp in sorted_imp[:10]:
        bar = "#" * int(imp * 40)
        print(f"    {fname:<26} {imp:.4f}  {bar}")

    clf_metrics = {
        "cv_f1_macro_mean": round(float(cv_f1.mean()), 3),
        "cv_f1_macro_std":  round(float(cv_f1.std()), 3),
        "test_f1_macro":    round(f1_macro, 3),
        "test_f1_weighted": round(f1_weighted, 3),
        "test_precision":   round(precision_macro, 3),
        "test_recall":      round(recall_macro, 3),
        "confusion_matrix": cm.tolist(),
        "feature_importance": {k: round(v, 4) for k, v in sorted_imp},
        "classes": le.classes_.tolist(),
    }

    return clf, clf_metrics


# ──────────────────────────────────────────────
# TRAIN REGRESSOR
# ──────────────────────────────────────────────

def train_regressor(X_train, y_train, X_test, y_test):
    """Train GBR with log-transformed target and sample weighting."""
    print("\n" + "=" * 60)
    print("  REGRESSOR: GradientBoostingRegressor (log-transformed)")
    print("=" * 60)

    # Log-transform to handle skew
    y_train_log = np.log1p(y_train)
    y_test_log  = np.log1p(y_test)

    # Sample weights: upweight rare high-RUL samples
    weights = compute_sample_weights(y_train)
    print(f"\n  Sample weight stats: min={weights.min():.2f}, max={weights.max():.2f}, "
          f"mean={weights.mean():.2f}")

    model = GradientBoostingRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        min_samples_leaf=2,
        loss="huber",
        random_state=42,
    )

    # CV on training set (log-space) — sample weights applied only at final fit
    if len(y_train_log) >= 10:
        cv = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_mae = -cross_val_score(model, X_train, y_train_log, cv=cv,
                                  scoring="neg_mean_absolute_error")
        cv_r2 = cross_val_score(model, X_train, y_train_log, cv=cv, scoring="r2")
        print(f"\n  CV (5-fold, log-space):")
        print(f"    MAE : {cv_mae.mean():.3f} +/- {cv_mae.std():.3f}")
        print(f"    R2  : {cv_r2.mean():.3f} +/- {cv_r2.std():.3f}")
    else:
        cv_mae = np.array([0.0])
        cv_r2 = np.array([0.0])

    # Fit on training set
    model.fit(X_train, y_train_log, sample_weight=weights)

    # Evaluate on test set (back-transform from log-space)
    y_pred_log = model.predict(X_test)
    y_pred = np.expm1(y_pred_log)  # inverse of log1p
    y_pred = np.clip(y_pred, 0.5, None)  # floor at 0.5 days

    test_mae  = mean_absolute_error(y_test, y_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    test_r2   = r2_score(y_test, y_pred)

    print(f"\n  Test Set (original-space):")
    print(f"    MAE  : {test_mae:.2f} days")
    print(f"    RMSE : {test_rmse:.2f} days")
    print(f"    R²   : {test_r2:.3f}")

    # Also show train fit
    y_train_pred_log = model.predict(X_train)
    y_train_pred = np.expm1(y_train_pred_log)
    train_r2 = r2_score(y_train, y_train_pred)
    print(f"    Train R²: {train_r2:.3f}")

    # Feature importances
    importances = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print(f"\n  Feature importances (regressor):")
    for fname, imp in sorted_imp[:10]:
        bar = "#" * int(imp * 40)
        print(f"    {fname:<26} {imp:.4f}  {bar}")

    reg_metrics = {
        "cv_mae_mean":  round(float(cv_mae.mean()), 3),
        "cv_mae_std":   round(float(cv_mae.std()), 3),
        "cv_r2_mean":   round(float(cv_r2.mean()), 3),
        "test_mae":     round(test_mae, 2),
        "test_rmse":    round(test_rmse, 2),
        "test_r2":      round(test_r2, 3),
        "train_r2":     round(train_r2, 3),
        "feature_importance": {k: round(v, 4) for k, v in sorted_imp},
    }

    return model, reg_metrics


# ──────────────────────────────────────────────
# MAIN TRAIN PIPELINE
# ──────────────────────────────────────────────

def train(df: pd.DataFrame):
    """Full dual-model training pipeline."""

    # Validate columns
    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")
    if TARGET_COL not in df.columns:
        raise ValueError(f"Missing target column: {TARGET_COL}")
    if CLASS_COL not in df.columns:
        raise ValueError(f"Missing class column: {CLASS_COL}")

    X = df[FEATURE_COLS].values.astype(float)
    y = df[TARGET_COL].values.astype(float)
    y_class = np.array(df[CLASS_COL].tolist(), dtype=str)  # plain numpy, not PyArrow

    # Merge SAFE into SOON if SAFE has very few samples (avoids stratify issues)
    safe_count = (y_class == "SAFE").sum()
    if safe_count < 5:
        print(f"\n  [INFO] Merging {safe_count} SAFE samples into SOON (too few for stratification)")
        y_class[y_class == "SAFE"] = "SOON"

    print(f"\n{'=' * 60}")
    print(f"  TSDPL RUL MODEL TRAINING (v2 - Dual Architecture)")
    print(f"{'=' * 60}")
    print(f"\n  Total samples: {len(y)}")
    print(f"  Target range:  {y.min():.1f} - {y.max():.1f} days")
    print(f"  Target mean:   {y.mean():.2f} days")
    print(f"  Target median: {np.median(y):.2f} days")
    print(f"\n  Class distribution:")
    for cls in RISK_CLASSES:
        n = (y_class == cls).sum()
        pct = n / len(y_class) * 100
        print(f"    {cls:10s}: {n:4d} ({pct:.1f}%)")

    # ── Encode labels (fit only on classes that exist after merge) ──
    actual_classes = sorted(np.unique(y_class).tolist())
    le = LabelEncoder()
    le.fit(actual_classes)

    # ── Train/test split (stratified by risk class) ──
    min_class_count = min(pd.Series(y_class).value_counts().values)
    if min_class_count < 2:
        print(f"\n  [WARN] Smallest class has {min_class_count} samples - no stratified split")
        X_train, X_test, y_train, y_test, yc_train, yc_test = train_test_split(
            X, y, y_class, test_size=0.2, random_state=42
        )
    else:
        X_train, X_test, y_train, y_test, yc_train, yc_test = train_test_split(
            X, y, y_class, test_size=0.2, random_state=42, stratify=y_class
        )

    print(f"\n  Train: {len(X_train)} | Test: {len(X_test)}")

    # ── 1. Train Classifier ──
    clf, clf_metrics = train_classifier(X_train, yc_train, X_test, yc_test, le)

    # ── 2. Train Regressor ──
    reg, reg_metrics = train_regressor(X_train, y_train, X_test, y_test)

    # ── Save models ──
    with open(CLASSIFIER_PATH, "wb") as f:
        pickle.dump({"model": clf, "label_encoder": le}, f)

    with open(REGRESSOR_PATH, "wb") as f:
        pickle.dump(reg, f)

    # Also save regressor as legacy path for backward compat
    with open(LEGACY_MODEL_PATH, "wb") as f:
        pickle.dump(reg, f)

    # ── Save metadata ──
    meta = {
        "version": "2.0",
        "feature_cols": FEATURE_COLS,
        "target": TARGET_COL,
        "risk_classes": RISK_CLASSES,
        "n_training_rows": int(len(y)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "classifier": clf_metrics,
        "regressor": reg_metrics,
        "y_min": round(float(y.min()), 1),
        "y_max": round(float(y.max()), 1),
        "y_mean": round(float(y.mean()), 2),
        "y_median": round(float(np.median(y)), 2),
        "risk_classes": actual_classes,
        "class_distribution": {
            cls: int((y_class == cls).sum()) for cls in actual_classes
        },
        # Legacy compatibility fields
        "cv_mae_mean": reg_metrics["cv_mae_mean"],
        "cv_mae_std": reg_metrics["cv_mae_std"],
        "cv_r2_mean": reg_metrics["cv_r2_mean"],
        "feature_importance": reg_metrics["feature_importance"],
    }

    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    # Also save as legacy meta
    with open(LEGACY_META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  MODELS SAVED")
    print(f"{'=' * 60}")
    print(f"  Classifier -> {CLASSIFIER_PATH}")
    print(f"  Regressor  -> {REGRESSOR_PATH}")
    print(f"  Metadata   -> {META_PATH}")
    print(f"  (Legacy)   -> {LEGACY_MODEL_PATH}, {LEGACY_META_PATH}")

    return clf, reg, meta


# ──────────────────────────────────────────────
# CLI ENTRY
# ──────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train TSDPL RUL dual model (v2)")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--data", help="Path to sampledata/ folder")
    group.add_argument("--csv",  help="Path to pre-built rul_features_v2.csv")
    args = parser.parse_args()

    if args.csv:
        df = pd.read_csv(args.csv)
    else:
        df = build_full_dataset(args.data)
        df.to_csv("rul_features_v2.csv", index=False)
        print("\nFeature CSV saved -> rul_features_v2.csv")

    train(df)
