# TSDPL Production Analytics & Predictive Maintenance System

Welcome to the **TSDPL Machine Delay Breakdown & Anomaly Detection System**! This manual is written in the simplest way possible so that anyone—even a beginner—can understand exactly how this system works, what each file does, and how all the code fits together.

---

## 🌟 1. Project Overview (In Simple Words)

Imagine you are running a factory with **three big machines** that process steel coils: **WCTL-1**, **WCTL-2**, and a **SLITTER**. 

Sometimes, these machines stop working (called **delays** or **breakdowns**). When they stop, the factory loses money. 
This project does four main things:
1. **Reads Excel logs** that operators type in during their work shifts.
2. **Shows beautiful charts and summaries** (KPIs) of production, availability, and delays.
3. **Uses Machine Learning (AI brains)** to:
   - **Predict when a machine is going to break down next** (Remaining Useful Life, or **RUL**).
   - **Flag weird work shifts** that had unusual levels of downtime or low production (called **Anomaly Detection**).
4. **Allows Operators to log shift downtime directly** via a secure, automatic terminal that locks to their machine line and syncs inputs to a shared backend and a cloud-hosted **Supabase database** in real-time.

---

## 🔄 2. How Data Flows (The Big Picture)

Here is how data moves step-by-step through the system:

```
[ Supabase Database ] <──(Realtime Sync/Insert)──> [ app.js ]
                                                       │
                                                 (Load/Save)
                                                       ▼
[ Excel File ] ──(Upload)──> [ parser.js ] ──> [ RAW_DATA[] ]
                                                    │
             ┌──────────────────────────────────────┴──────────────────────────────────────┐
             ▼                                                                             ▼
    [ filters.js ] (Clean & Group)                                               [ app.js ] (Trigger APIs)
             │                                                                             │
             ├──────────────────────────────────────┐                                      ▼
             ▼                                      ▼                          [ python -m uvicorn api:app ]
     [ analytics.js ]                         [ charts.js ]                                │
    (Calculate & Render)                   (Create Chart.js)             ┌─────────────────┴─────────────────┐
             │                                      │                    ▼                                   ▼
     [ HTML Dashboard ] <───────────────────────────┘            (Gradient Boosting)                  (Isolation Forest)
             ▲                                                           │                                   │
             │                                                           ▼                                   ▼
             └──────────────────(POST /predict & POST /api/anomaly/detect)───────────────────────────────────┘
```

1. **The application connects to Supabase** on page load, retrieves all stored shift logs into `RAW_DATA[]`, and sets up a PostgreSQL change listener to trigger real-time updates.
2. **You can also upload an Excel sheet** containing shift logs for WCTL-1, WCTL-2, or SLITTER, which is parsed by `parser.js`.
3. **`filters.js` cleans the data**, fixes spelling mistakes in names, categorizes delays, and calculates how many minutes each machine was running.
4. **`analytics.js` calculates plant statistics** (like availability and repair times) and tells **`charts.js`** to draw beautiful visual graphs.
5. **The browser talks to the Python server (FastAPI)**:
   - It sends shift data to the **Anomaly Detector**, which flags "weird" shifts.
   - It sends recent machine stats to the **RUL Predictor**, which replies with the number of days until the next breakdown.
6. **The Web Dashboard updates in real-time** to display all the metrics, breakdown countdowns, and warning badges.

---

## 📁 3. Project Directory Structure

Here is a map of all the files in the project folder:

```text
TSDPL_DELAY2/
│
├── TSDPL_Dashboard.html                 # The main web page you see in your browser.
├── README.md                            # THIS FILE - The ultimate simple manual.
├── commit-and-push.bat                  # A shortcut script to save and backup changes to Git.
├── .gitignore                           # Excludes local runtime folders and Python caches.
│
├── css/
│   └── style.css                        # The style guide (colors, layouts, and dark-theme looks).
│
├── js/                                  # JavaScript files (the logic inside the browser)
│   ├── data.js                          # A file that holds the uploaded shift data. Starts empty.
│   ├── app.js                           # The main manager that starts the dashboard and calls APIs.
│   ├── parser.js                        # The translator that reads uploaded Excel files.
│   ├── filters.js                       # The cleaner that normalizes names, dates, and delays.
│   ├── charts.js                        # The artist that builds Chart.js graphs.
│   ├── analytics.js                     # The mathematician that calculates KPIs and draws pages.
│   ├── rul_client.js                    # The messenger that requests RUL predictions from Python.
│   └── delay_entry.js                   # Handles operator logs entry, validation, and login.
│
├── rul_tsdpl/                           # RUL Prediction Brain (Python Backend) — v2 Dual Model
│   ├── api.py                           # The web server that hosts the RUL, Anomaly, and Persistence APIs.
│   ├── feature_engineering.py           # v2: Shift-level features (19 total) with risk classification.
│   ├── train.py                         # v2: Trains dual models — Classifier (SMOTE) + Regressor (log-transform).
│   ├── rul_classifier_v2.pkl            # The saved Risk Classifier brain (GradientBoostingClassifier).
│   ├── rul_regressor_v2.pkl             # The saved RUL Regressor brain (GradientBoostingRegressor, log-space).
│   ├── rul_model_meta_v2.json           # v2 metadata: classification report, confusion matrix, importances.
│   ├── rul_features_v2.csv              # v2 training table: shift-level features with risk_class column.
│   ├── rul_features.csv                 # Legacy v1 training table (backward compat).
│   ├── rul_model.pkl                    # Legacy v1 model (backward compat, auto-updated by train.py).
│   └── rul_model_meta.json              # Legacy v1 metadata (backward compat, auto-updated by train.py).
│
├── anomaly_detector/                    # Shift Anomaly Brain (Python Backend)
│   ├── requirements.txt                 # List of Python packages needed for anomalies.
│   ├── feature_engineering.py           # Prepares 27 special features from shift records.
│   ├── anomaly_detector.py              # The Isolation Forest model that flags weird shifts.
│   ├── api_router.py                    # The API endpoint router mounted onto the main server.
│   ├── test_anomaly_detector.py         # Test script to make sure the anomaly brain works correctly.
│   └── models/                          # Folder where the saved anomaly AI brain is stored.
│
├── uploaded_data/                       # Local backend storage for parsed shifts and operator logs (Git ignored)
│   ├── SLITTER.json                     # Saved parsed JSON data for Slitter
│   ├── WCTL-1.json                      # Saved parsed JSON data for WCTL-1
│   ├── WCTL-2.json                      # Saved parsed JSON data for WCTL-2
│   └── operator_logs.json               # Persistent logs of operator downtime submissions
│
└── sampledata/                          # Actual plant Excel delay sheets for testing
    ├── WCTL-1 DELAY REPORT MAY-26.xlsx  # Shift logs for WCTL-1
    ├── WCTL-2 DELAY FEB-2026.xlsx       # Shift logs for WCTL-2
    ├── SLITDELAY REPOERT MAR-2026.xlsx  # Shift logs for SLITTER
    └── extracted_delay_mappings.json    # JSON mapping of delay categories/subcauses
```

