/**
 * TSDPL — RUL API Client  (v2 — Dual Model Support)
 * ====================================================
 * Sends shift features to the RUL API and renders risk classification cards.
 * v2 adds 6 new features and renders classifier risk_class with probability bars.
 *
 * Depends on: AppState (Phase 4), your existing KPI helpers in analytics.js
 */

const RUL_API_BASE = "https://machine-delay-breakdown-system-tsdpl.onrender.com";   // change to deployed URL in production

// ──────────────────────────────────────────────
// 1. BUILD PAYLOAD FROM AppState
//    (mirrors what feature_engineering.py computes, but client-side)
// ──────────────────────────────────────────────

/**
 * Extract RUL feature payload for one machine from AppState.filteredData.
 * @param {string} machine  "WCTL-1" | "WCTL-2" | "SLITTER"
 * @param {Array}  records  AppState.filteredData for this machine
 * @returns {Object} payload matching PredictRequest schema (v2)
 */
function buildRULPayload(machine, records) {
  const now = new Date();
  const msPerDay = 86400000;

  // Sort ascending by date
  const sorted = [...records].filter(r => r._parsedDate).sort((a, b) => a._parsedDate - b._parsedDate);

  // Identify breakdown rows (checks delays array inside each shift record)
  const BREAKDOWN_KEYWORDS = ["MECH", "ELEC", "HYD", "MECHANICAL", "ELECTRICAL", "HYDRAULIC", "BREAKDOWN", "FAILURE", "REPAIR", "FAULT", "TRIP"];
  const isBreakdown = (r) => {
    if (!r.delays || !Array.isArray(r.delays)) return false;
    return r.delays.some(d => {
      const type = String(d._normType || d.type || "").toUpperCase();
      const desc = String(d.reason || d.description || "").toUpperCase();
      return type === "MAINTENANCE BREAKDOWN" || 
             BREAKDOWN_KEYWORDS.some(k => type.includes(k) || desc.includes(k));
    });
  };

  const breakdowns = sorted.filter(isBreakdown);

  // MTBF — intervals between breakdown dates
  let mtbfDays = 0, mtbfStd = 0, mtbfTrend = 0, daysSinceLastBD = 90;
  if (breakdowns.length >= 2) {
    const intervals = [];
    for (let i = 1; i < breakdowns.length; i++) {
      const diff = (breakdowns[i]._parsedDate - breakdowns[i - 1]._parsedDate) / msPerDay;
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length > 0) {
      mtbfDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const mean = mtbfDays;
      mtbfStd = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
      mtbfTrend = intervals.at(-1) - intervals[0];
    }
    daysSinceLastBD = (now - breakdowns.at(-1)._parsedDate) / msPerDay;
  } else if (breakdowns.length === 1) {
    daysSinceLastBD = (now - breakdowns[0]._parsedDate) / msPerDay;
  }

  // MTTR — mean breakdown minutes for breakdown rows
  const mttrMin = breakdowns.length > 0
    ? breakdowns.reduce((s, r) => s + (typeof getMaintenanceBreakdownDowntime === 'function' ? getMaintenanceBreakdownDowntime(r.delays) : (r.totalDelayMin || 0)), 0) / breakdowns.length
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
    w30.flatMap(r => r.delays ? r.delays.map(d => String(d._normType || d.type || '').toUpperCase().trim()) : []).filter(Boolean)
  );

  // ══════════════════════════════════════════════
  // NEW v2 FEATURES
  // ══════════════════════════════════════════════

  // 1. Breakdown streak: consecutive recent shifts with breakdowns
  let breakdownStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (isBreakdown(sorted[i])) {
      breakdownStreak++;
    } else {
      break;
    }
  }

  // 2. Delay acceleration: avg delay last 7d / avg delay last 30d
  const avgDelay7d = w7.length > 0 ? sum(w7, "totalDelayMin") / w7.length : 0;
  const avgDelay30d = w30.length > 0 ? sum(w30, "totalDelayMin") / w30.length : 1;
  const delayAcceleration = avgDelay7d / Math.max(avgDelay30d, 1);

  // 3. Availability trend: simple slope over last 7 days
  let availabilityTrend = 0;
  if (w7.length >= 2) {
    const avails = w7.map(r => r.availabilityPct ?? 100);
    const n = avails.length;
    const xMean = (n - 1) / 2;
    const yMean = avails.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (avails[i] - yMean);
      den += (i - xMean) ** 2;
    }
    availabilityTrend = den > 0 ? num / den : 0;
  }

  // 4. Tonnage efficiency: current vs historical mean
  const allTonnageMean = sorted.length > 0 ? avg(sorted, "tonnage") : 1;
  const currentTonnage = sorted.length > 0 ? (sorted.at(-1).tonnage || 0) : 0;
  const tonnageEfficiency = currentTonnage / Math.max(allTonnageMean, 1);

  // 5. Time since last maintenance (setup/planned delays)
  const MAINTENANCE_KEYWORDS = ["SETUP", "PLANNED", "MAINTENANCE", "PREVENTIVE"];
  let timeSinceMaintenance = 30;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i];
    if (r.delays && r.delays.some(d => {
      const type = String(d._normType || d.type || "").toUpperCase();
      return MAINTENANCE_KEYWORDS.some(k => type.includes(k));
    })) {
      timeSinceMaintenance = (now - r._parsedDate) / msPerDay;
      break;
    }
  }

  // 6. Breakdown severity average: avg duration of breakdown events in last 30d
  const bd30Shifts = w30.filter(isBreakdown);
  const breakdownSeverityAvg = bd30Shifts.length > 0
    ? bd30Shifts.reduce((s, r) => s + (r.totalDelayMin || 0), 0) / bd30Shifts.length
    : 0;

  return {
    machine,
    // Original 12 features
    mtbf_days:          parseFloat(mtbfDays.toFixed(2)),
    mtbf_std:           parseFloat(mtbfStd.toFixed(2)),
    mtbf_trend:         parseFloat(mtbfTrend.toFixed(2)),
    mttr_min:           parseFloat(mttrMin.toFixed(2)),
    days_since_last_bd: parseFloat(Math.min(daysSinceLastBD, 90).toFixed(2)),
    bd_freq_30d:        bd30,
    avg_avail_7d:       parseFloat(avg(w7,  "availabilityPct").toFixed(2)),
    avg_avail_30d:      parseFloat(avg(w30, "availabilityPct").toFixed(2)),
    avg_tonnage_7d:     parseFloat(avg(w7,  "tonnage").toFixed(2)),
    delay_min_7d:       parseFloat(sum(w7,  "totalDelayMin").toFixed(2)),
    delay_min_30d:      parseFloat(sum(w30, "totalDelayMin").toFixed(2)),
    delay_diversity:    delayTypes30.size,
    // New v2 features
    breakdown_streak:      breakdownStreak,
    delay_acceleration:    parseFloat(delayAcceleration.toFixed(3)),
    availability_trend:    parseFloat(availabilityTrend.toFixed(3)),
    tonnage_efficiency:    parseFloat(tonnageEfficiency.toFixed(3)),
    time_since_maintenance: parseFloat(timeSinceMaintenance.toFixed(2)),
    breakdown_severity_avg: parseFloat(breakdownSeverityAvg.toFixed(2)),
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
// 3. RENDER CARDS (v2 — with risk classification)
// ──────────────────────────────────────────────

function renderRULCard(prediction, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const BAND_COLOR = { RED: "#ef4444", AMBER: "#f59e0b", GREEN: "#22c55e" };
  const CLASS_ICON = { IMMINENT: "🔴", SOON: "🟡", SAFE: "🟢", UNKNOWN: "⚪" };
  const color = BAND_COLOR[prediction.risk_band] ?? "#6b7280";
  const icon  = CLASS_ICON[prediction.risk_class] ?? "⚪";

  // Top 3 feature contributions
  const topFeatures = Object.entries(prediction.feature_contributions || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Probability bars (v2)
  let probabilityHTML = '';
  if (prediction.risk_probability && Object.keys(prediction.risk_probability).length > 0) {
    const probEntries = Object.entries(prediction.risk_probability).sort((a, b) => b[1] - a[1]);
    const probBars = probEntries.map(([cls, prob]) => {
      const pct = (prob * 100).toFixed(1);
      const barColor = cls === "IMMINENT" ? "#ef4444" : cls === "SOON" ? "#f59e0b" : "#22c55e";
      return `
        <div style="display:flex;align-items:center;gap:8px;margin:2px 0;">
          <span style="font-size:11px;width:75px;color:#9ca3af;">${cls}</span>
          <div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px;transition:width 0.5s ease;"></div>
          </div>
          <span style="font-size:11px;width:40px;text-align:right;color:#cbd5e1;">${pct}%</span>
        </div>`;
    }).join('');
    probabilityHTML = `
      <div style="margin-top:12px;padding:10px;background:#0f172a;border-radius:8px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Risk Probability</div>
        ${probBars}
      </div>`;
  }

  // Feature contribution bars
  const featureBarsHTML = topFeatures.length > 0 ? `
    <div style="margin-top:10px;padding:10px;background:#0f172a;border-radius:8px;">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Key Drivers</div>
      ${topFeatures.map(([name, val]) => {
        const maxVal = topFeatures[0][1] || 1;
        const pct = Math.min((val / maxVal) * 100, 100).toFixed(0);
        return `
          <div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
            <span style="font-size:11px;width:140px;color:#9ca3af;">${name.replace(/_/g, " ")}</span>
            <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
            </div>
          </div>`;
      }).join('')}
    </div>` : '';

  // Model version badge
  const versionBadge = prediction.model_version
    ? `<span style="font-size:10px;padding:2px 6px;background:#1e293b;border-radius:4px;color:#64748b;">v${prediction.model_version}</span>`
    : '';

  container.innerHTML = `
    <div class="rul-card" style="border-left:4px solid ${color};padding:16px;margin-bottom:12px;background:#0f172a22;border-radius:0 8px 8px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0">${prediction.machine}</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          ${versionBadge}
          <span class="risk-badge" style="background:${color};color:#fff;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;">
            ${icon} ${prediction.risk_class || prediction.risk_band}
          </span>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:24px;align-items:baseline;">
        <div>
          <span style="font-size:32px;font-weight:700;">${prediction.rul_days}</span>
          <span style="font-size:13px;color:#9ca3af;margin-left:4px;">days</span>
        </div>
        <div style="font-size:12px;color:#64748b;">
          Risk Score: <strong style="color:${color}">${prediction.risk_score}</strong>/100
        </div>
      </div>

      ${probabilityHTML}

      <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#cbd5e1;">
        ${prediction.advice}
      </div>

      ${featureBarsHTML}

      <div style="margin-top:10px;font-size:11px;color:#64748b;display:flex;gap:12px;">
        <span>Confidence: <strong>${prediction.confidence}</strong></span>
      </div>
    </div>
  `;
}


// ──────────────────────────────────────────────
// 4. MAIN ENTRY — call from your ML tab renderer
// ──────────────────────────────────────────────

/**
 * Call this from your renderMLPage() in analytics.js
 */
async function renderRULPredictions() {
  const dataStore = (typeof RAW_DATA !== 'undefined') ? RAW_DATA : [];
  
  // Only show machines with actual uploaded data
  const uploadedMachines = [...new Set(dataStore.map(r => r.machine))];
  const allMachines = [
    { id: "WCTL-1",  data: dataStore.filter(r => r.machine === "WCTL-1"),   cardId: "rul-card-wctl1"   },
    { id: "WCTL-2",  data: dataStore.filter(r => r.machine === "WCTL-2"),   cardId: "rul-card-wctl2"   },
    { id: "SLITTER", data: dataStore.filter(r => r.machine === "SLITTER"), cardId: "rul-card-slitter" },
  ];
  
  // Hide cards for machines without data
  allMachines.forEach(({ cardId, id }) => {
    const card = document.getElementById(cardId);
    if (card && !uploadedMachines.includes(id)) {
      card.style.display = 'none';
    }
  });
  
  const machines = allMachines.filter(m => uploadedMachines.includes(m.id));

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
