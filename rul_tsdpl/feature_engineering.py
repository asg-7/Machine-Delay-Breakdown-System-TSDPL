"""
TSDPL — RUL Feature Engineering  (v2 — shift-level)
=====================================================
Input  : raw Excel/CSV rows parsed from the three machine line reports.
Output : feature matrix with target `rul_days` (days to next failure)
         computed for EVERY shift, not just breakdown events.

Key changes from v1:
  1. Shift-level targets (every shift gets a rul_days, not just breakdowns)
  2. Expanded breakdown keywords (+FAILURE, REPAIR, FAULT, TRIP)
  3. 6 new features: breakdown_streak, delay_acceleration, availability_trend,
     tonnage_efficiency, time_since_maintenance, breakdown_severity_avg
  4. risk_class column for classification (IMMINENT / SOON / SAFE)
"""

import pandas as pd
import numpy as np
from pathlib import Path


# ──────────────────────────────────────────────
# 1. LOAD & CLEAN
# ──────────────────────────────────────────────

def load_raw(filepath: str) -> pd.DataFrame:
    """Load one of the three line Excel files."""
    df = pd.read_excel(filepath, header=1)

    # Normalise column names (mirrors your filters.js normalization)
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"\s+", "_", regex=True)
    )

    # Forward-fill shift-level columns that span multiple delay rows
    shift_cols = ['date', 'shift', 'shift_incharge', 'team',
                  'tonnage', 'mt', 'coil', 'no_of_coil', 'machine', 'line']
    for col in shift_cols:
        if col in df.columns:
            df[col] = df[col].ffill()

    # Parse dates — handle messy Excel serial numbers too
    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df = df.dropna(subset=["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # ── Map delay_type from whichever column the file uses ──
    if 'reason_for_delay' in df.columns:
        df['delay_type'] = df['description'].fillna('')
    elif 'reason' in df.columns:
        df['delay_type'] = df['reason'].fillna('')
    elif 'unnamed:_11' in df.columns:
        df['delay_type'] = df['unnamed:_11'].fillna('')
    elif 'description' in df.columns:
        df['delay_type'] = df['description'].fillna('')
    else:
        df['delay_type'] = ''

    # ── Map delay_min ──
    if 'time' in df.columns:
        df['delay_min'] = pd.to_numeric(df['time'], errors='coerce').fillna(0)
    elif 'delay_time' in df.columns:
        df['delay_min'] = pd.to_numeric(df['delay_time'], errors='coerce').fillna(0)
    else:
        df['delay_min'] = 0.0

    # ── Map tonnage ──
    if 'tonnage' in df.columns:
        df['tonnage'] = pd.to_numeric(df['tonnage'], errors='coerce').fillna(0)
    elif 'mt' in df.columns:
        df['tonnage'] = pd.to_numeric(df['mt'], errors='coerce').fillna(0)
    else:
        df['tonnage'] = 0.0

    # ── Compute availability per shift (480 min = 8-hour shift) ──
    shift_totals = df.groupby(['date', 'shift'])['delay_min'].sum().reset_index()
    shift_totals['availability'] = ((480 - shift_totals['delay_min']) / 480 * 100).clip(0, 100)
    df = df.merge(shift_totals[['date', 'shift', 'availability']],
                  on=['date', 'shift'], how='left', suffixes=('', '_calc'))
    if 'availability_calc' in df.columns:
        df['availability'] = df['availability_calc']
        df.drop(columns=['availability_calc'], inplace=True)

    return df


# ──────────────────────────────────────────────
# 2. IDENTIFY BREAKDOWN EVENTS
# ──────────────────────────────────────────────

# Expanded keyword list (v2 addition)
BREAKDOWN_TYPES = {
    "MECH", "ELEC", "HYD",
    "MECHANICAL", "ELECTRICAL", "HYDRAULIC",
    "BREAKDOWN", "FAILURE", "REPAIR", "FAULT", "TRIP",
}


def is_breakdown(row) -> bool:
    """True if this delay row represents an unplanned failure."""
    dtype = str(row.get("delay_type", "")).upper().strip()
    return any(bt in dtype for bt in BREAKDOWN_TYPES)


def _get_breakdown_dates(df: pd.DataFrame, machine: str) -> pd.Series:
    """Return sorted unique dates with breakdown events for a machine."""
    mdf = df[df["machine"].str.upper().str.strip() == machine.upper()].copy()
    bd = mdf[mdf.apply(is_breakdown, axis=1)]
    if bd.empty:
        return pd.Series(dtype="datetime64[ns]")
    return bd["date"].drop_duplicates().sort_values().reset_index(drop=True)


# ──────────────────────────────────────────────
# 3. SHIFT-LEVEL AGGREGATION
# ──────────────────────────────────────────────

def _aggregate_shifts(df: pd.DataFrame, machine: str) -> pd.DataFrame:
    """
    Aggregate raw delay rows into one row per shift-date for a machine.
    Each row summarises: total delay, tonnage, availability, breakdown flag, etc.
    """
    mdf = df[df["machine"].str.upper().str.strip() == machine.upper()].copy()
    if mdf.empty:
        return pd.DataFrame()

    # Per-shift aggregation
    agg = mdf.groupby(["date", "shift"]).agg(
        total_delay_min=("delay_min", "sum"),
        tonnage=("tonnage", "first"),         # tonnage is shift-level
        availability=("availability", "first"),
        n_delay_events=("delay_min", "count"),
        delay_types=("delay_type", lambda x: "|".join(x.astype(str).unique())),
        has_breakdown=("delay_type", lambda x: any(
            any(bt in str(v).upper() for bt in BREAKDOWN_TYPES) for v in x
        )),
        breakdown_delay_min=("delay_min", lambda x: x[
            mdf.loc[x.index].apply(is_breakdown, axis=1)
        ].sum() if len(x) > 0 else 0),
    ).reset_index()

    agg["machine"] = machine
    agg = agg.sort_values("date").reset_index(drop=True)
    return agg


# ──────────────────────────────────────────────
# 4. COMPUTE RUL TARGET (shift-level)
# ──────────────────────────────────────────────

def _compute_shift_rul(shifts: pd.DataFrame, bd_dates: pd.Series) -> pd.DataFrame:
    """
    For each shift, compute rul_days = days until the NEXT breakdown.
    Shifts after the last known breakdown get NaN (dropped later).
    """
    if bd_dates.empty or shifts.empty:
        return pd.DataFrame()

    bd_dates_arr = bd_dates.values  # numpy datetime64 array

    rul_values = []
    for _, row in shifts.iterrows():
        shift_date = row["date"]
        # Find next breakdown date strictly AFTER this shift date
        future_bds = bd_dates_arr[bd_dates_arr > shift_date]
        if len(future_bds) > 0:
            next_bd = pd.Timestamp(future_bds[0])
            rul = (next_bd - shift_date).total_seconds() / 86400.0
            rul_values.append(max(rul, 0.0))
        else:
            rul_values.append(np.nan)  # no future breakdown known

    shifts = shifts.copy()
    shifts["rul_days"] = rul_values
    return shifts


# ──────────────────────────────────────────────
# 5. ENGINEER FEATURES (v2 — enriched)
# ──────────────────────────────────────────────

def build_features(shifts: pd.DataFrame, all_shifts_raw: pd.DataFrame) -> pd.DataFrame:
    """
    For each shift row, compute a rich feature vector from
    the history BEFORE that shift.

    Features (19 total):
        Original (13): mtbf_days, mtbf_std, mtbf_trend, mttr_min,
            days_since_last_bd, bd_freq_30d, avg_avail_7d, avg_avail_30d,
            avg_tonnage_7d, delay_min_7d, delay_min_30d, delay_diversity, machine_id
        New (6): breakdown_streak, delay_acceleration, availability_trend,
            tonnage_efficiency, time_since_maintenance, breakdown_severity_avg
    """
    rows = []
    machine = shifts["machine"].iloc[0] if len(shifts) > 0 else ""

    # Sort by date
    shifts_sorted = shifts.sort_values("date").reset_index(drop=True)

    for idx, shift in shifts_sorted.iterrows():
        evt_date = shift["date"]

        # History = all aggregated shifts BEFORE this one
        hist = shifts_sorted[shifts_sorted["date"] < evt_date]
        if len(hist) < 2:
            continue  # need some history to compute features

        # ── Rolling windows ────────────────────────────────
        w7 = hist[hist["date"] >= evt_date - pd.Timedelta(days=7)]
        w30 = hist[hist["date"] >= evt_date - pd.Timedelta(days=30)]

        # ── Breakdown sub-history ──────────────────────────
        bd_hist = hist[hist["has_breakdown"] == True]

        # MTBF: mean days between past breakdowns
        if len(bd_hist) >= 2:
            bd_dates = bd_hist["date"].sort_values()
            intervals = bd_dates.diff().dt.total_seconds().dropna() / 86400
            mtbf = intervals.mean()
            mtbf_std = intervals.std() if len(intervals) > 1 else 0.0
            mtbf_trend = intervals.iloc[-1] - intervals.iloc[0] if len(intervals) > 1 else 0.0
        else:
            mtbf = mtbf_std = mtbf_trend = 0.0

        # MTTR: mean repair duration (proxy = breakdown_delay_min)
        mttr = bd_hist["breakdown_delay_min"].mean() if len(bd_hist) > 0 else 0.0

        # Days since last breakdown
        days_since_last_bd = (
            (evt_date - bd_hist["date"].max()).total_seconds() / 86400
            if len(bd_hist) > 0 else 90.0  # cap at 90 days instead of 999
        )

        # Breakdown frequency per 30 days
        bd_freq_30d = len(bd_hist[bd_hist["date"] >= evt_date - pd.Timedelta(days=30)])

        # ── Production health features ─────────────────────
        avg_avail_7d = w7["availability"].mean() if len(w7) > 0 else 100.0
        avg_avail_30d = w30["availability"].mean() if len(w30) > 0 else 100.0
        avg_tonnage_7d = w7["tonnage"].mean() if len(w7) > 0 else 0.0

        # Total delay minutes in last 7 / 30 days
        delay_7d = w7["total_delay_min"].sum()
        delay_30d = w30["total_delay_min"].sum()

        # Delay type diversity (unique types in last 30 days)
        if len(w30) > 0:
            all_types = "|".join(w30["delay_types"].astype(str))
            delay_diversity = len(set(t.strip() for t in all_types.split("|") if t.strip()))
        else:
            delay_diversity = 0

        # Machine encoding
        machine_enc = {"WCTL-1": 0, "WCTL-2": 1, "SLITTER": 2}.get(machine.upper(), -1)

        # ══════════════════════════════════════════════════
        # NEW FEATURES (v2)
        # ══════════════════════════════════════════════════

        # 1. Breakdown streak: consecutive days with breakdowns ending at today
        breakdown_streak = 0
        if len(hist) > 0:
            recent = hist.sort_values("date", ascending=False)
            for _, r in recent.iterrows():
                if r["has_breakdown"]:
                    breakdown_streak += 1
                else:
                    break

        # 2. Delay acceleration: (avg delay last 7d) / (avg delay last 30d) ratio
        avg_delay_7d = w7["total_delay_min"].mean() if len(w7) > 0 else 0.0
        avg_delay_30d = w30["total_delay_min"].mean() if len(w30) > 0 else 1.0
        delay_acceleration = avg_delay_7d / max(avg_delay_30d, 1.0)

        # 3. Availability trend: slope of daily availability over last 7 days
        if len(w7) >= 2:
            avail_vals = w7.sort_values("date")["availability"].values
            x = np.arange(len(avail_vals))
            if np.std(x) > 0:
                availability_trend = float(np.polyfit(x, avail_vals, 1)[0])
            else:
                availability_trend = 0.0
        else:
            availability_trend = 0.0

        # 4. Tonnage efficiency: current vs historical mean
        hist_tonnage_mean = hist["tonnage"].mean() if len(hist) > 0 else 1.0
        tonnage_efficiency = shift["tonnage"] / max(hist_tonnage_mean, 1.0)

        # 5. Time since last maintenance (planned/setup delay)
        maintenance_hist = hist[
            hist["delay_types"].str.upper().str.contains(
                "SETUP|PLANNED|MAINTENANCE|PREVENTIVE", na=False
            )
        ]
        time_since_maintenance = (
            (evt_date - maintenance_hist["date"].max()).total_seconds() / 86400
            if len(maintenance_hist) > 0 else 30.0
        )

        # 6. Breakdown severity average: avg duration of breakdowns in last 30d
        bd_30d = bd_hist[bd_hist["date"] >= evt_date - pd.Timedelta(days=30)]
        breakdown_severity_avg = bd_30d["breakdown_delay_min"].mean() if len(bd_30d) > 0 else 0.0

        rows.append({
            # ── Original features ──
            "mtbf_days":            round(mtbf, 2),
            "mtbf_std":             round(mtbf_std, 2),
            "mtbf_trend":           round(mtbf_trend, 2),
            "mttr_min":             round(mttr, 2),
            "days_since_last_bd":   round(days_since_last_bd, 2),
            "bd_freq_30d":          bd_freq_30d,
            "avg_avail_7d":         round(avg_avail_7d, 2),
            "avg_avail_30d":        round(avg_avail_30d, 2),
            "avg_tonnage_7d":       round(avg_tonnage_7d, 2),
            "delay_min_7d":         round(delay_7d, 2),
            "delay_min_30d":        round(delay_30d, 2),
            "delay_diversity":      delay_diversity,
            "machine_id":           machine_enc,
            # ── New features (v2) ──
            "breakdown_streak":     breakdown_streak,
            "delay_acceleration":   round(delay_acceleration, 3),
            "availability_trend":   round(availability_trend, 3),
            "tonnage_efficiency":   round(tonnage_efficiency, 3),
            "time_since_maintenance": round(time_since_maintenance, 2),
            "breakdown_severity_avg": round(breakdown_severity_avg, 2),
            # ── Target ──
            "rul_days":             shift["rul_days"],
        })

    return pd.DataFrame(rows)


# ──────────────────────────────────────────────
# 6. RISK CLASS LABELLING
# ──────────────────────────────────────────────

def add_risk_class(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a risk classification column for the dual-model approach.
    IMMINENT : rul_days <= 1   (breakdown within 1 day)
    SOON     : 1 < rul_days <= 3
    SAFE     : rul_days > 3
    """
    df = df.copy()
    conditions = [
        df["rul_days"] <= 1,
        df["rul_days"] <= 3,
    ]
    choices = ["IMMINENT", "SOON"]
    df["risk_class"] = np.select(conditions, choices, default="SAFE")
    return df


# ──────────────────────────────────────────────
# 7. COMBINE ALL THREE LINES
# ──────────────────────────────────────────────

def build_full_dataset(data_dir: str) -> pd.DataFrame:
    """
    Load WCTL-1, WCTL-2, SLITTER files and return one combined feature DataFrame
    with shift-level RUL targets and risk class labels.
    """
    files = {
        "WCTL-1":   "WCTL-1 DELAY REPORT MAY-26.xlsx",
        "WCTL-2":   "WCTL-2 DELAY FEB-2026.xlsx",
        "SLITTER":  "SLITDELAY REPOERT MAR-2026.xlsx",
    }

    all_feats = []

    for machine, fname in files.items():
        fpath = Path(data_dir) / fname
        if not fpath.exists():
            print(f"[WARN] {fpath} not found — skipping {machine}")
            continue

        # Load raw data
        df = load_raw(str(fpath))
        df["machine"] = machine

        # Get breakdown dates for this machine
        bd_dates = _get_breakdown_dates(df, machine)
        if bd_dates.empty:
            print(f"[WARN] No breakdown events for {machine}")
            continue

        # Aggregate to shift level
        shifts = _aggregate_shifts(df, machine)
        if shifts.empty:
            print(f"[WARN] No shifts found for {machine}")
            continue

        # Compute shift-level RUL targets
        shifts = _compute_shift_rul(shifts, bd_dates)
        shifts = shifts.dropna(subset=["rul_days"])
        shifts = shifts[shifts["rul_days"] > 0]

        if shifts.empty:
            print(f"[WARN] No valid RUL targets for {machine}")
            continue

        print(f"  {machine}: {len(shifts)} shifts with valid RUL targets")

        # Engineer features
        feat = build_features(shifts, df)
        all_feats.append(feat)

    if not all_feats:
        raise ValueError("No valid shift-level data found across any machine file.")

    combined = pd.concat(all_feats, ignore_index=True)
    combined = combined.dropna()

    # Add risk classification
    combined = add_risk_class(combined)

    print(f"\nCombined dataset: {combined.shape[0]} samples, {combined.shape[1]} columns")
    print(f"Risk class distribution:\n{combined['risk_class'].value_counts().to_string()}")
    print(f"RUL target stats:\n{combined['rul_days'].describe().to_string()}")

    return combined


if __name__ == "__main__":
    # Quick test — point at your sampledata/ folder
    dataset = build_full_dataset("../sampledata")
    print(f"\nDataset shape: {dataset.shape}")
    print(dataset.describe())
    dataset.to_csv("rul_features_v2.csv", index=False)
    print("\nSaved -> rul_features_v2.csv")