---

## 💻 4. File-by-File & Code-Block Breakdown

Let's look inside every single file and explain exactly what every function (code block) does.

---

### 🌐 Root Frontend Files

#### 1. [TSDPL_Dashboard.html](file:///c:/TSDPL/week5/TSDPL_DELAY2/TSDPL_Dashboard.html)
- **What it does:** This is the skeleton of the application. It defines the tabs, headers, sidebars, forms, upload boxes, and empty spaces where charts and tables will be drawn.
- **Code-Blocks:**
  - **Header Section (lines 15-53):** Displays the TSDPL logo, active system date/shift, and a "LIVE DATA" pulse light.
  - **Navigation Bar (lines 56-64):** Tabs to switch between screens: UPLOAD DATA, OVERVIEW, PRODUCTION, DELAY ANALYSIS, MAINTENANCE, AVAILABILITY, and ML PREDICTIONS.
  - **Filters Bar (lines 66-110):** Dropdown filters for Line/Machine, Shift, Shift Incharge, Dates, and Delay Types.
  - **Page Content Containers (lines 113-596):** Separate page structures that stay hidden until their tab is clicked.
  - **Drag-and-Drop Script (lines 551-594):** Code that lets you drag an Excel file directly from your computer and drop it onto the upload card.

#### 2. [css/style.css](file:///c:/TSDPL/week5/TSDPL_DELAY2/css/style.css)
- **What it does:** The styling file. It turns the boring HTML skeleton into a gorgeous, premium dark-themed dashboard.
- **Code-Blocks:**
  - **Variables (`:root`):** Sets up the color palette (vibrant cyan, orange, green, yellow, red, and slate backgrounds) and fonts (Rajdhani, Barlow, JetBrains Mono).
  - **Layout & Cards (`.card`, `.kpi`):** Creates glowing containers, glassmorphism borders, and animated indicators.
  - **Pills & Badges (`.pill-a`, `.pill-b`, etc.):** Colors shift letters (A, B, C) and delay statuses so they are easy to scan.

---

### 📜 JavaScript (js/) Frontend Modules

#### 3. [js/data.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/data.js)
- **What it does:** Holds the global state variable `RAW_DATA`.
- **Code-Blocks:**
  - `var RAW_DATA = [];` - Initialized as empty on startup. When you upload Excel files, this array is filled with shift logs.

#### 4. [js/app.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/app.js)
- **What it does:** The bootstrap orchestrator. It manages startup, navigation, connects to the cloud Supabase database, and links data to the local anomaly detection backend.
- **Code-Blocks:**
  - `updateClock()`: Runs every second. It reads the current clock time and automatically calculates if the plant is in Shift A (06:00 - 14:00), Shift B (14:00 - 22:00), or Shift C (22:00 - 06:00).
  - `setupNav()`: Listens for clicks on navigation tabs, switches pages, and triggers redraws.
  - `setupFilterEvents()`: Listens for clicks on the filter "APPLY" or "RESET" buttons and handles typing in the search box.
  - `runAnomalyDetection(shiftRecords)`: Sends the uploaded shift logs to the FastAPI server (`POST /api/anomaly/detect`) to flag any unusual shifts. It saves the results globally as `window.ANOMALY_RESULTS`.
  - `loadFromSupabase()`: Connects to Supabase, pulls all records from the `delay_logs` table, maps them to the local `RAW_DATA` structure, updates the UI cards, and runs the anomaly detection model.
  - `getMinMaxDates(shifts)`: Parses shift dates to find the earliest (start) and latest (end) dates chronologically.
  - `updateUCNCards(shifts)`: Refreshes upload cards with accurate shift counts and date ranges, toggling status badges and display states.
  - `DOMContentLoaded` listener: Calls `loadFromSupabase()` to fetch historical logs from the cloud database, sets up a Supabase Realtime subscription on `delay_logs` updates, runs anomaly detection, and automatically switches active navigation to the **OVERVIEW** page if data exists.

#### 5. [js/parser.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/parser.js)
- **What it does:** The Excel translator. It uses the SheetJS library to convert Excel spreadsheet rows into clean JavaScript objects.
- **Code-Blocks:**
  - `handleUpload(event, machine)`: Fired when you select or drop a file. It resets the input field, parses the spreadsheet, reads the first 10 rows to detect headers (like Date, Shift, Tonnage, Coils), maps columns, merges data into `RAW_DATA`, and updates card date ranges and counts.
  - **Date Normalization Block (lines 116-191):** Standardizes multiple date formats (Excel serial numbers, dots, dashes, slashes) into a clean `DD.MM.YYYY` format so the system doesn't duplicate entries.
  - **Shift Aggregator Block (lines 211-232):** Combines multiple spreadsheet rows belonging to the same shift into a single shift record containing a list of delays.
  - **Date Warning Checker (lines 238-252):** Flags rows with suspicious dates (like pre-year-2000 or future dates).

