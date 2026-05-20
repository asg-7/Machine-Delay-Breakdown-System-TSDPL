# TSDPL — RUL Prediction Module

## Files

| File | Purpose |
|------|---------|
| `feature_engineering.py` | Loads your Excel files, extracts breakdown events, engineers 13 features |
| `train.py` | Trains GradientBoostingRegressor, saves `rul_model.pkl` + metadata |
| `api.py` | FastAPI server exposing `/predict`, `/model-info`, `/health` |
| `rul_client.js` | Drop-in frontend module — calls API from your existing ML page |

---

## Setup

```bash
pip install fastapi uvicorn scikit-learn pandas openpyxl numpy
```

---

## Workflow

### Step 1 — Engineer features from your Excel files
```bash
cd rul_tsdpl/
python feature_engineering.py
# → writes rul_features.csv
```

### Step 2 — Train the model
```bash
python train.py --csv rul_features.csv
# OR point at sampledata/ directly:
python train.py --data ../sampledata
# → writes rul_model.pkl + rul_model_meta.json
```

### Step 3 — Start the API
```bash
uvicorn api:app --reload --port 8000
# API docs at: http://localhost:8000/docs
```

### Step 4 — Integrate frontend
Add to your `index.html` (after Chart.js):
```html
<script src="js/rul_client.js"></script>
```

Add three container divs to your ML page HTML:
```html
<div id="rul-card-wctl1"></div>
<div id="rul-card-wctl2"></div>
<div id="rul-card-slitter"></div>
```

Call from `analytics.js` ML tab renderer:
```js
renderRULPredictions();   // async, handles loading states internally
```

---

## The 13 Features

| Feature | Source | Why it matters |
|---------|--------|----------------|
| `mtbf_days` | Maintenance KPIs | Core reliability signal |
| `mtbf_std` | Maintenance KPIs | High variance = unpredictable machine |
| `mtbf_trend` | Maintenance KPIs | Shrinking MTBF = worsening health |
| `mttr_min` | Maintenance KPIs | Long repairs signal complex faults |
| `days_since_last_bd` | Event log | Proximity to expected next failure |
| `bd_freq_30d` | Event log | Acceleration of failure rate |
| `avg_avail_7d` | Availability tab | Short-term degradation signal |
| `avg_avail_30d` | Availability tab | Baseline health |
| `avg_tonnage_7d` | Production tab | Load stress proxy |
| `delay_min_7d` | Delay analysis | Short-term operational stress |
| `delay_min_30d` | Delay analysis | Chronic vs acute stress |
| `delay_diversity` | Delay analysis | Many fault types = systemic wear |
| `machine_id` | Upload (encoded) | Per-machine failure profile |

---

## Model choice rationale (for interviews)

**Why Gradient Boosting over a neural network?**
- Your dataset is small (tens to low hundreds of breakdown events)
- GBR handles small tabular data better than deep learning
- Feature importances are directly interpretable — you can explain every prediction
- Huber loss makes it robust to the outlier breakdown events in real plant data
- XGBoost / LightGBM are drop-in upgrades with the same interface once data grows

**What makes this resume-worthy:**
- Real industrial time-series, not a Kaggle toy dataset
- Proper feature engineering from domain knowledge (MTBF decay, rolling windows)
- End-to-end: data ingestion → feature store → model → REST API → live frontend
- Risk band with MTBF-relative thresholds (not arbitrary fixed numbers)
