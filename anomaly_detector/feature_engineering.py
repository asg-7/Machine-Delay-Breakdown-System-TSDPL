"""
feature_engineering.py
-----------------------
Transforms raw TSDPL shift production data into ML-ready features
for anomaly detection.

Expected input schema (matches your existing parser.js columns):
    - shift_date        : date string
    - shift             : "A" | "B" | "C"
    - line              : e.g. "WCTL-1", "WCTL-2", "SLITTER"
    - incharge          : operator name / ID
    - production_tonnes : float — actual output this shift
    - available_hours   : float — scheduled run time
    - delay_minutes     : float — total downtime minutes
    - breakdown_count   : int   — number of breakdown events
    - delay_breakdown   : float — minutes specifically from breakdowns
    - delay_planned     : float — minutes from planned stops
    - delay_other       : float — minutes from other causes
    - target_tonnes     : float — planned production target
"""

import pandas as pd
import numpy as np
from typing import Optional


# ── helpers ──────────────────────────────────────────────────────────────────

def _safe_div(a: pd.Series, b: pd.Series, fill: float = 0.0) -> pd.Series:
    """Divide two series, replacing zeros/NaN in denominator with fill."""
    return np.where(b == 0, fill, a / b)


# ── core feature builder ──────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a raw shift DataFrame and returns a new DataFrame with all
    engineered features ready for the Isolation Forest.

    Returns only the feature columns — original columns are dropped so
    the scaler / model never accidentally sees raw identifiers.
    """
    df = df.copy()

    # ── 1. Date / time decomposition ────────────────────────────────────────
    df["shift_date"] = pd.to_datetime(df["shift_date"])
    df["day_of_week"]    = df["shift_date"].dt.dayofweek          # 0=Mon … 6=Sun
    df["week_of_year"]   = df["shift_date"].dt.isocalendar().week.astype(int)
    df["month"]          = df["shift_date"].dt.month
    # Cyclical encoding so Monday ↔ Sunday are "close" in feature space
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)
    df["shift_enc"] = df["shift"].map({"A": 0, "B": 1, "C": 2}).fillna(0)

    # ── 2. Productivity ratios ───────────────────────────────────────────────
    # Availability: fraction of shift that was actually running
    df["availability"]   = _safe_div(
        df["available_hours"] * 60 - df["delay_minutes"],
        df["available_hours"] * 60,
        fill=0.0
    ).clip(0, 1)

    # Efficiency: actual vs target
    df["efficiency"]     = _safe_div(df["production_tonnes"], df["target_tonnes"], fill=0.0)

    # Tonnes per available hour (raw throughput rate)
    df["tph"]            = _safe_div(df["production_tonnes"], df["available_hours"], fill=0.0)

    # ── 3. Delay composition ratios ─────────────────────────────────────────
    total_delay = df["delay_minutes"].replace(0, np.nan)  # avoid /0 below

    df["delay_ratio"]        = df["delay_minutes"] / (df["available_hours"] * 60)
    df["breakdown_ratio"]    = df["delay_breakdown"] / total_delay.fillna(1)
    df["planned_ratio"]      = df["delay_planned"]   / total_delay.fillna(1)
    df["other_delay_ratio"]  = df["delay_other"]     / total_delay.fillna(1)

    # Average minutes lost per breakdown event
    df["avg_breakdown_dur"]  = _safe_div(df["delay_breakdown"], df["breakdown_count"], fill=0.0)

    # ── 4. Rolling window features (per line) ────────────────────────────────
    # Sort once so rolling is chronological per line
    df = df.sort_values(["line", "shift_date", "shift_enc"]).reset_index(drop=True)

    for col, alias in [
        ("production_tonnes", "prod"),
        ("delay_minutes",     "delay"),
        ("availability",      "avail"),
        ("breakdown_count",   "bkd"),
    ]:
        grp = df.groupby("line")[col]

        df[f"{alias}_roll3_mean"] = grp.transform(lambda s: s.rolling(3, min_periods=1).mean())
        df[f"{alias}_roll3_std"]  = grp.transform(lambda s: s.rolling(3, min_periods=1).std().fillna(0))
        df[f"{alias}_roll7_mean"] = grp.transform(lambda s: s.rolling(7, min_periods=1).mean())

        # Deviation from own rolling mean (z-score style, bounded)
        roll_std = df[f"{alias}_roll3_std"].replace(0, 1)
        df[f"{alias}_dev_from_mean"] = (df[col] - df[f"{alias}_roll3_mean"]) / roll_std

    # ── 5. Incharge performance baseline ────────────────────────────────────
    # How does this shift compare to this incharge's historical median?
    incharge_med = df.groupby("incharge")["production_tonnes"].transform("median")
    incharge_std = df.groupby("incharge")["production_tonnes"].transform("std").fillna(1).replace(0, 1)
    df["incharge_prod_zscore"] = (df["production_tonnes"] - incharge_med) / incharge_std

    incharge_delay_med = df.groupby("incharge")["delay_minutes"].transform("median")
    incharge_delay_std = df.groupby("incharge")["delay_minutes"].transform("std").fillna(1).replace(0, 1)
    df["incharge_delay_zscore"] = (df["delay_minutes"] - incharge_delay_med) / incharge_delay_std

    # ── 6. Select final feature columns ─────────────────────────────────────
    FEATURE_COLS = [
        # Time
        "dow_sin", "dow_cos", "shift_enc", "month",
        # Productivity
        "availability", "efficiency", "tph",
        # Delay breakdown
        "delay_ratio", "breakdown_ratio", "planned_ratio", "other_delay_ratio",
        "avg_breakdown_dur", "breakdown_count",
        # Rolling
        "prod_roll3_mean", "prod_roll3_std", "prod_roll7_mean", "prod_dev_from_mean",
        "delay_roll3_mean", "delay_roll3_std", "delay_dev_from_mean",
        "avail_roll3_mean", "avail_dev_from_mean",
        "bkd_roll3_mean", "bkd_dev_from_mean",
        # Incharge
        "incharge_prod_zscore", "incharge_delay_zscore",
    ]

    # Return feature matrix alongside identifying metadata for result display
    meta_cols = ["shift_date", "shift", "line", "incharge"]
    return df[meta_cols + FEATURE_COLS], FEATURE_COLS