#### 6. [js/filters.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/filters.js)
- **What it does:** Cleans text inputs and filters the shift list based on your selections.
- **Code-Blocks:**
  - `normIncharge(name)`: Fixes typos in operator names (e.g., matching different spellings of "Nageshwar Reddy").
  - `normDelay(t)`: Maps raw delay strings typed by operators into standardized categories like `MAINTENANCE BREAKDOWN`, `CRANE DELAY`, or `SETUP DELAY`.
  - `getDowntimeExcludingOther(delays)`: Sums up shift delays but ignores "OTHER" delay categories, as requested by the plant managers.
  - `getMaintenanceBreakdownDowntime(delays)`: Isolates and sums only the minutes lost to unplanned breakdown events.
  - `prepareRawData()`: Pre-calculates parsed dates, normalized names, total delays, and shift availability percentages for every shift in `RAW_DATA`.
  - `populateFilters()`: Fills the dropdown filter boxes with unique names and delay categories found in the uploaded data.
  - `applyFilters()`: Filters the global array into `filteredData` based on the user's active filter settings, then triggers page redraws.

#### 7. [js/charts.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/charts.js)
- **What it does:** The drawing helper for Chart.js.
- **Code-Blocks:**
  - `delayColor(t)`: Returns a distinct hex color for each normalized delay type.
  - `mkChart(id, config)`: Creates or updates a chart. If a chart already exists on a canvas, it updates the labels and data in place to avoid flickering bugs.
  - `baseOpts(title)`: Returns standard dark-theme styling options (fonts, grid lines, tooltips) for line and bar charts.
  - `toggleLine(btn, chartId)`: Allows clicking machine legend buttons to hide or show individual machine lines on the overview trend graph.

#### 8. [js/analytics.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/analytics.js)
- **What it does:** Computes the mathematical summaries and populates the dashboard tabs with statistics, heatmaps, and graphs.
- **Code-Blocks:**
  - `renderPage(page)`: Runs a page renderer if the filters have changed since the last draw.
  - `renderOverview()`: Renders the OVERVIEW page. Computes total shifts, total tonnage, coils, average availability, draws Pareto charts, shift distributions, and machine circular availability gauges.
  - `renderProduction()`: Renders the PRODUCTION page. Shows highest shift records, top operators, and draws daily production charts.
  - `renderProdTable()`: Builds the searchable, filterable shift log table on the production page.
  - `renderTeamAnchageSection()`: Builds advanced team-vs-operator tonnage charts, stacked bar charts, and performance tables.
  - `renderDelays()`: Renders the DELAY ANALYSIS page. Calculates Pareto percentages, top delay lists, and builds the operator-vs-delay-type heatmap.
  - `renderMaintenance()`: Renders the MAINTENANCE page. Calculates MTBF, MTTR, MTTF, and lists breakdown history.
  - `renderAvailability()`: Renders the AVAILABILITY page. Draws gauges, availability trends over time, and a shift-vs-operator pivot table.
  - `renderML()`: Renders the ML PREDICTIONS page. Runs the client-side breakdown interval predictor (EWA) and draws rolling breakdown trends.

#### 9. [js/rul_client.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/rul_client.js)
- **What it does:** Gathers client data, formats it into a JSON packet, calls the Python API, and draws the Remaining Useful Life (RUL) prediction cards. **v2** adds 6 new features and renders classifier risk classes with probability bars.
- **Code-Blocks:**
  - `buildRULPayload(machine, records)`: Computes **18 numerical features** (12 original + 6 new v2: `breakdown_streak`, `delay_acceleration`, `availability_trend`, `tonnage_efficiency`, `time_since_maintenance`, `breakdown_severity_avg`). Also uses expanded breakdown keywords including FAILURE, REPAIR, FAULT, TRIP.
  - `fetchRULPrediction(payload)`: Performs a `POST` request to `https://tsdpl-api.onrender.com/predict` with the calculated features.
  - `renderRULCard(prediction, containerId)`: **v2**: Draws a RUL card with risk class badges (IMMINENT/SOON), probability distribution bars for each class, feature contribution bars, model version badge, and risk score indicator.
  - `renderRULPredictions()`: Filters active machines (only machines with uploaded data), shows a loading spinner, requests predictions, and hides empty cards.

#### 10. [js/delay_entry.js](file:///c:/TSDPL/week5/TSDPL_DELAY2/js/delay_entry.js)
- **What it does:** Logic controller for the Operator Delay Entry Terminal, managing form creation, login gating, dynamic dropdown loading, alphanumeric validation, database integration, and log persistence.
- **Code-Blocks:**
  - `getISTDateTime()`: Calculates the current Date and Shift (Shift A: 06:00-14:00, Shift B: 14:00-22:00, Shift C: 22:00-06:00 IST) based on the system clock.
  - `handleLogin(event)`: Validates credentials and gates dashboard view by user role (Operator or Admin).
  - `setupOperatorForm(line)`: Pre-fills and locks the machine line selection and auto-sets the read-only Date and Shift.
  - `addOperatorDelayEntry()`: Appends a new delay log entry row with cascading selects dynamically loaded from Sheet 3 reference data for the operator's line.
  - `submitOperatorForm()`: Checks for duplicates in Supabase to guard against double-submits, validates inputs (non-negative tonnage/coils, positive minutes, alphanumeric-only description for "OTHER" reasons), posts to the local backend, saves locally in `localStorage`, inserts the log record into Supabase via `saveOperatorLogToSupabase(logEntry)`, and opens the Export modal.
  - `saveOperatorLogToSupabase(logEntry)`: Formats the operator log entry and performs an insert query to the `delay_logs` table in Supabase.
  - `loadAdminLogs()`: Fetches operator logs to render a unified audit table in the Admin panel.

