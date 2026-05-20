"""
test_anomaly_detector.py
------------------------
Runnable tests + synthetic data generator for local development.

Run with:
    python test_anomaly_detector.py

No pytest required — plain assertions so you can run this immediately
without installing test tooling.
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta

import sys
from pathlib import Path
# Ensure project root is on sys.path so anomaly_detector package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anomaly_detector.feature_engineering import engineer_features
from anomaly_detector.anomaly_detector import ShiftAnomalyDetector


# ── synthetic data generator ──────────────────────────────────────────────────

def make_synthetic_shifts(
    n_normal: int = 200,
    n_anomalous: int = 15,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generates realistic TSDPL-style shift data.

    Normal shifts:  tonnage ~N(450, 30), delay ~N(45, 15) mins
    Anomalous:      tonnage ~N(150, 40) AND delay ~N(200, 30) — obvious bad shifts
    """
    rng = np.random.default_rng(seed)

    lines    = ["WCTL-1", "WCTL-2", "SLITTER"]
    shifts   = ["A", "B", "C"]
    incharge = [f"OP-{i:03d}" for i in range(1, 9)]

    start = date(2024, 1, 1)

    def _make_rows(n, prod_mu, prod_sd, delay_mu, delay_sd, label):
        rows = []
        for i in range(n):
            d     = start + timedelta(days=int(rng.integers(0, 365)))
            prod  = max(50, rng.normal(prod_mu, prod_sd))
            delay = max(0, rng.normal(delay_mu, delay_sd))
            bkd   = int(rng.poisson(delay / 60))
            rows.append({
                "shift_date":        d.isoformat(),
                "shift":             rng.choice(shifts),
                "line":              rng.choice(lines),
                "incharge":          rng.choice(incharge),
                "production_tonnes": round(prod, 1),
                "available_hours":   8.0,
                "delay_minutes":     round(delay, 1),
                "breakdown_count":   bkd,
                "delay_breakdown":   round(delay * 0.6, 1),
                "delay_planned":     round(delay * 0.25, 1),
                "delay_other":       round(delay * 0.15, 1),
                "target_tonnes":     460.0,
                "_label":            label,
            })
        return rows

    normal    = _make_rows(n_normal,    450, 30, 45,  15,  "normal")
    anomalous = _make_rows(n_anomalous, 150, 40, 200, 30, "anomaly")

    df = pd.DataFrame(normal + anomalous).sample(frac=1, random_state=seed).reset_index(drop=True)
    return df


# ── tests ─────────────────────────────────────────────────────────────────────

def test_feature_engineering():
    print(">>  test_feature_engineering ... ", end="")
    df = make_synthetic_shifts()
    df_feat, feat_cols = engineer_features(df)

    assert len(df_feat) == len(df), "Row count must be preserved"
    assert len(feat_cols) > 0,      "Feature list must be non-empty"
    assert "availability" in feat_cols
    assert "delay_ratio"  in feat_cols
    assert df_feat[feat_cols].isnull().sum().sum() == 0, "No NaN in features after engineering"
    print("PASS")


def test_fit_predict():
    print(">>  test_fit_predict ... ", end="")
    df = make_synthetic_shifts()
    df_feat, feat_cols = engineer_features(df)

    detector = ShiftAnomalyDetector(contamination=0.05)
    detector.fit(df_feat, feat_cols)
    results = detector.predict(df_feat, feat_cols)

    assert len(results) == len(df)
    assert "anomaly_score" in results.columns
    assert "is_anomaly"    in results.columns
    assert "top_drivers"   in results.columns
    assert results["anomaly_score"].between(0, 1).all(), "Scores must be in [0,1]"
    print("PASS")


def test_anomaly_detection_quality():
    """
    Check that injected anomalous shifts rank higher than normal ones.
    Not a strict precision test — just sanity-checks direction.
    """
    print(">>  test_anomaly_detection_quality ... ", end="")
    df = make_synthetic_shifts(n_normal=200, n_anomalous=20, seed=7)
    df_feat, feat_cols = engineer_features(df)

    detector = ShiftAnomalyDetector(contamination=0.10)
    detector.fit(df_feat, feat_cols)
    results = detector.predict(df_feat, feat_cols)

    # Merge ground truth labels back
    results = results.merge(
        df[["shift_date","shift","line","incharge","_label"]].assign(
            shift_date=pd.to_datetime(df["shift_date"])
        ),
        on=["shift_date","shift","line","incharge"],
        how="left"
    )

    mean_anomaly_score  = results[results["_label"] == "anomaly"]["anomaly_score"].mean()
    mean_normal_score   = results[results["_label"] == "normal"]["anomaly_score"].mean()

    assert mean_anomaly_score > mean_normal_score, (
        f"Anomalous shifts should score higher on average "
        f"({mean_anomaly_score:.3f} vs {mean_normal_score:.3f})"
    )
    print(f"PASS  (anomaly mean={mean_anomaly_score:.3f}, normal mean={mean_normal_score:.3f})")


def test_save_load():
    print(">>  test_save_load ... ", end="")
    df = make_synthetic_shifts()
    df_feat, feat_cols = engineer_features(df)

    detector = ShiftAnomalyDetector()
    detector.fit(df_feat, feat_cols)
    detector.save()

    loaded   = ShiftAnomalyDetector.load()
    results  = loaded.predict(df_feat, feat_cols)
    assert len(results) == len(df)
    print("PASS")


def test_retrain_metrics():
    print(">>  test_retrain_metrics ... ", end="")
    df = make_synthetic_shifts()
    df_feat, feat_cols = engineer_features(df)

    detector = ShiftAnomalyDetector(contamination=0.05)
    metrics  = detector.retrain(df_feat, feat_cols)

    assert "n_samples"        in metrics
    assert "anomaly_fraction" in metrics
    assert 0 < metrics["anomaly_fraction"] < 1
    print("PASS")


# ── example output printer ────────────────────────────────────────────────────

def print_example_output():
    print("\n-- Example anomaly report --------------------------------------")
    df = make_synthetic_shifts(n_normal=100, n_anomalous=10)
    df_feat, feat_cols = engineer_features(df)

    detector = ShiftAnomalyDetector(contamination=0.08)
    detector.fit(df_feat, feat_cols)
    results = detector.predict(df_feat, feat_cols)

    top10 = results.head(10)
    for _, row in top10.iterrows():
        flag = "!!" if row["is_anomaly"] else "  "
        print(
            f"{flag} {row['shift_date'].date()}  {row['shift']}  "
            f"{row['line']:<10}  {row['incharge']:<8}  "
            f"score={row['anomaly_score']:.3f}  "
            f"drivers={row['top_drivers']}"
        )


if __name__ == "__main__":
    test_feature_engineering()
    test_fit_predict()
    test_anomaly_detection_quality()
    test_save_load()
    test_retrain_metrics()
    print("\n[OK]  All tests passed.")
    print_example_output()
