"""
TSDPL — FastAPI RUL Prediction Server
======================================
Endpoints:
  POST /predict          → RUL prediction for a single machine's current state
  GET  /model-info       → training metadata (feature importances, CV scores)
  GET  /health           → liveness check

Run (dev):
    uvicorn api:app --reload --port 8000

Install:
    pip install fastapi uvicorn scikit-learn pandas openpyxl
"""

import json
import pickle
from pathlib import Path
from typing import Literal, List, Dict, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ──────────────────────────────────────────────
# LOAD MODEL AT STARTUP
# ──────────────────────────────────────────────

MODEL_PATH = Path(__file__).parent / "rul_model.pkl"
META_PATH  = Path(__file__).parent / "rul_model_meta.json"

if not MODEL_PATH.exists():
    raise RuntimeError("rul_model.pkl not found — run train.py first.")

with open(MODEL_PATH, "rb") as f:
    MODEL = pickle.load(f)

with open(META_PATH, "r") as f:
    META = json.load(f)

FEATURE_COLS = META["feature_cols"]

MACHINE_ENC = {"WCTL-1": 0, "WCTL-2": 1, "SLITTER": 2}

# ──────────────────────────────────────────────
# APP
# ──────────────────────────────────────────────

app = FastAPI(
    title="TSDPL RUL Prediction API",
    description="Remaining Useful Life regression for WCTL-1, WCTL-2, SLITTER",
    version="1.0.0",
)

# Allow requests from your frontend (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Mount anomaly detection module ────────────
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from anomaly_detector.api_router import router as anomaly_router
app.include_router(anomaly_router, prefix="/api/anomaly", tags=["anomaly"])