---

### 🔮 Python Machine Learning Backend (rul_tsdpl/ & anomaly_detector/)

#### 11. [rul_tsdpl/feature_engineering.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/rul_tsdpl/feature_engineering.py)
- **What it does:** **v2 Overhaul** — Computes features at **shift level** (every shift gets a RUL prediction, not just breakdown events). Produces `rul_features_v2.csv` with **19 features** and a `risk_class` column for classification.
- **Key v2 Changes:**
  - **Shift-level targets**: Every shift gets `rul_days` = days until next breakdown from that shift's date (1203 samples vs old 402).
  - **Expanded breakdown keywords**: Added FAILURE, REPAIR, FAULT, TRIP to the detection list.
  - **6 new features**: `breakdown_streak` (consecutive breakdown days), `delay_acceleration` (7d/30d delay ratio), `availability_trend` (slope over 7 days), `tonnage_efficiency` (vs historical mean), `time_since_maintenance` (days since last planned stop), `breakdown_severity_avg` (avg breakdown duration in 30d).
  - **Risk classification**: Adds `risk_class` column — IMMINENT (<=1 day), SOON (1-3 days), SAFE (>3 days).
- **Code-Blocks:**
  - `load_raw(filepath)`: Loads a single Excel sheet, normalizes column names, forward-fills empty shift rows, parses dates, and calculates availability.
  - `is_breakdown(row)`: Returns `True` if a row represents an unplanned failure (expanded keyword matching).
  - `_aggregate_shifts(df, machine)`: Aggregates raw delay rows into one row per shift-date with total delay, tonnage, breakdown flags.
  - `_compute_shift_rul(shifts, bd_dates)`: For each shift, finds the next breakdown date and computes days-to-failure.
  - `build_features(shifts, all_shifts_raw)`: Computes all 19 features from historical windows before each shift.
  - `add_risk_class(df)`: Labels shifts as IMMINENT/SOON/SAFE based on RUL threshold.
  - `build_full_dataset(data_dir)`: Runs the pipeline across all three machine lines.

#### 12. [rul_tsdpl/train.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/rul_tsdpl/train.py)
- **What it does:** **v2 Dual-Model Training** — Trains two models with proper evaluation and class imbalance handling.
- **v2 Architecture:**
  - **Classifier (primary)**: `GradientBoostingClassifier` with **SMOTE** oversampling to balance IMMINENT (94%) vs SOON (6%). Achieves **F1-macro: 0.929, Accuracy: 98%** on held-out test set.
  - **Regressor (secondary)**: `GradientBoostingRegressor` with log-transformed target (`log1p(rul_days)`) and inverse-frequency sample weighting.
  - **Proper evaluation**: Stratified 80/20 train/test split, 5-fold stratified CV, classification report with confusion matrix.
  - **Feature importances are now non-zero!** Top: `machine_id` (0.30), `avg_avail_7d` (0.10), `days_since_last_bd` (0.07).
- **Code-Blocks:**
  - `train(df)`: Orchestrates the full pipeline — encodes labels, splits data, trains both models, saves artifacts.
  - `train_classifier(X_train, y_train, X_test, y_test, le)`: SMOTE resampling + GBC training + CV + test evaluation.
  - `train_regressor(X_train, y_train, X_test, y_test)`: Log-transform + weighted GBR training + CV + test evaluation.
  - `compute_sample_weights(y)`: Inverse-frequency weighting so rare high-RUL samples get more attention.

#### 13. [rul_tsdpl/api.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/rul_tsdpl/api.py)
- **What it does:** The FastAPI web server. **v2** loads both the classifier and regressor, returning risk classifications alongside RUL estimates. Falls back gracefully to legacy v1 model if v2 files aren't present.
- **v2 Changes:**
  - Response now includes `risk_class` (IMMINENT/SOON), `risk_probability` (per-class probabilities), and `model_version`.
  - Request accepts 6 new optional features with backward-compatible defaults.
  - Confidence is now based on classifier probability margin (not just training row count).
- **Code-Blocks:**
  - `health()`: `GET /health` endpoint — now shows model version and whether v2 dual models are active.
  - `model_info()`: `GET /model-info` endpoint that returns v2 classification report, confusion matrix, and feature importances.
  - `predict(req)`: `POST /predict` endpoint. Runs both classifier (risk class) and regressor (RUL days), merges results into a unified response.
  - `upload_data(machine, data)`: `POST /api/upload-data` endpoint. Saves parsed JSON shifts.
  - `get_data()`: `GET /api/get-data` endpoint. Returns all stored shifts.
  - `operator_log(log_entry)`: `POST /api/operator-log` endpoint. Appends operator delay entries.
  - `get_operator_logs()`: `GET /api/operator-logs` endpoint. Loads operator logs for admin review.
  - `risk_class_to_band(risk_class)`: Maps classifier output (IMMINENT/SOON) to dashboard risk band (RED/AMBER/GREEN).
  - `build_advice(rul, band, risk_class, req)`: Generates human-friendly warning messages including risk class and breakdown streak info.
  - `top_feature_contributions(feature_vector, model)`: Returns top-5 features driving the prediction (now non-zero!).

