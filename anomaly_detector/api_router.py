"""
api_router.py
-------------
FastAPI router that mounts on your existing FastAPI app (from Phase 6).

Mount in main.py with:
    from anomaly_detector.api_router import router as anomaly_router
    app.include_router(anomaly_router, prefix="/api/anomaly", tags=["anomaly"])

Endpoints
---------
POST /api/anomaly/detect
    Body: JSON array of shift records
    Returns: scored shifts sorted by anomaly_score desc

POST /api/anomaly/retrain
    Body: JSON array of shift records (full history)
    Returns: training metrics + new model stats

GET  /api/anomaly/model-info
    Returns: current model metadata (contamination, n_features, etc.)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import pandas as pd

from anomaly_detector.feature_engineering import engineer_features
from anomaly_detector.anomaly_detector import ShiftAnomalyDetector

router = APIRouter()

# ── singleton model state ─────────────────────────────────────────────────────
# Loaded once at startup; retrain endpoint updates in-place

_detector: Optional[ShiftAnomalyDetector] = None


def _get_detector() -> ShiftAnomalyDetector:
    global _detector
    if _detector is None:
        try:
            _detector = ShiftAnomalyDetector.load()
        except FileNotFoundError:
            raise HTTPException(
                status_code=503,
                detail="Model not yet trained. POST to /retrain with historical data first."
            )
    return _detector


# ── request / response models ─────────────────────────────────────────────────

class ShiftRecord(BaseModel):
    shift_date:         str
    shift:              str
    line:               str
    incharge:           str
    production_tonnes:  float
    available_hours:    float
    delay_minutes:      float
    breakdown_count:    int
    delay_breakdown:    float
    delay_planned:      float
    delay_other:        float
    target_tonnes:      float


class AnomalyResult(BaseModel):
    shift_date:     str
    shift:          str
    line:           str
    incharge:       str
    anomaly_score:  float = Field(..., ge=0, le=1)
    is_anomaly:     bool
    top_drivers:    List[str]


class DetectResponse(BaseModel):
    total_shifts:   int
    anomaly_count:  int
    results:        List[AnomalyResult]


class RetrainResponse(BaseModel):
    status:           str
    n_samples:        int
    n_features:       int
    contamination:    float
    anomaly_fraction: float
    mean_score:       float
    score_std:        float


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/detect", response_model=DetectResponse)
def detect_anomalies(records: List[ShiftRecord]):
    """Score a batch of shifts for anomalies."""
    if not records:
        raise HTTPException(status_code=400, detail="No records provided.")

    detector = _get_detector()
    raw_df = pd.DataFrame([r.model_dump() for r in records])

    try:
        df_features, feature_cols = engineer_features(raw_df)
        results_df = detector.predict(df_features, feature_cols)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Feature engineering failed: {e}")

    results = []
    for _, row in results_df.iterrows():
        results.append(AnomalyResult(
            shift_date    = str(row["shift_date"])[:10],
            shift         = row["shift"],
            line          = row["line"],
            incharge      = row["incharge"],
            anomaly_score = round(float(row["anomaly_score"]), 4),
            is_anomaly    = bool(row["is_anomaly"]),
            top_drivers   = row["top_drivers"],
        ))

    return DetectResponse(
        total_shifts  = len(results),
        anomaly_count = sum(r.is_anomaly for r in results),
        results       = results,
    )


@router.post("/retrain", response_model=RetrainResponse)
def retrain_model(records: List[ShiftRecord], contamination: float = 0.05):
    """Retrain the Isolation Forest on new data and persist to disk."""
    global _detector

    if len(records) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 30 shifts to train reliably. Got {len(records)}."
        )

    raw_df = pd.DataFrame([r.model_dump() for r in records])

    try:
        df_features, feature_cols = engineer_features(raw_df)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Feature engineering failed: {e}")

    detector = ShiftAnomalyDetector(contamination=contamination)
    metrics  = detector.retrain(df_features, feature_cols)
    detector.save()
    _detector = detector

    return RetrainResponse(status="ok", **metrics)


@router.get("/model-info")
def model_info():
    """Return metadata about the currently loaded model."""
    detector = _get_detector()
    return {
        "is_fitted":     detector.is_fitted,
        "contamination": detector.contamination,
        "n_features":    len(detector.feature_cols),
        "feature_cols":  detector.feature_cols,
        "n_estimators":  detector.model.n_estimators,
    }
