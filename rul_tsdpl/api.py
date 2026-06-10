"""
TSDPL — FastAPI RUL Prediction Server  (v2 — Dual Model)
==========================================================
Endpoints:
  POST /predict          → RUL prediction with risk classification
  GET  /model-info       → training metadata (v2 with classification report)
  GET  /health           → liveness check

Persistence endpoints (unchanged):
  POST /api/upload-data  → store parsed shift data
  GET  /api/get-data     → retrieve all shift data
  POST /api/operator-log → save operator delay entry
  GET  /api/operator-logs → retrieve operator logs

Run (dev):
    uvicorn api:app --reload --port 8000

Install:
    pip install fastapi uvicorn scikit-learn pandas openpyxl imbalanced-learn
"""

import json
import pickle
from pathlib import Path
from typing import Literal, List, Dict, Any, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ──────────────────────────────────────────────
# LOAD MODELS AT STARTUP
# ──────────────────────────────────────────────

MODULE_DIR = Path(__file__).parent

# v2 model paths
CLASSIFIER_PATH = MODULE_DIR / "rul_classifier_v2.pkl"
REGRESSOR_PATH  = MODULE_DIR / "rul_regressor_v2.pkl"
META_V2_PATH    = MODULE_DIR / "rul_model_meta_v2.json"

# Legacy fallback
LEGACY_MODEL_PATH = MODULE_DIR / "rul_model.pkl"
LEGACY_META_PATH  = MODULE_DIR / "rul_model_meta.json"

# ── Load v2 models if available, else fall back to legacy ──
IS_V2 = False
CLASSIFIER = None
LABEL_ENCODER = None

if CLASSIFIER_PATH.exists() and REGRESSOR_PATH.exists():
    with open(CLASSIFIER_PATH, "rb") as f:
        clf_data = pickle.load(f)
        CLASSIFIER = clf_data["model"]
        LABEL_ENCODER = clf_data["label_encoder"]
    with open(REGRESSOR_PATH, "rb") as f:
        MODEL = pickle.load(f)
    IS_V2 = True
    print("[startup] Loaded v2 dual models (classifier + regressor)")
elif LEGACY_MODEL_PATH.exists():
    with open(LEGACY_MODEL_PATH, "rb") as f:
        MODEL = pickle.load(f)
    print("[startup] Loaded legacy GBR model")
else:
    raise RuntimeError("No model files found — run train.py first.")

# ── Load metadata ──
meta_path = META_V2_PATH if META_V2_PATH.exists() else LEGACY_META_PATH
if meta_path.exists():
    with open(meta_path, "r") as f:
        META = json.load(f)
else:
    META = {}

FEATURE_COLS = META.get("feature_cols", [])
MACHINE_ENC = {"WCTL-1": 0, "WCTL-2": 1, "SLITTER": 2}


# ──────────────────────────────────────────────
# APP
# ──────────────────────────────────────────────

app = FastAPI(
    title="TSDPL RUL Prediction API",
    description="Remaining Useful Life prediction with risk classification for WCTL-1, WCTL-2, SLITTER",
    version="2.0.0",
)

# Allow requests from your frontend (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Self-Ping Keep-Alive Daemon Thread ────────
import threading
import time
import urllib.request