#### 13. [anomaly_detector/feature_engineering.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/anomaly_detector/feature_engineering.py)
- **What it does:** Converts raw shift rows into 27 engineered features for anomaly detection.
- **Code-Blocks:**
  - `engineer_features(df)`: Calculates 27 features per shift, including:
    - *Time:* Month, day of week encoded as cyclic sine/cosine variables.
    - *Productivity:* Availability percentage, target efficiency, and tonnes per hour.
    - *Delays:* Ratios of planned, breakdown, and other delays.
    - *Rolling stats:* Rolling averages and deviations (Z-score style) of the last 3 and 7 shifts.
    - *Operator baseline:* Z-score deviations comparing this shift to the incharge's historical median production and delay times.

#### 14. [anomaly_detector/anomaly_detector.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/anomaly_detector/anomaly_detector.py)
- **What it does:** Isolation Forest pipeline wrapper.
- **Code-Blocks:**
  - `fit(df, feature_cols)`: Normalizes features using a `RobustScaler` (outlier-resistant) and trains the **Isolation Forest** model to detect anomalies.
  - `predict(df, feature_cols)`: Scores shifts. Inverts the Isolation Forest scores so that higher scores mean "more weird."
  - `_explain(X_scaled)`: Calculates the top 3 contributing factors for an anomaly by measuring which features deviated most from their historical training medians.
  - `save()` and `load()`: Methods to save the scaler, model, and column names to disk, or load them on server startup.

#### 15. [anomaly_detector/api_router.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/anomaly_detector/api_router.py)
- **What it does:** API endpoint controller for anomaly detection, integrated into the main FastAPI server.
- **Code-Blocks:**
  - `detect_anomalies(records)`: `POST /api/anomaly/detect`. Receives a batch of shifts, extracts the 27 features, scales them, scores them, and returns labeled anomalies with driver reasons.
  - `retrain_model(records, contamination)`: `POST /api/anomaly/retrain`. Re-trains the Isolation Forest model on historical shift data (requires at least 30 shifts).
  - `model_info()`: `GET /api/anomaly/model-info` to fetch details on the trained model.

#### 16. [anomaly_detector/test_anomaly_detector.py](file:///c:/TSDPL/week5/TSDPL_DELAY2/anomaly_detector/test_anomaly_detector.py)
- **What it does:** Self-contained unit tests.
- **Code-Blocks:**
  - `make_synthetic_shifts()`: Generates synthetic shift logs (normal production vs shifts with massive delays and zero tonnage) to validate training.
  - `test_*()`: Code blocks verifying feature shape, model saving, and testing that anomalous shifts score higher than normal shifts.

---

## 🧮 5. Key Formulas & Calculations (Explained Simply)

Here are the math equations used in the project:

### 1. Shift Availability (%)
*How much of the 8-hour shift (480 minutes) was the machine available to run?*
$$\text{Availability} = \frac{480 - (\text{Total Delay} - \text{"OTHER" Delay})}{480} \times 100$$
*(Note: "OTHER" delays are excluded from downtime calculations per plant guidelines).*

### 2. Availability Till Date
*Cumulative availability over the entire period:*
$$\text{Availability Till Date} = \frac{(\text{Total Shifts} \times 480) - \text{Maintenance Breakdown Minutes}}{\text{Total Shifts} \times 480} \times 100$$

### 3. MTBF (Mean Time Between Failures)
*How often does the machine break down on average?*
$$\text{MTBF (days)} = \frac{\text{Sum of days between past breakdowns}}{\text{Number of breakdown intervals}}$$

### 4. MTTR (Mean Time To Repair)
*How long does it take to fix a breakdown on average?*
$$\text{MTTR (minutes)} = \frac{\text{Sum of breakdown delay minutes}}{\text{Number of breakdowns}}$$

### 5. Breakdown Risk Score (EWA)
*Heuristic indicator on the ML Predictions page:*
$$\text{Risk Score} = \min\left(100, \frac{\text{Days since last breakdown}}{\text{Average MTBF}} \times 100\right)$$
- **0 - 33%:** 🟢 Low risk.
- **34 - 66%:** 🟡 Moderate risk (wear is accumulating).
- **67 - 100%:** 🔴 High risk (breakdown is overdue).

---

## 🔌 6. API Reference (How Frontend & Backend Communicate)

When the browser requests predictions, it calls these API endpoints on the hosted server `https://tsdpl-api.onrender.com`:

### RUL Predictor: `POST /predict` (v2 Dual Model)
- **Request Body (JSON):**
  ```json
  {
    "machine": "WCTL-1",
    "mtbf_days": 2.6, "mtbf_std": 8.22, "mtbf_trend": -0.5,
    "mttr_min": 25.9, "days_since_last_bd": 2.1, "bd_freq_30d": 11,
    "avg_avail_7d": 88.5, "avg_avail_30d": 90.1, "avg_tonnage_7d": 232.0,
    "delay_min_7d": 865.0, "delay_min_30d": 1135.0, "delay_diversity": 3,
    "breakdown_streak": 2, "delay_acceleration": 1.3,
    "availability_trend": -0.5, "tonnage_efficiency": 0.85,
    "time_since_maintenance": 5.0, "breakdown_severity_avg": 45.0
  }
  ```
- **Response Body (JSON) — v2:**
  ```json
  {
    "machine": "WCTL-1",
    "rul_days": 1.5,
    "risk_class": "IMMINENT",
    "risk_probability": { "IMMINENT": 0.92, "SOON": 0.08 },
    "risk_band": "RED",
    "risk_score": 90,
    "confidence": "HIGH",
    "advice": "URGENT - WCTL-1 classified as IMMINENT. Predicted failure in ~2 day(s).",
    "feature_contributions": {
      "machine_id": 0.15, "avg_avail_7d": 0.12, "days_since_last_bd": 0.08,
      "delay_min_30d": 0.06, "mtbf_days": 0.05
    },
    "model_version": "2.0"
  }
  ```

