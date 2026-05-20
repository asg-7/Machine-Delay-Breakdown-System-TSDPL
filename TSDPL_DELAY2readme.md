# TSDPL Machine Delay Breakdown System (TSDPL_DELAY2)

> **Predictive Maintenance Dashboard for TATA Steel Processing Lines**
>
> Real-time delay tracking, analytics, and ML-powered Remaining Useful Life (RUL) prediction for WCTL-1, WCTL-2, and SLITTER production lines.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Backend: RUL Prediction Module](#backend-rul-prediction-module)
6. [Backend: Anomaly Detection Module](#backend-anomaly-detection-module) *(NEW)*
7. [Frontend: Dashboard](#frontend-dashboard)
8. [API Reference](#api-reference)
9. [Data Flow](#data-flow)
10. [Troubleshooting](#troubleshooting)

---

## Overview

TSDPL_DELAY2 is a full-stack delay analysis and predictive maintenance system consisting of:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML + CSS + Vanilla JS + Chart.js | Interactive dashboard with upload, filtering, analytics, ML prediction, and anomaly detection |
| **Backend - RUL** | Python + FastAPI + scikit-learn | Feature engineering, GradientBoostingRegressor model training, REST API serving |
| **Backend - Anomaly** | Python + FastAPI + scikit-learn | Isolation Forest model, unsupervised anomaly detection on shift records, anomaly scoring |
| **Data** | Excel (.xlsx) | Raw delay reports from WCTL-1, WCTL-2, and SLITTER production lines |

---

## File Structure

```
TSDPL_DELAY2/
|
|-- index.html                          # Main dashboard entry point
|-- README.md                           # Original readme
|-- TSDPL_DELAY2readme.md              # This file (updated readme)
|
|-- css/
|   |-- style.css                       # Full design system (dark theme, KPI cards, charts, ML cards)
|
|-- js/
|   |-- app.js                          # Boot loader, tab switching, RAW_DATA global state, anomaly detection
|   |-- parser.js                       # SheetJS Excel parser (populates RAW_DATA[])
|   |-- filters.js                      # Data normalization, machine/shift/date filtering
|   |-- charts.js                       # Chart.js factory helpers and gradient utilities
|   |-- analytics.js                    # Page renderers: Overview, Machine, Comparative, ML Predictions
|   |-- rul_client.js                   # RUL API client - builds payloads from RAW_DATA, renders prediction cards
|
|-- rul_tsdpl/                          # Python ML backend module (RUL prediction)
|   |-- feature_engineering.py          # Loads Excel, extracts breakdown events, computes feature matrix
|   |-- train.py                        # Trains GradientBoostingRegressor, saves model + metadata
|   |-- api.py                          # FastAPI server with /predict, /model-info, /health + anomaly router mount
|   |-- rul_features.csv                # Generated feature matrix (402 rows x 14 features)
|   |-- rul_model.pkl                   # Trained model artifact (pickle)
|   |-- rul_model_meta.json             # Model metadata (feature importances, CV scores, training stats)
|
|-- anomaly_detector/                   # Python ML backend module (Anomaly detection) *(NEW)*
|   |-- __init__.py                     # Empty package marker
|   |-- feature_engineering.py          # Transforms raw shifts → 27 engineered features
|   |-- anomaly_detector.py             # ShiftAnomalyDetector class (IsolationForest + RobustScaler)
|   |-- api_router.py                   # FastAPI router (/detect, /retrain, /model-info)
|   |-- test_anomaly_detector.py        # 5 unit tests with synthetic data generator
|   |-- requirements.txt                # Dependencies (scikit-learn, pandas, numpy, joblib, fastapi, etc.)
|   |-- README.md                       # Module documentation
|   |-- models/                         # Directory for model artifacts (created at runtime)
|
|-- sampledata/
|   |-- WCTL-1 DELAY REPORT MAY-26.xlsx       # 418 rows, May 2026
|   |-- WCTL-2 DELAY FEB-2026.xlsx            # 5631 rows, Nov 2025 - Feb 2026
|   |-- SLITDELAY REPOERT MAR-2026.xlsx       # 6664 rows, Oct 2025 - Mar 2026
```

---

## Prerequisites

### Python (Backend)

- **Python 3.10+**
- Required packages for RUL module:

```bash
pip install pandas openpyxl scikit-learn fastapi uvicorn
```

- Additional packages for Anomaly Detection module:

```bash
# Install from anomaly_detector/requirements.txt
pip install -r anomaly_detector/requirements.txt
```

Which includes: `scikit-learn`, `pandas`, `numpy`, `joblib`, `fastapi`, `pydantic`, `uvicorn`

**Note:** Most packages overlap with RUL module. Only `joblib` is likely new.

### Browser (Frontend)

- Any modern browser (Chrome, Edge, Firefox)
- No build tools required - pure vanilla HTML/CSS/JS

---

## Quick Start

### Step 1: Install All Dependencies

```bash
# Install RUL module dependencies
pip install pandas openpyxl scikit-learn fastapi uvicorn

# Install Anomaly Detection module dependencies
pip install -r anomaly_detector/requirements.txt
```

### Step 2: Train the ML Models (one-time setup)

#### Option A: Train RUL Model Only

```bash
cd rul_tsdpl/

# Build features and train model in one step
python train.py --data ../sampledata
```

#### Option B: Train Anomaly Detection Model (requires historical data)

```bash
# Run tests to verify module works
python anomaly_detector/test_anomaly_detector.py

# Note: Anomaly model is trained via API after data upload (see Step 4)
```

**Output (RUL):**
- `rul_features.csv` - Feature matrix (402 samples, 14 features)
- `rul_model.pkl` - Trained GradientBoostingRegressor model
- `rul_model_meta.json` - Training metadata for the frontend

**Output (Anomaly):**
- Test artifacts in `anomaly_detector/models/` (overwritten on first retrain)

### Step 3: Start the API Server

```bash
cd rul_tsdpl/
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

The server starts at `http://localhost:8000` and now serves BOTH:
- **RUL endpoints:** `/predict`, `/model-info`, `/health`
- **Anomaly endpoints:** `/api/anomaly/detect`, `/api/anomaly/retrain`, `/api/anomaly/model-info`

Verify with:

```bash
curl http://localhost:8000/health
# {"status":"ok","model":"GradientBoostingRegressor","version":"1.0.0"}
```

### Step 4: Open the Dashboard

Open `index.html` directly in a browser (no web server needed for the frontend).

1. Navigate to the **UPLOAD** tab
2. Upload the Excel files from `sampledata/` (one per machine channel)
3. After upload completes, anomaly detection runs automatically
4. Check browser console for: `"Anomaly detection complete: X flagged shifts"`
5. Switch to the **ML PREDICTIONS** tab to see:
   - Heuristic breakdown predictions (EWA-based)
   - API-powered RUL predictions (per-machine cards with risk band, score, confidence, and advice)
   - Anomaly detection results (integrated into analytics)

---

## Backend: RUL Prediction Module

### Feature Engineering (`feature_engineering.py`)

Processes raw Excel delay reports and extracts 13 features per breakdown event:

| Feature | Description |
|---------|-------------|
| `mtbf_days` | Mean Time Between Failures (days) |
| `mtbf_std` | Standard deviation of failure intervals |
| `mtbf_trend` | Trend direction of failure intervals (negative = worsening) |
| `mttr_min` | Mean Time To Repair (minutes) |
| `days_since_last_bd` | Days since the last breakdown |
| `bd_freq_30d` | Number of breakdowns in the last 30 days |
| `avg_avail_7d` | Average availability % over last 7 days |
| `avg_avail_30d` | Average availability % over last 30 days |
| `avg_tonnage_7d` | Average tonnage produced over last 7 days |
| `delay_min_7d` | Total delay minutes in last 7 days |
| `delay_min_30d` | Total delay minutes in last 30 days |
| `delay_diversity` | Number of unique delay types in last 30 days |
| `machine_id` | Machine encoding (WCTL-1=0, WCTL-2=1, SLITTER=2) |

**Target variable:** `rul_days` (days until next breakdown)

### Excel Column Mapping

The three machine files have different column layouts. The script auto-detects:

| Machine | Delay Type Column | Delay Minutes Column | Tonnage Column |
|---------|------------------|---------------------|----------------|
| WCTL-1 | `description` | `time` | `tonnage` |
| WCTL-2 | `unnamed:_11` | `delay_time` | `mt` |
| SLITTER | `reason` | `time` | `tonnage` |

### Model Training (`train.py`)

- **Algorithm:** GradientBoostingRegressor (scikit-learn)
- **Hyperparameters:** 300 estimators, max_depth=4, learning_rate=0.05, Huber loss
- **Validation:** 5-fold cross-validation
- **Training data:** 402 samples across 3 machines

```bash
# Train from pre-built CSV
python train.py --csv rul_features.csv

# Train from raw Excel files
python train.py --data ../sampledata
```

### API Server (`api.py`)

FastAPI server with CORS enabled for browser access. Now includes anomaly detection router.

---

## Backend: Anomaly Detection Module *(NEW)*

### Overview

The anomaly detection module uses an **Isolation Forest** model to identify anomalous shifts in production data. It is fully self-contained and independent from the RUL prediction module.

**Key Features:**
- Unsupervised anomaly detection (no labeled data required)
- 27 engineered features from raw shift records
- Per-shift anomaly scoring (0-1, higher = more anomalous)
- Top 3 feature drivers per anomaly (explainability)
- Real-time model retraining capability
- Graceful error handling (503 until model trained)

### Architecture

```
Raw Shift Records (shift_date, shift, line, incharge, production, delays, etc.)
    ↓
feature_engineering.py (engineer_features())
    ↓
27 Engineered Features (temporal, productivity, delays, rolling windows, baselines)
    ↓
RobustScaler (median + IQR based, outlier-resistant)
    ↓
IsolationForest (unsupervised, contamination=0.05)
    ↓
Anomaly Scoring (0-1, normalized)
    ↓
Driver Explanation (top 3 features via mean-shift attribution)
    ↓
Results returned to frontend (shift_date, shift, line, incharge, anomaly_score, is_anomaly, top_drivers)
```

### Features Engineered (27 total)

| Category | Features |
|----------|----------|
| **Temporal** | dow_sin, dow_cos, shift_enc, month |
| **Productivity** | availability, efficiency, tonnes_per_hour |
| **Delay Breakdown** | delay_ratio, breakdown_ratio, planned_ratio, other_delay_ratio, avg_breakdown_duration, breakdown_count |
| **Rolling Windows** | prod_roll3_mean, prod_roll3_std, prod_roll7_mean, prod_dev_from_mean, delay_roll3_mean, delay_roll3_std, delay_dev_from_mean, avail_roll3_mean, avail_dev_from_mean, bkd_roll3_mean, bkd_dev_from_mean |
| **Performance Baseline** | incharge_prod_zscore, incharge_delay_zscore |

### API Endpoints

#### `POST /api/anomaly/detect`

Score a batch of shifts for anomalies.

**Request body:**
```json
[
  {
    "shift_date": "2026-05-15",
    "shift": "A",
    "line": "WCTL-1",
    "incharge": "OP-001",
    "production_tonnes": 450.5,
    "available_hours": 8.0,
    "delay_minutes": 45.0,
    "breakdown_count": 2,
    "delay_breakdown": 30.0,
    "delay_planned": 10.0,
    "delay_other": 5.0,
    "target_tonnes": 460.0
  },
  ...
]
```

**Response:**
```json
{
  "total_shifts": 215,
  "anomaly_count": 11,
  "results": [
    {
      "shift_date": "2026-04-15",
      "shift": "B",
      "line": "WCTL-1",
      "incharge": "OP-003",
      "anomaly_score": 0.9124,
      "is_anomaly": true,
      "top_drivers": ["delay_ratio", "efficiency", "avg_breakdown_dur"]
    },
    ...
  ]
}
```

**Error:** Returns `HTTP 503` if model not yet trained

#### `POST /api/anomaly/retrain`

Train/retrain the Isolation Forest on new historical data.

**Request body:**
```json
{
  "records": [... 30+ shift records ...],
  "contamination": 0.05
}
```

**Response:**
```json
{
  "status": "ok",
  "n_samples": 215,
  "n_features": 27,
  "contamination": 0.05,
  "anomaly_fraction": 0.051,
  "mean_score": -0.156,
  "score_std": 0.412
}
```

**Error:** Returns `HTTP 400` if fewer than 30 records

#### `GET /api/anomaly/model-info`

Get current model metadata.

**Response:**
```json
{
  "is_fitted": true,
  "contamination": 0.05,
  "n_features": 27,
  "feature_cols": ["dow_sin", "dow_cos", "shift_enc", "month", ...],
  "n_estimators": 200
}
```

**Error:** Returns `HTTP 503` if model not yet trained

### Model Persistence

Model artifacts are saved to `anomaly_detector/models/`:
- `isolation_forest.joblib` - Trained Isolation Forest
- `robust_scaler.joblib` - Feature scaler
- `feature_cols.joblib` - Feature column names

These are auto-loaded on server startup and overwritten when `/retrain` is called.

### Testing

Run the test suite to verify the module works:

```bash
python anomaly_detector/test_anomaly_detector.py
```

**5 unit tests included:**
1. **test_feature_engineering** - Validates feature pipeline (27 features, no NaN)
2. **test_fit_predict** - Trains model and scores shifts
3. **test_anomaly_detection_quality** - Verifies anomalies score higher than normal shifts
4. **test_save_load** - Tests model persistence to disk
5. **test_retrain_metrics** - Validates metrics calculation

**Expected output:**
```
>>  test_feature_engineering ... PASS
>>  test_fit_predict ... PASS
>>  test_anomaly_detection_quality ... PASS  (anomaly mean=0.638, normal mean=0.194)
>>  test_save_load ... PASS
>>  test_retrain_metrics ... PASS

[OK]  All tests passed.
```

### Files

| File | Purpose |
|------|---------|
| `__init__.py` | Empty package marker |
| `feature_engineering.py` | Transforms raw shifts → 27 features |
| `anomaly_detector.py` | ShiftAnomalyDetector class (IsolationForest + RobustScaler) |
| `api_router.py` | FastAPI router with 3 endpoints |
| `test_anomaly_detector.py` | 5 unit tests + synthetic data generator |
| `requirements.txt` | Dependencies |
| `README.md` | Module documentation |
| `models/` | Runtime artifact directory |

---

## Frontend: Dashboard

### Architecture

```
User uploads Excel --> parser.js --> RAW_DATA[] (global)
                                        |
                    filters.js <--------+
                        |
                    analytics.js --> Chart.js visualizations
                        |
                    rul_client.js --> POST /predict --> Prediction cards
```

### Tab Pages

| Tab | Content |
|-----|---------|
| **UPLOAD** | Drag-and-drop Excel upload for 3 machine channels |
| **OVERVIEW** | KPIs, delay trends, Pareto charts, heatmaps |
| **MACHINE DEEP DIVE** | Per-machine breakdown analysis |
| **COMPARATIVE** | Cross-machine comparison charts |
| **ML PREDICTIONS** | Heuristic EWA predictions + API RUL prediction cards + anomaly insights |

### ML Predictions Page Layout

The ML Predictions page displays multiple panels:

1. **Left Panel - Heuristic Predictions (EWA):** Client-side exponential weighted average on historical breakdown intervals
2. **Right Panel - API RUL Predictions:** Three prediction cards (WCTL-1, WCTL-2, SLITTER) fetched from the FastAPI backend
3. **Anomaly Insights:** Summary of flagged shifts and top anomaly drivers (from anomaly detection results)

Each RUL card shows:
- Machine name and risk badge (RED/AMBER/GREEN)
- Predicted remaining useful life in days
- Risk score (0-100)
- Confidence level (HIGH/MEDIUM/LOW)
- Actionable maintenance advice
- Key contributing features

---

## API Reference

### `GET /health`

Liveness check.

**Response:**
```json
{
  "status": "ok",
  "model": "GradientBoostingRegressor",
  "version": "1.0.0"
}
```

### `GET /model-info`

Returns training metadata and feature importances.

**Response:**
```json
{
  "feature_cols": ["mtbf_days", "mtbf_std", ...],
  "target": "rul_days",
  "n_training_rows": 402,
  "cv_mae_mean": 0.15,
  "cv_r2_mean": -0.04,
  "feature_importance": { "mtbf_days": 0.0, ... },
  "y_min": 1.0,
  "y_max": 28.0,
  "y_mean": 1.2
}
```

### `POST /predict`

Predict RUL for a single machine.

**Request body:**
```json
{
  "machine": "WCTL-1",
  "mtbf_days": 2.6,
  "mtbf_std": 8.22,
  "mtbf_trend": 0.0,
  "mttr_min": 25.91,
  "days_since_last_bd": 1.0,
  "bd_freq_30d": 11,
  "avg_avail_7d": 40.04,
  "avg_avail_30d": 40.99,
  "avg_tonnage_7d": 232.05,
  "delay_min_7d": 865.0,
  "delay_min_30d": 1135.0,
  "delay_diversity": 11
}
```

**Response:**
```json
{
  "machine": "WCTL-1",
  "rul_days": 1.0,
  "risk_band": "AMBER",
  "risk_score": 54,
  "confidence": "HIGH",
  "advice": "CAUTION - WCTL-1 showing wear signals. ...",
  "feature_contributions": {
    "mtbf_days": 0.0,
    "days_since_last_bd": 0.0
  }
}
```

### Anomaly Detection Endpoints *(NEW)*

#### `POST /api/anomaly/detect`

Score a batch of shifts for anomalies.

**Request body:**
```json
[
  {
    "shift_date": "2026-05-15",
    "shift": "A",
    "line": "WCTL-1",
    "incharge": "OP-001",
    "production_tonnes": 450.5,
    "available_hours": 8.0,
    "delay_minutes": 45.0,
    "breakdown_count": 2,
    "delay_breakdown": 30.0,
    "delay_planned": 10.0,
    "delay_other": 5.0,
    "target_tonnes": 460.0
  },
  ...
]
```

**Response:**
```json
{
  "total_shifts": 215,
  "anomaly_count": 11,
  "results": [
    {
      "shift_date": "2026-04-15",
      "shift": "B",
      "line": "WCTL-1",
      "incharge": "OP-003",
      "anomaly_score": 0.9124,
      "is_anomaly": true,
      "top_drivers": ["delay_ratio", "efficiency", "avg_breakdown_dur"]
    },
    ...
  ]
}
```

**Error:** Returns `HTTP 503` if model not yet trained

#### `POST /api/anomaly/retrain`

Train/retrain the Isolation Forest on new historical data (requires ≥30 records).

**Request body:**
```json
{
  "records": [... 30+ shift records ...],
  "contamination": 0.05
}
```

**Response:**
```json
{
  "status": "ok",
  "n_samples": 215,
  "n_features": 27,
  "contamination": 0.05,
  "anomaly_fraction": 0.051,
  "mean_score": -0.156,
  "score_std": 0.412
}
```

**Error:** Returns `HTTP 400` if fewer than 30 records

#### `GET /api/anomaly/model-info`

Get current model metadata.

**Response:**
```json
{
  "is_fitted": true,
  "contamination": 0.05,
  "n_features": 27,
  "feature_cols": ["dow_sin", "dow_cos", "shift_enc", "month", ...],
  "n_estimators": 200
}
```

**Error:** Returns `HTTP 503` if model not yet trained

---

## Data Flow

```
                    EXCEL FILES (sampledata/)
                            |
            +---------------+---------------+
            |               |               |
         WCTL-1          WCTL-2          SLITTER
            |               |               |
            +-------+-------+-------+-------+
                    |               |
           feature_engineering.py   parser.js (browser)
                    |               |
            rul_features.csv    RAW_DATA[] (in-memory)
                    |               |
               train.py     +-------+-------+
                    |       |               |
            rul_model.pkl   rul_client.js  runAnomalyDetection()
                    |       |               |
                api.py <----+-------+-------+
             (FastAPI)      |       |
                    |       |       |
    /predict    +---+   +---+   +---+
    /health     |       |       |
    /model-info |       |       |
           POST /predict POST /api/anomaly/detect
                |       |       |
                +---+---+-------+---+
                    |               |
             RUL Cards     Anomaly Results
                            |
                    window.ANOMALY_RESULTS
                    window.ANOMALY_COUNT
                            |
                    Dashboard ML Page
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `KeyError: 'date'` in feature_engineering.py | Ensure Excel files have headers on row 2 (row 1 is a title row). The script uses `header=1`. |
| `FileNotFoundError: rul_model.pkl` | Run `python train.py --csv rul_features.csv` in the `rul_tsdpl/` directory first. |
| `UnicodeEncodeError` on Windows console | Fixed in the codebase. If it recurs, set `PYTHONIOENCODING=utf-8` environment variable. |
| RUL cards show "prediction unavailable" | Ensure the FastAPI server is running on `http://localhost:8000`. Check browser console for CORS errors. |
| Anomaly detection returns HTTP 503 | Model not trained yet. POST to `/api/anomaly/retrain` with ≥30 shift records to train the model. |
| "Anomaly detection unavailable" in console | FastAPI server is not running or not accessible on port 8000. Start it with `python -m uvicorn api:app --host 127.0.0.1 --port 8000` |
| Anomaly tests fail with import errors | Run `pip install -r anomaly_detector/requirements.txt` first to install dependencies. |
| "No data uploaded" on ML page | Upload Excel files on the UPLOAD tab before switching to ML PREDICTIONS. |
| CORS errors in browser | The API server has CORS enabled for all origins (`*`). If issues persist, serve `index.html` via a local HTTP server. |
| Low R-squared in training | Expected with limited industrial data. The model improves as more shift reports are collected over time. |
| Models not persisting after restart | Check that `anomaly_detector/models/` directory has write permissions. Models are auto-saved on retrain. |

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | HTML5 + CSS3 + JavaScript (ES6+) | - |
| Charts | Chart.js | CDN |
| Excel Parsing | SheetJS (xlsx) | CDN |
| **Backend - RUL** | Python | 3.10+ |
| RUL ML Framework | scikit-learn (GradientBoostingRegressor) | Latest |
| **Backend - Anomaly** | Python | 3.10+ |
| Anomaly ML Framework | scikit-learn (IsolationForest) | Latest |
| API Server | FastAPI + Uvicorn | Latest |
| Data Handling | pandas + openpyxl | Latest |
| Model Serialization | joblib | Latest |

---

## Project Summary

TSDPL_DELAY2 provides end-to-end predictive maintenance capabilities through two complementary ML modules:

1. **RUL Prediction:** Estimates remaining useful life for each production line based on maintenance history
2. **Anomaly Detection:** Identifies anomalous shifts that deviate from normal operating patterns

**Key Capabilities:**
- ✅ Full-stack system (frontend + backend + ML)
- ✅ Real-time data upload and processing
- ✅ Interactive dashboard with multi-tab interface
- ✅ ML model training and inference
- ✅ Unsupervised anomaly detection
- ✅ Feature engineering pipelines
- ✅ REST API with CORS support
- ✅ Persistent model artifacts
- ✅ Comprehensive error handling

**Data Sources:**
- Excel reports from WCTL-1, WCTL-2, SLITTER production lines
- Raw shift-level delay, production, and breakdown data
- Historical maintenance records

**Use Cases:**
1. Predict machine failures and schedule preventive maintenance
2. Identify unusual shift patterns indicating equipment degradation
3. Optimize maintenance resource allocation
4. Reduce unplanned downtime through early warning systems
5. Analyze delay patterns across production lines

---

*Updated on 2026-05-20 with Anomaly Detection Module (Phase 8). For questions, refer to the module READMEs or contact the development team.*
