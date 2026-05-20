# TSDPL Production Analytics Dashboard – Project Documentation & README

The **TSDPL Production Analytics Dashboard** is a high-performance, client-side, browser-based application designed for real-time monitoring, historical analysis, and predictive maintenance of a steel processing plant’s production lines. 

This system targets plant operations managers, shift supervisors, and maintenance teams, providing a unified view of production output, delay patterns, machine availability, and maintenance metrics.

---

## 1. Project Overview

### Core Purpose:
* **Production Visualization:** Aggregate and visualize shift-wise production data (tonnage, coils processed, delays).
* **Downtime Root Cause Analysis:** Identify delays through delay Pareto charts, timelines, and interaction heatmaps.
* **Reliability Metrics:** Compute Key Performance Indicators (KPIs) including Mean Time To Repair (MTTR), Mean Time Between Failures (MTBF), Mean Time To Failure (MTTF), and Availability percentage.
* **ML Predictions:** Generate Machine Learning-based risk scores using interval analysis to predict next breakdowns and recommend maintenance actions.

### Key Characteristics:
* **Fully Client-Side:** Runs entirely in a modern web browser with no server or database dependencies.
* **Modular Architecture:** Structured with separate stylesheets and JavaScript files for clean separation of concerns.
* **On-Demand Data Loading:** Parsed directly from Excel (`.xlsx`) or CSV (`.csv`) files using SheetJS.
* **Responsive Dark-Theme UI:** Interactive charting with Chart.js, dynamic pivot tables, and styled CSS metrics.

---

## 2. File Structure

The project is arranged into a clean, modular structure:

```text
c:\TSDPL\week5\TSDPL_DELAY2\
├── index.html                  # Main application layout and DOM skeleton
├── TSDP_dashboard_readme.md    # Complete system documentation (this file)
├── css/
│   └── style.css               # Unified stylesheet (colors, variables, responsive layout)
├── js/
│   ├── app.js                  # Main controller, event listeners, clock, and embedded RAW_DATA
│   ├── charts.js               # Dynamic Chart.js wrapper and instance cache manager
│   ├── filters.js              # Normalization, date helpers, filter application, and caching
│   ├── analytics.js            # KPI calculations, loop consolidations, and HTML logs rendering
│   └── parser.js               # SheetJS Excel/CSV parsing with O(1) hash matching
└── sampledata/                 # Pre-configured Excel sheets for lines WCTL-1, WCTL-2, and SLITTER
    ├── SLITDELAY REPOERT MAR-2026.xlsx
    ├── WCTL-1 DELAY REPORT MAY-26.xlsx
    └── WCTL-2 DELAY FEB-2026.xlsx
```

---

## 3. Technology Stack

| Category | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Core UI** | HTML5, CSS3, ES2020 JavaScript | Native | Web-standard structure, theming, and responsive grids. |
| **Charting** | Chart.js (via CDN) | 4.4.1 | mixed bar/line Pareto charts, doughnuts, line trends, and scatter. |
| **Excel Parser** | SheetJS / XLSX (via CDN) | 0.18.5 | Local file uploads and binary conversions to JS objects. |
| **Typography** | Google Fonts | - | Rajdhani, JetBrains Mono, and Barlow for a sleek, industrial aesthetic. |

---

## 4. Architectural & Optimization Highlights

The codebase uses a client-side **Model-View-Presenter (MVP)** pattern optimized for memory efficiency and low latency:

### ⚡ Performance Optimization Systems:

1. **O(1) Upload Parser Lookup (`js/parser.js`):**
   * *Problem:* Previously, shift matching used an O(N) array scan for every row in the spreadsheet, causing O(N²) quadratic scaling and browser freezes on files with >1,000 rows.
   * *Solution:* Refactored to index active shifts using a local Hash Map (`shiftMap`), changing the lookup time to O(1) and reducing parsing times from seconds to milliseconds.

2. **Preprocessing & Caching System (`js/filters.js`):**
   * *Problem:* Date string parsing and string capitalization normalization were performed repeatedly within rendering loops.
   * *Solution:* Implemented `prepareRawData()`, caching `_parsedDate`, `_normIncharge`, `totalDelayMin`, `availabilityPct`, and delays `_normType` fields upon initial data load/upload.

3. **Single-Pass Rendering Logic (`js/analytics.js`):**
   * *Problem:* Pages executed multiple loops (filtering, sorting, mapping, reducing) over `filteredData` to feed charts and KPI cards separately.
   * *Solution:* Consolidated page calculations into single-pass O(N) loops. For example:
     * **Overview Page:** Unified KPI cards, Pareto aggregation, shift doughnut distribution, and team bar datasets in one loop.
     * **ML Page:** Pre-sorted datasets once, used cached dates, and cached machine-date breakdowns in a hash map to remove nested quadratic lookups.

4. **Chart Instance Reuse (`js/charts.js`):**
   * *Problem:* Destroying and re-creating Chart.js instances caused browser memory leakage and layout reflow lags.
   * *Solution:* Modifed `mkChart()` to track chart instances inside `window.chartInstances`. It now updates datasets and configurations in-place, executing smooth animatons rather than rebuilding canvases.

5. **Tab Revision Guards (`js/analytics.js`):**
   * *Problem:* Switching tabs always forced recalculations and DOM replacements even if no filters changed.
   * *Solution:* Added filter revision tracking (`window.filterRevision` and `window.renderedRevisions[page]`). Pages skip rendering if filters have not changed since the last render.

6. **Debounced Production Search (`js/app.js`):**
   * *Problem:* Quick keystroke typing in the Production Log table search box fired heavy DOM updates on every character.
   * *Solution:* Applied a 250ms debounce wrapper to the listener and added an active tab check so rendering is bypassed if the user is on another page.

---

## 5. Detailed Features List

### 📊 Pages & Modules:

* **UPLOAD DATA:** Contains three distinct drop zones (WCTL-1, WCTL-2, and SLITTER) with status text showing loaded record counts and parser logs.
* **OVERVIEW:** Consolidates main metrics (tonnage, availability, uptime), line chart comparison of tonnage trends (with toggleable lines), a Pareto chart of downtime, shift share, and availability mini-conic gauges.
* **PRODUCTION:** Displays supervisor-filtered log tables, daily tonnage charts, team-wise tonnage, and shift comparisons.
* **DELAY ANALYSIS:** Displays Pareto breakdown of delays, heatmaps of incharges vs delay types, and chronological trend lines.
* **MAINTENANCE:** Tracks breakdowns, MTTR, MTBF, MTTF, duration charts, and historical logs.
* **AVAILABILITY:** Features per-machine trends, availability heatmaps, and pivot tables comparing shift times against incharges.
* **ML PREDICTIONS:** Computes next breakdown days, risk indicators, rolling 7-day windows, and auto-generated predictive advice cards.

---

## 6. Installation & Execution

1. **Clone/Download** the workspace directory `TSDPL_DELAY2`.
2. Double-click [index.html](file:///c:/TSDPL/week5/TSDPL_DELAY2/index.html) to open the dashboard directly in any modern browser (Chrome, Edge, Firefox). No local server is required.
3. Access the **UPLOAD DATA** tab to upload and parse any sheet from the `sampledata/` folder.