def self_ping_worker():
    # Delay first ping to allow server startup
    time.sleep(30)
    url = "https://machine-delay-breakdown-system-tsdpl.onrender.com/health"
    while True:
        try:
            print(f"[keep-alive] Pinging self: {url}")
            req = urllib.request.Request(
                url, 
                headers={"User-Agent": "TSDPL-KeepAlive-Daemon/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                status = response.getcode()
                print(f"[keep-alive] Success, status code: {status}")
        except Exception as e:
            print(f"[keep-alive] Error pinging self: {e}")
        # 14 minutes = 840 seconds
        time.sleep(840)

@app.on_event("startup")
def start_self_ping():
    # Run as a daemon thread so it exits when the main process exits
    threading.Thread(target=self_ping_worker, daemon=True).start()


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
    v2 adds 6 new features.
    """
    machine: Literal["WCTL-1", "WCTL-2", "SLITTER"]

    # Original features
    mtbf_days:          float = Field(..., description="Mean time between failures (days)")
    mtbf_std:           float = Field(0.0,  description="Std dev of MTBF intervals")
    mtbf_trend:         float = Field(0.0,  description="Last interval minus first (negative = worsening)")
    mttr_min:           float = Field(..., description="Mean time to repair (minutes)")
    days_since_last_bd: float = Field(..., description="Days since most recent breakdown")
    bd_freq_30d:        int   = Field(..., description="Breakdown count in last 30 days")

    avg_avail_7d:    float = Field(..., description="Mean availability % last 7 days")
    avg_avail_30d:   float = Field(..., description="Mean availability % last 30 days")
    avg_tonnage_7d:  float = Field(..., description="Mean tonnage per shift last 7 days")
    delay_min_7d:    float = Field(..., description="Total delay minutes last 7 days")
    delay_min_30d:   float = Field(..., description="Total delay minutes last 30 days")
    delay_diversity: int   = Field(..., description="Unique delay types in last 30 days")

    # New v2 features (with defaults for backward compat)
    breakdown_streak:      int   = Field(0, description="Consecutive days with breakdowns")
    delay_acceleration:    float = Field(1.0, description="Ratio of 7d avg delay to 30d avg delay")
    availability_trend:    float = Field(0.0, description="Slope of daily availability over last 7 days")
    tonnage_efficiency:    float = Field(1.0, description="Current tonnage / historical mean")
    time_since_maintenance: float = Field(30.0, description="Days since last planned maintenance")
    breakdown_severity_avg: float = Field(0.0, description="Avg breakdown duration in last 30 days")


class PredictResponse(BaseModel):
    machine:            str
    rul_days:           float       # regression estimate (expm1 of log prediction)
    risk_class:         str         # IMMINENT / SOON / SAFE (from classifier)
    risk_probability:   Dict[str, float]  # per-class probabilities
    risk_band:          str         # RED / AMBER / GREEN
    risk_score:         int         # 0–100 (100 = imminent failure)
    confidence:         str         # LOW / MEDIUM / HIGH
    advice:             str
    feature_contributions: Dict[str, float]
    model_version:      str         # "1.0" or "2.0"


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def risk_class_to_band(risk_class: str) -> tuple:
    """Map classifier risk class to dashboard band and score."""
    if risk_class == "IMMINENT":
        return "RED", 90
    elif risk_class == "SOON":
        return "AMBER", 55
    else:
        return "GREEN", 15


def compute_risk_band_legacy(rul: float, mtbf: float) -> tuple:
    """Legacy: Convert RUL days to a risk band using MTBF as the scale."""
    if mtbf <= 0:
        mtbf = max(rul, 1.0)
    ratio = rul / mtbf
    if   ratio < 0.35:  return "RED",   min(100, int(100 - ratio * 100))
    elif ratio < 0.70:  return "AMBER", int(70  - ratio * 40)
    else:               return "GREEN", max(0,  int(40  - ratio * 20))


def build_advice(rul: float, band: str, risk_class: str, req: PredictRequest) -> str:
    machine = req.machine
    if band == "RED":
        return (
            f"⚠ URGENT — {machine} classified as {risk_class}. "
            f"Predicted failure in ~{rul:.0f} day(s). "
            f"Schedule immediate inspection. MTTR is {req.mttr_min:.0f} min; "
            f"prepare spare parts and maintenance crew now."
        )
    elif band == "AMBER":
        return (
            f"⚡ CAUTION — {machine} classified as {risk_class}. "
            f"Plan preventive maintenance within {rul:.0f} days. "
            f"Availability has dropped to {req.avg_avail_7d:.1f}% (7-day avg). "
            f"Breakdown streak: {req.breakdown_streak} days."
        )
    else:
        return (
            f"✓ {machine} is healthy (classified {risk_class}). "
            f"Next predicted failure in ~{rul:.0f} days. "
            f"Continue standard maintenance schedule."
        )


def top_feature_contributions(feature_vector: list, model) -> dict:
    """
    Per-feature contribution using the model's feature importances
    × normalised feature values.
    """
    importances = model.feature_importances_
    fv = np.array(feature_vector)

    # Check if importances are all zero (broken model)
    if importances.sum() == 0:
        return {FEATURE_COLS[i]: 0.0 for i in range(min(3, len(FEATURE_COLS)))}

    contrib = importances * np.abs(fv / (np.abs(fv).max() + 1e-9))
    top_idx = contrib.argsort()[::-1][:5]  # top 5 instead of 3

    return {
        FEATURE_COLS[i]: round(float(contrib[i]), 4)
        for i in top_idx
    }


# ──────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_version": "2.0" if IS_V2 else "1.0",
        "classifier": "GradientBoostingClassifier" if IS_V2 else "none",
        "regressor": "GradientBoostingRegressor",
        "is_v2": IS_V2,
    }


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
        # v2 features
        req.breakdown_streak,
        req.delay_acceleration,
        req.availability_trend,
        req.tonnage_efficiency,
        req.time_since_maintenance,
        req.breakdown_severity_avg,
    ]

    # ── Regression prediction ──
    rul_log = float(MODEL.predict([feature_vector])[0])
    rul = float(np.expm1(rul_log))  # inverse of log1p
    rul = max(0.5, round(rul, 1))   # floor at half a day

    # ── Classification prediction (v2) ──
    if IS_V2 and CLASSIFIER is not None:
        class_idx = CLASSIFIER.predict([feature_vector])[0]
        class_proba = CLASSIFIER.predict_proba([feature_vector])[0]
        risk_class = LABEL_ENCODER.inverse_transform([class_idx])[0]

        risk_probability = {
            cls: round(float(p), 3)
            for cls, p in zip(LABEL_ENCODER.classes_, class_proba)
        }

        band, score = risk_class_to_band(risk_class)

        # Confidence based on probability margin
        sorted_proba = sorted(class_proba, reverse=True)
        margin = sorted_proba[0] - (sorted_proba[1] if len(sorted_proba) > 1 else 0)
        confidence = "HIGH" if margin > 0.5 else ("MEDIUM" if margin > 0.2 else "LOW")

        # Feature contributions from classifier (which actually learned features)
        contribs = top_feature_contributions(feature_vector, CLASSIFIER)
    else:
        # Legacy mode
        risk_class = "UNKNOWN"
        risk_probability = {}
        band, score = compute_risk_band_legacy(rul, req.mtbf_days)
        n_train = META.get("n_training_rows", 0)
        confidence = "HIGH" if n_train >= 30 else ("MEDIUM" if n_train >= 10 else "LOW")
        contribs = top_feature_contributions(feature_vector, MODEL)

    return PredictResponse(
        machine              = req.machine,
        rul_days             = rul,
        risk_class           = risk_class,
        risk_probability     = risk_probability,
        risk_band            = band,
        risk_score           = score,
        confidence           = confidence,
        advice               = build_advice(rul, band, risk_class, req),
        feature_contributions = contribs,
        model_version        = "2.0" if IS_V2 else "1.0",
    )


# ──────────────────────────────────────────────
# PERSISTENCE ENDPOINTS (unchanged from v1)
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
