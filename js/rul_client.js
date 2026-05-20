/**
 * TSDPL — RUL API Client
 * ========================
 * Drop this into your existing js/ folder as rul_client.js
 * Call renderRULPredictions() from your ML page tab renderer in analytics.js
 *
 * Depends on: AppState (Phase 4), your existing KPI helpers in analytics.js
 */

const RUL_API_BASE = "http://localhost:8000";   // change to deployed URL in production

// ──────────────────────────────────────────────
// 1. BUILD PAYLOAD FROM AppState
//    (mirrors what feature_engineering.py computes, but client-side)
// ──────────────────────────────────────────────

/**
 * Extract RUL feature payload for one machine from AppState.filteredData.
 * @param {string} machine  "WCTL-1" | "WCTL-2" | "SLITTER"
 * @param {Array}  records  AppState.filteredData for this machine
 * @returns {Object} payload matching PredictRequest schema
 */
function buildRULPayload(machine, records) {
  const now = new Date();
  const msPerDay = 86400000;

  // Sort ascending by date
  const sorted = [...records].filter(r => r._parsedDate).sort((a, b) => a._parsedDate - b._parsedDate);

  // Identify breakdown rows (mirrors your is_breakdown logic)
  const BREAKDOWN_KEYWORDS = ["MECH", "ELEC", "HYD", "MECHANICAL", "ELECTRICAL", "HYDRAULIC"];
  const isBreakdown = (r) =>
    BREAKDOWN_KEYWORDS.some(k => String(r.delay_type || r["Delay Type"] || "").toUpperCase().includes(k));

  const breakdowns = sorted.filter(isBreakdown);

  // MTBF — intervals between breakdown dates
  let mtbfDays = 0, mtbfStd = 0, mtbfTrend = 0, daysSinceLastBD = 999;
  if (breakdowns.length >= 2) {
    const intervals = [];
    for (let i = 1; i < breakdowns.length; i++) {
      const diff = (breakdowns[i]._parsedDate - breakdowns[i - 1]._parsedDate) / msPerDay;
      if (diff > 0) intervals.push(diff);
    }
    mtbfDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const mean = mtbfDays;
    mtbfStd = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
    mtbfTrend = intervals.at(-1) - intervals[0];
    daysSinceLastBD = (now - breakdowns.at(-1)._parsedDate) / msPerDay;
  } else if (breakdowns.length === 1) {
    daysSinceLastBD = (now - breakdowns[0]._parsedDate) / msPerDay;
  }

  // MTTR — mean delay_min for breakdown rows
  const mttrMin = breakdowns.length > 0
    ? breakdowns.reduce((s, r) => s + (r.totalDelayMin ?? r.delay_min ?? 0), 0) / breakdowns.length
    : 0;

  // Windows — 7d and 30d
  const t7  = new Date(now - 7  * msPerDay);
  const t30 = new Date(now - 30 * msPerDay);
  const w7  = sorted.filter(r => r._parsedDate >= t7);
  const w30 = sorted.filter(r => r._parsedDate >= t30);

  const avg = (arr, key) =>
    arr.length ? arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length : 0;

  const sum = (arr, key) =>
    arr.reduce((s, r) => s + (r[key] ?? 0), 0);

  const bd30 = w30.filter(isBreakdown).length;

  // Delay type diversity in last 30 days
  const delayTypes30 = new Set(
    w30.map(r => String(r.delay_type || r["Delay Type"] || "").toUpperCase().trim()).filter(Boolean)
  );

  return {
    machine,
    mtbf_days:          parseFloat(mtbfDays.toFixed(2)),
    mtbf_std:           parseFloat(mtbfStd.toFixed(2)),
    mtbf_trend:         parseFloat(mtbfTrend.toFixed(2)),
    mttr_min:           parseFloat(mttrMin.toFixed(2)),
    days_since_last_bd: parseFloat(Math.min(daysSinceLastBD, 999).toFixed(2)),
    bd_freq_30d:        bd30,
    avg_avail_7d:       parseFloat(avg(w7,  "availabilityPct").toFixed(2)),
    avg_avail_30d:      parseFloat(avg(w30, "availabilityPct").toFixed(2)),
    avg_tonnage_7d:     parseFloat(avg(w7,  "tonnage").toFixed(2)),
    delay_min_7d:       parseFloat(sum(w7,  "totalDelayMin").toFixed(2)),
    delay_min_30d:      parseFloat(sum(w30, "totalDelayMin").toFixed(2)),
    delay_diversity:    delayTypes30.size,
  };
}