# ──────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    All values are computed client-side from AppState before sending.
    Your existing analytics.js already calculates most of these.
    """
    machine: Literal["WCTL-1", "WCTL-2", "SLITTER"]

    # From your maintenance analytics
    mtbf_days:          float = Field(..., description="Mean time between failures (days)")
    mtbf_std:           float = Field(0.0,  description="Std dev of MTBF intervals")
    mtbf_trend:         float = Field(0.0,  description="Last interval minus first (negative = worsening)")
    mttr_min:           float = Field(..., description="Mean time to repair (minutes)")
    days_since_last_bd: float = Field(..., description="Days since most recent breakdown")
    bd_freq_30d:        int   = Field(..., description="Breakdown count in last 30 days")

    # From your availability / production analytics
    avg_avail_7d:    float = Field(..., description="Mean availability % last 7 days")
    avg_avail_30d:   float = Field(..., description="Mean availability % last 30 days")
    avg_tonnage_7d:  float = Field(..., description="Mean tonnage per shift last 7 days")
    delay_min_7d:    float = Field(..., description="Total delay minutes last 7 days")
    delay_min_30d:   float = Field(..., description="Total delay minutes last 30 days")
    delay_diversity: int   = Field(..., description="Unique delay types in last 30 days")


class PredictResponse(BaseModel):
    machine:       str
    rul_days:      float   # predicted days to next breakdown
    risk_band:     str     # RED / AMBER / GREEN
    risk_score:    int     # 0–100 (100 = imminent failure)
    confidence:    str     # LOW / MEDIUM / HIGH based on training data proximity
    advice:        str     # auto-generated maintenance recommendation
    feature_contributions: dict  # top 3 features driving this prediction


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def compute_risk_band(rul: float, mtbf: float) -> tuple[str, int]:
    """Convert RUL days to a risk band using MTBF as the scale."""
    if mtbf <= 0:
        mtbf = max(rul, 1.0)

    ratio = rul / mtbf  # 1.0 = right on average; <0.5 = trouble

    if   ratio < 0.35:  return "RED",   min(100, int(100 - ratio * 100))
    elif ratio < 0.70:  return "AMBER", int(70  - ratio * 40)
    else:               return "GREEN", max(0,  int(40  - ratio * 20))


def build_advice(rul: float, band: str, req: PredictRequest) -> str:
    machine = req.machine
    if band == "RED":
        return (
            f"⚠ URGENT — {machine} predicted to fail in ~{rul:.0f} days. "
            f"Schedule immediate inspection. MTTR is {req.mttr_min:.0f} min; "
            f"prepare spare parts and maintenance crew now."
        )
    elif band == "AMBER":
        return (
            f"⚡ CAUTION — {machine} showing wear signals. "
            f"Plan preventive maintenance within {rul:.0f} days. "
            f"Availability has dropped to {req.avg_avail_7d:.1f}% (7-day avg)."
        )
    else:
        return (
            f"✓ {machine} is healthy. Next predicted failure in ~{rul:.0f} days. "
            f"Continue standard maintenance schedule."
        )


def top_feature_contributions(feature_vector: list) -> dict:
    """
    Approximate per-feature contribution using the model's
    feature importances × normalised feature values.
    Simple and interview-explainable without needing SHAP.
    """
    importances = MODEL.feature_importances_
    fv = np.array(feature_vector)

    # Normalise to 0-1 range (rough)
    contrib = importances * np.abs(fv / (np.abs(fv).max() + 1e-9))
    top_idx = contrib.argsort()[::-1][:3]

    return {
        FEATURE_COLS[i]: round(float(contrib[i]), 4)
        for i in top_idx
    }


# ──────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": "GradientBoostingRegressor", "version": "1.0.0"}


@app.get("/model-info")
def model_info():
    """Return training metadata — shown on your ML dashboard page."""
    return META


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    machine_enc = MACHINE_ENC.get(req.machine, -1)
    if machine_enc == -1:
        raise HTTPException(400, f"Unknown machine: {req.machine}")

    feature_vector = [
        req.mtbf_days,
        req.mtbf_std,
        req.mtbf_trend,
        req.mttr_min,
        req.days_since_last_bd,
        req.bd_freq_30d,
        req.avg_avail_7d,
        req.avg_avail_30d,
        req.avg_tonnage_7d,
        req.delay_min_7d,
        req.delay_min_30d,
        req.delay_diversity,
        machine_enc,
    ]

    rul = float(MODEL.predict([feature_vector])[0])
    rul = max(0.5, round(rul, 1))   # floor at half a day

    band, score = compute_risk_band(rul, req.mtbf_days)

    # Confidence: based on how close training data covers this machine
    n_train  = META["n_training_rows"]
    confidence = "HIGH" if n_train >= 30 else ("MEDIUM" if n_train >= 10 else "LOW")

    return PredictResponse(
        machine       = req.machine,
        rul_days      = rul,
        risk_band     = band,
        risk_score    = score,
        confidence    = confidence,
        advice        = build_advice(rul, band, req),
        feature_contributions = top_feature_contributions(feature_vector),
    )


# ──────────────────────────────────────────────
# PERSISTENCE ENDPOINTS
# ──────────────────────────────────────────────

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploaded_data"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/upload-data")
def upload_data(machine: str, data: List[Dict[str, Any]]):
    if machine not in ["SLITTER", "WCTL-1", "WCTL-2"]:
        raise HTTPException(status_code=400, detail="Invalid machine name")
    
    file_path = UPLOAD_DIR / f"{machine}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "ok", "message": f"Data for {machine} saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save data: {e}")

@app.get("/api/get-data")
def get_data():
    all_shifts = []
    machines = ["SLITTER", "WCTL-1", "WCTL-2"]
    for m in machines:
        file_path = UPLOAD_DIR / f"{m}.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    shifts = json.load(f)
                    if isinstance(shifts, list):
                        all_shifts.extend(shifts)
            except Exception as e:
                print(f"Error reading {m}.json: {e}")
    return all_shifts

@app.post("/api/operator-log")
def operator_log(log_entry: Dict[str, Any]):
    file_path = UPLOAD_DIR / "operator_logs.json"
    logs = []
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                logs = json.load(f)
                if not isinstance(logs, list):
                    logs = []
        except Exception as e:
            print(f"Error reading operator_logs.json: {e}")
            logs = []
    
    logs.append(log_entry)
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
        return {"status": "ok", "message": "Operator log saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save operator log: {e}")

@app.get("/api/operator-logs")
def get_operator_logs():
    file_path = UPLOAD_DIR / "operator_logs.json"
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                logs = json.load(f)
                if isinstance(logs, list):
                    return logs
        except Exception as e:
            print(f"Error reading operator_logs.json: {e}")
    return []
