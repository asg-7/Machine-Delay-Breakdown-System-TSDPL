# TATA Steel Processing Lines (TSDPL) – Production Analytics & Predictive Maintenance System

A full-stack, modular web dashboard and machine learning backend designed to analyze delays, track productivity, detect shift anomalies, and predict Remaining Useful Life (RUL) for WCTL-1, WCTL-2, and SLITTER production lines at TATA Steel Processing and Distribution Limited (TSDPL), Kalinganagar.

---

## Key Features

1. **Clean Modular Frontend**: Refactored to separate concerns. The main dashboard HTML is kept under 340 lines, with styles in `css/style.css`, application lifecycle in `js/app.js`, and separate modules for charting, filtering, Excel parsing, analytics page rendering, and API clients.
2. **CORS-Safe Sample Data**: The historical/mock dataset is loaded from `js/data.js` via a `<script>` tag. This prevents CORS issues when opening the HTML dashboard directly as a local file (`file://` protocol) in the browser, without needing a web server.
3. **FastAPI ML Backends**:
   - **Remaining Useful Life (RUL) Module**: A supervised Gradient Boosting Regressor trained on engineered maintenance features (`mtbf`, `mttr`, `days_since_last_bd`, etc.) to predict days until the next machine breakdown.
   - **Anomaly Detection Module**: An unsupervised Isolation Forest model evaluating 27 features per shift to flag anomalous operational runs (with attribution of top feature drivers for explainability).
4. **Interactive UI**: Gorgeous dark theme design with real-time Excel upload parsing (.xlsx/.csv), interactive Chart.js widgets, scrollable heatmaps, pivot tables, availability gauges, and predictive risk alerts.

---

## File Structure

```text
TSDPL_DELAY2/
│
├── TSDPL_Dashboard.html                # Single main dashboard entry point (modularized)
├── README.md                           # Developer Guide (this file)
├── TSDPL_DELAY2readme.md               # Extensive project architecture & API specs
├── commit-and-push.bat                 # Script to automate commits and pushing
│
├── css/
│   └── style.css                       # Core design system stylesheet
│
├── js/
│   ├── data.js                         # Out-of-the-box mock dataset (window.RAW_DATA)
│   ├── charts.js                       # Chart.js helper functions & gradient definitions
│   ├── filters.js                      # Data normalization & multi-criteria filtering
│   ├── parser.js                       # Client-side Excel parser (SheetJS interface)
│   ├── analytics.js                    # UI renderers for Overview, Production, Delays, etc.
│   ├── rul_client.js                   # Client module for sending feature telemetry to RUL API
│   └── app.js                          # Dashboard lifecycle manager & page controllers
│
├── rul_tsdpl/                          # Python RUL prediction backend
│   ├── api.py                          # FastAPI application (starts server on port 8000)
│   ├── feature_engineering.py          # Data aggregator & feature builder
│   ├── train.py                        # Model trainer (GradientBoostingRegressor)
│   ├── rul_features.csv                # Extracted feature matrix
│   ├── rul_model.pkl                   # Serialized regressor model
│   └── rul_model_meta.json             # Training metrics & feature importances JSON
│
├── anomaly_detector/                   # Python anomaly detection backend
│   ├── api_router.py                   # Anomaly API router (mounted on API app)
│   ├── feature_engineering.py          # Builds 27 features from raw shift arrays
│   ├── anomaly_detector.py             # IsolationForest & RobustScaler model wrapper
│   ├── requirements.txt                # Package dependencies
│   ├── test_anomaly_detector.py        # Automated testing script
│   └── models/                         # Persistent Isolation Forest model directory
│
└── sampledata/                         # Live plant delay logs for WCTL-1, WCTL-2, and SLITTER
```

---

## Quick Start Guide

### 1. Install Dependencies
Ensure you have Python 3.10+ installed. Install the Python packages:
```bash
pip install pandas openpyxl scikit-learn fastapi uvicorn joblib
```

### 2. Start the Backend API
Navigate to the RUL directory and start the FastAPI server:
```bash
cd rul_tsdpl
python -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check endpoint: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Open the Dashboard
Simply open [TSDPL_Dashboard.html](file:///c:/TSDPL/week5/TSDPL_DELAY2/TSDPL_Dashboard.html) directly in any modern web browser.
- **Upload Data**: Navigate to the **UPLOAD DATA** tab and upload the raw Excel logs from `sampledata/` (one file for each corresponding machine).
- **View Insights**: Navigate to the other tabs (**OVERVIEW**, **PRODUCTION**, **DELAY ANALYSIS**, **MAINTENANCE**, **AVAILABILITY**, **ML PREDICTIONS**) to view dynamically processed metrics, breakdown charts, MTBF/MTTR cards, RUL estimates, and anomaly flags.