### Anomaly Detector: `POST /api/anomaly/detect`
- **Request Body (JSON):**
  ```json
  [
    {
      "shift_date": "2026-05-15",
      "shift": "A",
      "line": "WCTL-1",
      "incharge": "NAGESHWAR REDDY",
      "production_tonnes": 150.0,
      "available_hours": 8.0,
      "delay_minutes": 240.0,
      "breakdown_count": 2,
      "delay_breakdown": 180.0,
      "delay_planned": 30.0,
      "delay_other": 30.0,
      "target_tonnes": 460.0
    }
  ]
  ```
- **Response Body (JSON):**
  ```json
  {
    "total_shifts": 1,
    "anomaly_count": 1,
    "results": [
      {
        "shift_date": "2026-05-15",
        "shift": "A",
        "line": "WCTL-1",
        "incharge": "NAGESHWAR REDDY",
        "anomaly_score": 0.912,
        "is_anomaly": true,
        "top_drivers": ["delay_ratio", "efficiency", "avg_breakdown_dur"]
      }
    ]
  }
  ```

### Shared Spreadsheet Storage: `POST /api/upload-data`
- **Query Params:** `machine=SLITTER` (or `WCTL-1`, `WCTL-2`)
- **Request Body (JSON):** Array of shift logs parsed by the frontend.
- **Response:** `{"status": "ok", "message": "Data for SLITTER saved successfully"}`

### Shared Spreadsheet Retrieval: `GET /api/get-data`
- **Response:** Merged array of all shifts stored on the server's disk.

### Operator Delay Entry: `POST /api/operator-log`
- **Request Body (JSON):**
  ```json
  {
    "timestamp": "2026-06-08T23:50:00Z",
    "employeeId": "OP-SLIT-01",
    "machine": "SLITTER",
    "date": "08.06.2026",
    "shift": "A",
    "incharge": "SUNIL PRADHAN",
    "team": "SUJIT & TEAM",
    "tonnage": 300.5,
    "coils": 10,
    "startTime": "06:00",
    "endTime": "14:00",
    "totalDelayMin": 15,
    "delays": [
      {
        "time": 15,
        "type": "SETUP DELAY",
        "description": "FELT PAD CHANGE",
        "reason": "FELT PAD CHANGE"
      }
    ]
  }
  ```
- **Response:** `{"status": "ok", "message": "Operator log saved successfully"}`

### Operator Logs Retrieval: `GET /api/operator-logs`
- **Response:** Array of all operator logs submitted to date.

---

## 🚀 7. Running Guide (Step-by-Step)

Follow these simple steps to run the project on your machine:

### Step 1: Install Python Dependencies
Open your Command Prompt (cmd) or PowerShell, go to the project directory, and run:
```bash
pip install pandas openpyxl scikit-learn fastapi uvicorn joblib imbalanced-learn
```

### Step 2: Train the AI Models (One-Time Setup)
To build the v2 shift-level training table and train the dual RUL classifier + regressor:
```bash
cd rul_tsdpl
python train.py --data ../sampledata
```
Expected output: Classifier F1-macro ~0.93, 98% accuracy, non-zero feature importances, models saved as `rul_classifier_v2.pkl` and `rul_regressor_v2.pkl`.
Verify the anomaly detector tests run and pass:
```bash
python ../anomaly_detector/test_anomaly_detector.py
```

### Step 3: Start the Web Server (Optional for local testing)
Launch the FastAPI server locally:
```bash
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```
Keep this window open! The server is running at `http://127.0.0.1:8000`. For production, the API is hosted at `https://tsdpl-api.onrender.com`.

### Step 4: Open the Dashboard
Double-click `TSDPL_Dashboard.html` to open it in your browser.
1. Go to the **UPLOAD DATA** tab.
2. Drag and drop `WCTL-1 DELAY REPORT MAY-26.xlsx`, `WCTL-2 DELAY FEB-2026.xlsx`, or `SLITDELAY REPOERT MAR-2026.xlsx` from the `sampledata/` folder into their corresponding machine upload boxes.
3. Switch to any tab to view the live charts!

---

## 🛠️ 8. Troubleshooting Common Issues

- **RUL cards show "prediction unavailable" or "FastAPI server error":**
  Ensure the backend API at `https://tsdpl-api.onrender.com` (or local port `8000` if testing locally) is online and reachable. Note that Render free-tier web services automatically spin down after inactivity, so the first request might take 50-60 seconds to respond as the server spins back up. Check the browser's developer console (F12 key → Console tab) for details.
- **Anomalies return a 503 error or a 422 error:**
  * A 503 error means the anomaly model is not trained yet (requires uploading at least 30 shifts).
  * A 422 validation error indicates a schema mismatch. This was resolved by implementing a mapper in the frontend (`js/app.js`) to translate the nested UI shift logs structure into the flat `ShiftRecord` schema required by the FastAPI server.
- **WCTL-2 data is missing or not displaying when both WCTL-1 and WCTL-2 files are uploaded:**
  This was resolved by removing a hard coding limit (`allDelays.length < 200` and `maintEvents.length < 200`) in `js/analytics.js` which caused WCTL-2 rows to be silently ignored if WCTL-1 data already filled the array slots.
- **Excel file fails to upload or parse:**
  Ensure the Excel sheet contains column headers matching Date, Shift, and Incharge on Row 2 (the system uses `header=1` which skips Row 1).

---

## 📋 9. Verification of Plant Dashboard Specifications

The system is fully aligned with the required changes specified in `delaydashboard.pdf` and `README_CONSOLIDATION_SUMMARY.txt`. Here is how they are verified:

