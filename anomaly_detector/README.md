# Anomaly Detector Module

Isolation Forest-based shift anomaly detection for TSDPL production lines.

## Overview

This module detects anomalous shifts across WCTL-1, WCTL-2, and SLITTER production lines using an unsupervised Isolation Forest model. It engineers features from raw shift records, trains on historical data, and scores new shifts with per-feature explanations.

## Files

| File | Purpose |
|------|---------|
| `__init__.py` | Package marker (empty) |
| `feature_engineering.py` | Transforms raw shift records into ML features |
| `anomaly_detector.py` | `ShiftAnomalyDetector` class: RobustScaler + IsolationForest pipeline |
| `api_router.py` | FastAPI router with `/detect`, `/retrain`, `/model-info` endpoints |
| `test_anomaly_detector.py` | Self-contained tests with synthetic data generator |
| `requirements.txt` | Python dependencies |
| `models/` | Persisted model artifacts (created at runtime) |

## Endpoints

Mounted at `/api/anomaly` on the existing FastAPI server:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/anomaly/detect` | Score a batch of shifts for anomalies |
| POST | `/api/anomaly/retrain` | Retrain the Isolation Forest on new data |
| GET | `/api/anomaly/model-info` | Return current model metadata |

## Quick Start

```bash
# Install dependencies (most already present from rul_tsdpl)
pip install -r anomaly_detector/requirements.txt

# Run tests
python anomaly_detector/test_anomaly_detector.py

# Start the server (from rul_tsdpl/)
cd rul_tsdpl/
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

## Notes

- The `models/` directory is empty until you POST to `/api/anomaly/retrain` with at least 30 shift records.
- The `/detect` endpoint returns HTTP 503 until a model is trained.
- This module shares no state with `rul_tsdpl/` — it is fully independent.
