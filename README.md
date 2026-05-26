# TSDPL Production Analytics & Predictive Maintenance System

A dashboard I built for a real steel plant to make sense of their shift logs — tracking machine downtime, operator performance, and using ML to predict when a machine is likely to fail next.

The plant operators fill out Excel sheets every shift. This system reads those sheets, cleans the messy data, and turns it into something actually useful — charts, KPIs, breakdown predictions, and anomaly alerts.

---

## What it does

- Drag-and-drop Excel shift logs for 3 machines (WCTL-1, WCTL-2, SLITTER) and the dashboard populates instantly
- Tracks availability, MTBF, MTTR, delay categories, and production per operator — all calculated in the browser
- Predicts **remaining useful life (RUL)** for each machine using a Gradient Boosting model trained on historical breakdown patterns
- Flags **weird shifts** — unusually low production or high downtime — using an Isolation Forest anomaly detector
- Filter everything: by shift, machine, operator, delay type, availability threshold, date range

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Chart.js, SheetJS |
| Backend API | Python, FastAPI, Uvicorn |
| ML Models | scikit-learn (Gradient Boosting, Isolation Forest) |
| Data | Real plant Excel shift logs (.xlsx) |

---

## Project Structure

```
TSDPL_DELAY2/
├── TSDPL_Dashboard.html       # The whole UI lives here
├── js/                        # Parser, filters, charts, analytics, RUL client
├── css/style.css              # Dark theme
├── rul_tsdpl/                 # RUL model — feature engineering, training, FastAPI server
├── anomaly_detector/          # Anomaly model — Isolation Forest pipeline + API
└── sampledata/                # Real plant Excel files to test with
```

---

## Running it locally

```bash
# Install dependencies
pip install pandas openpyxl scikit-learn fastapi uvicorn joblib

# Train the RUL model (only need to do this once)
cd rul_tsdpl && python train.py --data ../sampledata

# Start the API server
python -m uvicorn api:app --host 127.0.0.1 --port 8000

# Open TSDPL_Dashboard.html in your browser, upload a shift file, and you're in
```

---

## How the ML side works

The **RUL model** looks at 12 rolling features — things like average availability over the last 7 days, how often the machine broke down in the last 30 days, MTBF trend — and outputs how many days are likely left before the next failure, with a 🟢 / 🟡 / 🔴 risk band.

The **anomaly detector** computes 27 features per shift (Z-scores against the operator's own historical baseline, rolling deviation stats, delay ratios) and flags any shift that looks out of the ordinary — not just globally weird, but weird *for that specific operator on that machine*.

---

## Key formulas

- **Shift Availability** = `(480 − delay_minutes) / 480 × 100` — "OTHER" delays excluded per plant spec
- **Availability Till Date** = `(Shifts × 480 − Breakdown Minutes) / (Shifts × 480) × 100`
- **MTBF / MTTR** computed from actual logged breakdown events

---

*All Excel parsing happens client-side in the browser — no data leaves the machine.*