### 1. Delay Types & "Zyada" Exclusions
- **Complete Mapping**: Mapped raw text entries to 11 standardized categories: `MAINTENANCE BREAKDOWN`, `MAINTENANCE DAILY CHECKLIST`, `PLANNED MAINTENANCE`, `COIL FEEDING DELAY`, `PACKAGE SHIFTING`, `PACKAGING DELAY`, `QUALITY DELAY`, `CRANE DELAY`, `SETUP DELAY`, `SCRAP REMOVAL`, `SCRAP SCHEDULE`, `SHIFT HANDOVER`, `TBT`, `OPERATION DELAY`, `COMMUNICATION DELAY`, `HR DELAY`, `SCHEDULE DELAY`, and `OTHER`. (Located in `js/filters.js` inside `normDelay()`).
- **Zyada Exclusion**: The availability percentage equation excludes `OTHER` delays (`getDowntimeExcludingOther()` in `js/filters.js`). This ensures that non-operational delays do not negatively penalize a machine's primary availability score.

### 2. Team-wise & Incharge (Anchage) Graphs
- **Data Aggregation**: Tonnage is aggregated both team-wise and operator-wise (shift incharge) across shifts (`js/analytics.js` inside `renderTeamAnchageSection()`).
- **Visualizations**: 
  - **Team-wise Tonnage Detail Chart**: Displays cumulative tonnage and average output per shift.
  - **Incharge-wise Total Tonnage Chart**: Horizontal bar chart showing total operator throughput.
  - **Team-wise Stacked Tonnage by Line Chart**: Breakdown of team performance across the three lines.
  - **Incharge-wise Avg Tonnage Chart**: Highlights who averages the highest output per shift.

### 3. Total Downtime from Maintenance Breakdown Only
- **Primary Downtime**: All key KPI panels (Overview, Delay Analysis) prioritize Maintenance Breakdown downtime over overall delay minutes.
- **Description Keyword Fallback**: The parser (`js/filters.js` inside `getMaintenanceBreakdownDowntime()`) automatically reviews raw description text for keywords like `breakdown`, `failure`, `repair`, `fault`, or `trip` to classify breakdowns correctly, even if the primary category was not explicitly marked.

### 4. Availability Till Date Formula
- **Calculations**: Implements the formula `Availability = (Shifts * 480) - Breakdown Downtime` (`js/analytics.js` inside `calculateAvailabilityTillDate()`). It computes both the available minutes and the percentage relative to planned minutes.
- **Display**: Shown prominently on the Overview KPI strip and the Availability tab.

### 5. Date Parsing & Deduplication
- **Strict Format Detection**: Resolves messy user dates (dots, slashes, dashes, serial codes) and formats them strictly into `DD.MM.YYYY` in `js/parser.js`.
- **Deduplication**: Aggregates records by `date|shift|incharge|team` to prevent multiple entries for the same shift date.
- **Warnings**: Generates clear logs in the upload tab when a row contains dates in the future or prior to the year 2000.

### 6. Shift Incharge Production
- **Visuals**: Displays the total production tonnage by shift incharge in the Overview tab (`chart-incharge-tonnage`) and calculates average and shift count metrics.

### 7. Overview Incharge Tonnage Logic
- **Default State**: If no files are uploaded, a default sum of all 3 lines (3600 MT representing 1200 MT per line) is displayed for the top 5 supervisors (`js/analytics.js` inside `getProductionByShiftIncharge()`).
- **Uploaded State**: Once files are loaded, the default state is overridden to display live line-wise sums of total tonnage.

---

## 🔍 10. Advanced Filter & Sorting Capabilities

To make searching and analyzing shift records and delay logs as easy as possible, the dashboard has been upgraded with **two powerful filter panels** built directly into the data logs.

### 1. Production Log Table Filters (on the Production Tab)
You can filter the table of shift production entries using any combination of the following criteria:
* **🔍 Search Input**: Type a supervisor's name, team name, date, or machine to dynamically narrow down rows.
* **All Users / Shift Supervisor Only**: Quickly isolate official supervisors from the rest of the crew.
* **All Shifts**: Filter by Shift A (Morning), Shift B (Afternoon), or Shift C (Night).
* **All Machines**: Filter by WCTL-1, WCTL-2, or SLITTER.
* **Availability Thresholds**: Filter shifts based on machine availability:
  * **High (> 85%)**: Highlight high-performance shifts.
  * **Medium (70–85%)**: Highlight shifts with minor delay disruptions.
  * **Low (< 70%)**: Flag shifts with significant maintenance or operational delays.
* **Sort Dropdown**: Sort rows by Date, Tonnage (Highest First/Lowest First), Delay Minutes, or Availability (Lowest First).
* **↺ RESET Button**: Instantly clears all text inputs and dropdowns back to their default states.
* **Dynamic Record Counter**: Shows a label like `45 of 215 shifts` so you know exactly how many entries match your query.

### 2. Delay Log Table Filters (on the Delay Analysis Tab)
You can deep-dive into specific categories of downtime using these filters:
* **🔍 Search Input**: Search by operator, raw descriptions (e.g. "hydraulic pump"), or delay types.
* **All Machines**: Filter delays by machine.
* **All Shifts**: Filter delays by shift.
* **Multi-Select Category Chips (Interactive Pills)**: Instead of a rigid single-select dropdown, users have 13 interactive buttons corresponding to each delay category. Clicking individual category chips toggles them on/off, allowing you to filter the table by any combination of categories concurrently (e.g., viewing both *Maintenance* and *Crane* delays together). 
  * Each chip is custom-colored to match its Chart.js color palette representation.
  * Clicking **ALL** immediately deactivates other selections and displays all categories.
  * Deactivating all filters automatically defaults back to activating **ALL**.
