"""
TSDPL — RUL Feature Engineering
================================
Input  : raw Excel/CSV rows parsed from your existing SheetJS upload
         (replicated here as a pandas DataFrame for the Python backend)
Output : feature matrix X and target vector y (days_to_next_failure)

Column assumptions from your README schema:
  date          : breakdown/event date  (string or datetime)
  machine       : WCTL-1 | WCTL-2 | SLITTER
  delay_type    : MECH | ELEC | PROCESS | PLANNED | etc.
  delay_min     : total delay duration in minutes
  shift         : A | B | C
  incharge      : supervisor name
  tonnage       : tonnes produced that shift
  availability  : float 0–100
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
    # WCTL-1: has 'reason_for_delay' col, delay description is in 'description'
    # WCTL-2: delay description lands in 'unnamed:_11'
    # SLITTER: delay description is in 'reason'
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

BREAKDOWN_TYPES = {"MECH", "ELEC", "HYD", "MECHANICAL", "ELECTRICAL", "HYDRAULIC", "BREAKDOWN"}

def is_breakdown(row) -> bool:
    """True if this delay row represents an unplanned mechanical failure."""
    dtype = str(row.get("delay_type", "")).upper().strip()
    return any(bt in dtype for bt in BREAKDOWN_TYPES)


def extract_breakdown_events(df: pd.DataFrame, machine: str) -> pd.DataFrame:
    """
    Returns a DataFrame of breakdown events for one machine,
    with 'days_to_next_failure' (RUL target) computed.
    """
    mdf = df[df["machine"].str.upper().str.strip() == machine.upper()].copy()
    bd  = mdf[mdf.apply(is_breakdown, axis=1)].copy()

    if len(bd) < 2:
        return pd.DataFrame()   # need at least 2 breakdowns to compute RUL

    bd = bd.sort_values("date").reset_index(drop=True)

    # RUL = days until NEXT breakdown from current breakdown date
    bd["next_failure_date"] = bd["date"].shift(-1)
    bd["days_to_next_failure"] = (
        (bd["next_failure_date"] - bd["date"]).dt.total_seconds() / 86400
    ).round(2)

    # Drop last row (no "next" failure known)
    bd = bd.dropna(subset=["days_to_next_failure"])
    bd = bd[bd["days_to_next_failure"] > 0]

    bd["machine_id"] = machine
    return bd


# ──────────────────────────────────────────────
# 3. ENGINEER FEATURES
# ──────────────────────────────────────────────

def build_features(df: pd.DataFrame, bd_events: pd.DataFrame) -> pd.DataFrame:
    """
    For each breakdown event, compute a feature vector from
    the history window BEFORE that event.
    """
    rows = []

    for _, event in bd_events.iterrows():
        machine  = event["machine_id"]
        evt_date = event["date"]

        # History = all rows for this machine BEFORE this breakdown
        hist = df[
            (df["machine"].str.upper().str.strip() == machine.upper()) &
            (df["date"] < evt_date)
        ].copy()

        if len(hist) == 0:
            continue

        # ── Rolling windows ────────────────────────────────────
        w7  = hist[hist["date"] >= evt_date - pd.Timedelta(days=7)]
        w30 = hist[hist["date"] >= evt_date - pd.Timedelta(days=30)]

        # ── Breakdown sub-history ──────────────────────────────
        bd_hist = hist[hist.apply(is_breakdown, axis=1)]

        # MTBF: mean days between past breakdowns
        if len(bd_hist) >= 2:
            bd_dates = bd_hist["date"].sort_values()
            intervals = bd_dates.diff().dt.total_seconds().dropna() / 86400
            mtbf = intervals.mean()
            mtbf_std = intervals.std()
            mtbf_trend = intervals.iloc[-1] - intervals.iloc[0]  # shrinking = bad
        else:
            mtbf = mtbf_std = mtbf_trend = 0.0

        # MTTR: mean repair duration (proxy = delay_min for breakdown rows)
        mttr = bd_hist["delay_min"].mean() if len(bd_hist) > 0 else 0.0

        # Days since last breakdown
        days_since_last_bd = (
            (evt_date - bd_hist["date"].max()).total_seconds() / 86400
            if len(bd_hist) > 0 else 999.0
        )

        # Breakdown frequency per 30 days
        bd_freq_30d = len(bd_hist[bd_hist["date"] >= evt_date - pd.Timedelta(days=30)])

        # ── Production health features ─────────────────────────
        avg_avail_7d  = w7["availability"].mean()  if len(w7)  > 0 else 100.0
        avg_avail_30d = w30["availability"].mean() if len(w30) > 0 else 100.0
        avg_tonnage_7d = w7["tonnage"].mean()  if len(w7)  > 0 else 0.0

        # Total delay minutes in last 7 / 30 days
        delay_7d  = w7["delay_min"].sum()
        delay_30d = w30["delay_min"].sum()

        # Delay type diversity (number of unique types in last 30 days)
        delay_diversity = w30["delay_type"].nunique() if "delay_type" in w30 else 0

        # ── Machine encoding ───────────────────────────────────
        machine_enc = {"WCTL-1": 0, "WCTL-2": 1, "SLITTER": 2}.get(machine.upper(), -1)

        rows.append({
            # ── Features ──
            "mtbf_days":         round(mtbf, 2),
            "mtbf_std":          round(mtbf_std, 2),
            "mtbf_trend":        round(mtbf_trend, 2),
            "mttr_min":          round(mttr, 2),
            "days_since_last_bd": round(days_since_last_bd, 2),
            "bd_freq_30d":       bd_freq_30d,
            "avg_avail_7d":      round(avg_avail_7d, 2),
            "avg_avail_30d":     round(avg_avail_30d, 2),
            "avg_tonnage_7d":    round(avg_tonnage_7d, 2),
            "delay_min_7d":      round(delay_7d, 2),
            "delay_min_30d":     round(delay_30d, 2),
            "delay_diversity":   delay_diversity,
            "machine_id":        machine_enc,
            # ── Target ──
            "rul_days":          event["days_to_next_failure"],
        })

    return pd.DataFrame(rows)


# ──────────────────────────────────────────────
# 4. COMBINE ALL THREE LINES
# ──────────────────────────────────────────────

def build_full_dataset(data_dir: str) -> pd.DataFrame:
    """
    Load WCTL-1, WCTL-2, SLITTER files and return one combined feature DataFrame.
    Adjust filenames to match your sampledata/ folder.
    """
    files = {
        "WCTL-1":   "WCTL-1 DELAY REPORT MAY-26.xlsx",
        "WCTL-2":   "WCTL-2 DELAY FEB-2026.xlsx",
        "SLITTER":  "SLITDELAY REPOERT MAR-2026.xlsx",
    }

    all_dfs    = []
    all_feats  = []

    for machine, fname in files.items():
        fpath = Path(data_dir) / fname
        if not fpath.exists():
            print(f"[WARN] {fpath} not found — skipping {machine}")
            continue

        df  = load_raw(str(fpath))
        df["machine"] = machine          # ensure column exists
        bd  = extract_breakdown_events(df, machine)

        if bd.empty:
            print(f"[WARN] Not enough breakdown events for {machine}")
            continue

        feat = build_features(df, bd)
        all_feats.append(feat)

    if not all_feats:
        raise ValueError("No breakdown events found across any machine file.")

    combined = pd.concat(all_feats, ignore_index=True)
    combined = combined.dropna()
    return combined


if __name__ == "__main__":
    # Quick test — point at your sampledata/ folder
    dataset = build_full_dataset("../sampledata")
    print(f"\nDataset shape: {dataset.shape}")
    print(dataset.describe())
    dataset.to_csv("rul_features.csv", index=False)
    print("\nSaved -> rul_features.csv")