// ──────────────────────────────────────────────
// 2. CALL API
// ──────────────────────────────────────────────

async function fetchRULPrediction(payload) {
  const res = await fetch(`${RUL_API_BASE}/predict`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }

  return res.json();  // matches PredictResponse schema
}


// ──────────────────────────────────────────────
// 3. RENDER CARDS
// ──────────────────────────────────────────────

function renderRULCard(prediction, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const BAND_COLOR = { RED: "#ef4444", AMBER: "#f59e0b", GREEN: "#22c55e" };
  const color = BAND_COLOR[prediction.risk_band] ?? "#6b7280";

  const topFeature = Object.entries(prediction.feature_contributions)
    .sort((a, b) => b[1] - a[1])[0];

  container.innerHTML = `
    <div class="rul-card" style="border-left: 4px solid ${color}; padding: 16px; margin-bottom: 12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0">${prediction.machine}</h3>
        <span class="risk-badge" style="background:${color}; color:#fff; padding:4px 10px; border-radius:999px; font-size:13px;">
          ${prediction.risk_band} · Score ${prediction.risk_score}
        </span>
      </div>

      <div style="margin-top:12px; font-size:28px; font-weight:700;">
        ${prediction.rul_days} days
        <span style="font-size:13px; font-weight:400; color:#9ca3af;">predicted RUL</span>
      </div>

      <div style="margin-top:10px; font-size:13px; line-height:1.6;">
        ${prediction.advice}
      </div>

      <div style="margin-top:10px; font-size:12px; color:#9ca3af;">
        Confidence: <strong>${prediction.confidence}</strong>
        &nbsp;·&nbsp;
        Key driver: <strong>${topFeature ? topFeature[0].replace(/_/g, " ") : "—"}</strong>
      </div>
    </div>
  `;
}


// ──────────────────────────────────────────────
// 4. MAIN ENTRY — call from your ML tab renderer
// ──────────────────────────────────────────────

/**
 * Call this from your renderMLPage() in analytics.js
 * Replace AppState.wctl1Data etc. with your actual state references.
 */
async function renderRULPredictions() {
  const dataStore = (typeof RAW_DATA !== 'undefined') ? RAW_DATA : [];
  const machines = [
    { id: "WCTL-1",  data: dataStore.filter(r => r.machine === "WCTL-1"),   cardId: "rul-card-wctl1"   },
    { id: "WCTL-2",  data: dataStore.filter(r => r.machine === "WCTL-2"),   cardId: "rul-card-wctl2"   },
    { id: "SLITTER", data: dataStore.filter(r => r.machine === "SLITTER"), cardId: "rul-card-slitter" },
  ];

  for (const { id, data, cardId } of machines) {
    const card = document.getElementById(cardId);
    if (card) card.innerHTML = `<div style="color:#9ca3af;font-size:13px;">Loading ${id}…</div>`;

    if (!data || data.length === 0) {
      if (card) card.innerHTML = `<div style="color:#9ca3af;font-size:13px;">${id}: no data uploaded</div>`;
      continue;
    }

    try {
      const payload    = buildRULPayload(id, data);
      const prediction = await fetchRULPrediction(payload);
      renderRULCard(prediction, cardId);
    } catch (err) {
      console.error(`RUL prediction failed for ${id}:`, err);
      if (card) card.innerHTML = `
        <div style="color:#ef4444;font-size:13px;">
          ${id}: prediction unavailable — ${err.message}
        </div>`;
    }
  }
}

// Export if using ES modules
// export { renderRULPredictions, buildRULPayload };