* **Sort Dropdown**: Sort delays by Date, Duration (Highest First/Lowest First), or alphabetically by Delay Type.
* **↺ RESET Button**: Resets all filters (including the multi-select category chips back to 'ALL') and clears search inputs.
* **Dynamic Record Counter**: Displays matching count up to 500 records (e.g., `185 of 450 events`) to prevent browser table rendering bottlenecks.


---

## 🔐 11. Secure Login & Operator Logs Auditing

To ensure strict process control in a live plant, the application implements a role-based security gate at startup:

### 1. Predefined Logins
The system checks entered credentials against a secure list:
* **Operator IDs (Pre-assigned to Lines)**:
  * `OP-SLIT-01` (SLITTER Operator)
  * `OP-WCTL-01` (WCTL-1 Operator)
  * `OP-WCTL-02` (WCTL-2 Operator)
* **Admin IDs**:
  * `ADMIN01`, `ADMIN02`, `ADMIN03`, `ADMIN04`
* **Guest / View-only Access**:
  * Anyone can bypass the login gate by clicking **VIEW DASHBOARD (GUEST ACCESS)**. Guest users have view-only access to all dashboard pages, analytics, and predictions, but cannot submit operator logs or access the operator audit panel.

### 2. Operator Interface Controls
When an operator logs in:
* They are navigated to the **Delay Entry Terminal** and restricted from accessing the main admin charts.
* The **Production Line** selection is automatically locked to their machine (e.g., `SLITTER`).
* The **Date** and **Shift** are automatically computed in real-time using Indian Standard Time (IST) shift bounds (Shift A: 6am-2pm, Shift B: 2pm-10pm, Shift C: 10pm-6am) and made read-only.
* They enter mandatory shift stats (Incharge, Team, Tonnage, Coils, Start/End times) and downtime delay rows.

### 3. Admin Auditing Controls
When an admin logs in:
* They are navigated to the **Production Analytics Dashboard** with full access to files upload, trends, and ML cards.
* They gain access to a new **OPERATOR LOGS** tab.
* This tab queries the Supabase database directly to show a table of all active operator submissions, indicating who inputted what, when (server timestamp), tonnage, and individual downtime details.
* Admins can download the compiled log database as a CSV for reporting.
* **Promote to File Data**: Next to each operator entry in the logs table, Admins have a button `➕ ADD TO FILE DATA`. Clicking this updates the record's source to `'excel'` in Supabase, officially incorporating it into the file-uploaded dataset so that it remains permanently as part of the shared database.
* All operator entries automatically merge into `window.RAW_DATA` on page load, dynamically feeding the Overview, Delay Analysis, and Pareto graphs.


---

## 💾 12. Data Persistence & Date Range Visualization

To improve usability and eliminate repetitive work for administrators, the system includes native server-side persistence and real-time visualization:

### 1. Shift Date Range Visualization
When data is loaded or uploaded, the main upload card displays the specific date range covered by the shifts:
* **Date Range Computation**: Automatically parsed from `RAW_DATA` and displayed as `📅 Start Date — End Date` (e.g. `📅 01.10.2025 — 04.10.2025`).
* **Visual Styling**: Each card features a custom, themed glassmorphism badge matching the color code of the machine:
  * **SLITTER**: Cyan badge.
  * **WCTL-1**: Orange badge.
  * **WCTL-2**: Mint-green badge.

### 2. Auto-Load Persistence across Sessions
When an admin opens the dashboard:
* **Background Sync**: The app automatically queries the cloud-hosted Supabase database to fetch all stored shift logs.
* **Zero-config Load**: Once loaded, logs are restored into memory, anomaly detection is executed (via the local FastAPI server if active), and the user is redirected straight to the **OVERVIEW** tab populated with stats.
* **Realtime Updates**: The app subscribes to PostgreSQL changes on the `delay_logs` table via Supabase Realtime, automatically refreshing dashboard data when new operator logs are submitted.
* **Fallback**: Works offline gracefully via local in-memory simulation or local backend fallbacks if configured.

---

## ☁️ 13. Supabase Cloud Database Integration

The system uses a hosted Supabase PostgreSQL instance as its primary database. This allows real-time synchronization between operator submissions and the admin dashboard across different machines without relying on local files on a single PC.

### 1. Database Schema (`delay_logs` table)
The table is named `delay_logs` and contains the following columns:
* `id`: `int8` (Primary Key, Auto-incrementing)
* `machine`: `text` (e.g., `'SLITTER'`, `'WCTL-1'`, `'WCTL-2'`)
* `date`: `text` (format: `DD.MM.YYYY`)
* `shift`: `text` (e.g., `'A'`, `'B'`, `'C'`)
* `incharge`: `text` (Supervisor name)
* `team`: `text` (Operator team name)
* `tonnage`: `numeric` (Coil tonnage)
* `coils`: `int4` (Number of coils)
* `delays`: `jsonb` (List of delay rows: time, type, description, reason)
* `source`: `text` (typically `'operator'` or `'excel'`)
* `employee_id`: `text` (Employee ID of the operator)
* `start_time`: `text` (e.g., `'06:00'`)
* `end_time`: `text` (e.g., `'14:00'`)
* `timestamp`: `timestamptz` (Log submission timestamp)

### 2. Duplicate Submission Guard
When operators submit a downtime log, the system performs a pre-submission duplicate check on Supabase to verify if a record matching the same machine (`machine`), date (`date`), shift (`shift`), employee ID (`employee_id`), and source (`source`) already exists. If a match is found, the submission is blocked with an alert to prevent duplicate database rows.

### 3. Realtime Synchronisation
The dashboard subscribes to database updates using Supabase's Realtime channel:
```javascript
window.supabase
  .channel('delay_logs_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'delay_logs' }, (payload) => {
    // Reloads data from Supabase automatically when a change is detected
    loadFromSupabase();
  })
  .subscribe();
```



