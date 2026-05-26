// Availability formula: (480 - totalDelay excl. OTHER) / 480 * 100
// OTHER delays are excluded from the availability/downtime KPIs
function getAvailability(shift){
  if (shift.availabilityPct !== undefined) return shift.availabilityPct;
  const td = typeof getDowntimeExcludingOther === 'function'
    ? getDowntimeExcludingOther(shift.delays)
    : shift.delays.reduce((s,d)=>s+d.time,0);
  return Math.max(0,((480-td)/480*100));
}

/**
 * Availability Till Date  (plant formula)
 * = (No. of shifts × 480 min) − Maintenance Breakdown downtime
 * Example: 20 shifts → 20 × 480 = 9600 min planned; minus breakdown = available minutes.
 *
 * @param {number} shiftsCount     - total shifts in the selected date range
 * @param {number} maintBdMinutes  - total maintenance breakdown downtime (minutes)
 * @returns {{ totalPlanned, availMinutes, availPct }}
 */
function calculateAvailabilityTillDate(shiftsCount, maintBdMinutes) {
  const totalPlanned = shiftsCount * 480;
  const availMinutes = Math.max(0, totalPlanned - maintBdMinutes);
  const availPct     = totalPlanned > 0 ? (availMinutes / totalPlanned) * 100 : 0;
  return { totalPlanned, availMinutes, availPct };
}


function renderPage(page){
  if (!window.renderedRevisions) {
    window.renderedRevisions = {};
  }
  const rev = window.filterRevision || 0;
  if (window.renderedRevisions[page] === rev) {
    return;
  }
  window.renderedRevisions[page] = rev;

  if(page==='overview') renderOverview();
  else if(page==='production') renderProduction();
  else if(page==='delays') renderDelays();
  else if(page==='maintenance') renderMaintenance();
  else if(page==='availability') renderAvailability();
  else if(page==='ml') renderML();
}

// ══════════════════════════════════
//  OVERVIEW
// ══════════════════════════════════
function renderOverview(){
  const d = filteredData;
  let ton = 0;
  let coils = 0;
  let totalDelay = 0;
  let maintBreakdownDelay = 0;   // PRIMARY: maintenance breakdown only
  let availSum = 0;
  const dateMap = {};
  const delayTotals = {};
  const shiftTon = {A:0, B:0, C:0};
  const teamTon = {};
  const availByMachine = {'WCTL-1': {sum:0, count:0}, 'WCTL-2': {sum:0, count:0}, 'SLITTER': {sum:0, count:0}};

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    ton += r.tonnage;
    coils += r.coils;
    
    const rDelay = r.totalDelayMin !== undefined ? r.totalDelayMin : r.delays.reduce((a,b)=>a+b.time,0);
    totalDelay += rDelay;
    maintBreakdownDelay += typeof getMaintenanceBreakdownDowntime === 'function'
      ? getMaintenanceBreakdownDowntime(r.delays)
      : 0;
    
    const rAvail = getAvailability(r);
    availSum += rAvail;

    // Trend chart map
    const dt = r.date;
    if(!dateMap[dt]) dateMap[dt]={};
    if(!dateMap[dt][r.machine]) dateMap[dt][r.machine]=0;
    dateMap[dt][r.machine] += r.tonnage;

    // Pareto map
    for (let j = 0; j < r.delays.length; j++) {
      const dl = r.delays[j];
      const t = dl._normType;
      delayTotals[t] = (delayTotals[t] || 0) + dl.time;
    }

    // Shift share
    if(shiftTon[r.shift]!==undefined) shiftTon[r.shift] += r.tonnage;

    // Team-wise tonnage
    const key = (r.team||r.Team||'').trim()||'Unassigned';
    teamTon[key] = (teamTon[key]||0) + r.tonnage;

    // Availability by machine
    if (availByMachine[r.machine]) {
      availByMachine[r.machine].sum += rAvail;
      availByMachine[r.machine].count++;
    }
  }

  const avail = d.length ? availSum / d.length : 0;

  const atdOverview = calculateAvailabilityTillDate(d.length, maintBreakdownDelay);

  document.getElementById('kpi-overview').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--accent)">
      <div class="kpi-val">${d.length}</div><div class="kpi-lbl">TOTAL SHIFTS LOADED</div>
      <div class="kpi-sub">Across all lines</div>
    </div>
    <div class="kpi hero" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${ton.toFixed(0)} MT</div><div class="kpi-lbl">TOTAL TONNAGE</div>
      <div class="kpi-sub">Production output</div>
    </div>
    <div class="kpi" style="--kpi-color:var(--accent2)">
      <div class="kpi-val">${coils.toFixed(0)}</div><div class="kpi-lbl">TOTAL COILS PROCESSED</div>
      <div class="kpi-sub">All machines</div>
    </div>
    <div class="kpi hero" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${(maintBreakdownDelay/60).toFixed(1)}h</div>
      <div class="kpi-lbl">MAINTENANCE BREAKDOWN DOWNTIME</div>
      <div class="kpi-sub">${maintBreakdownDelay.toFixed(0)} min &nbsp;·&nbsp; All delay: ${(totalDelay/60).toFixed(0)}h</div>
    </div>
    <div class="kpi hero" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${atdOverview.availPct.toFixed(1)}%</div>
      <div class="kpi-lbl">AVAILABILITY TILL DATE</div>
      <div class="kpi-sub">${atdOverview.availMinutes.toFixed(0)} min &nbsp;/&nbsp; ${atdOverview.totalPlanned.toFixed(0)} min planned</div>
    </div>
    <div class="kpi" style="--kpi-color:#a78bfa">
      <div class="kpi-val">${avail.toFixed(1)}%</div><div class="kpi-lbl">AVG SHIFT AVAILABILITY</div>
      <div class="kpi-sub">Per-shift avg</div>
    </div>
  `;

  // Trend dates sorting
  const dates=Object.keys(dateMap).sort((a,b)=>{
    const pa=a.split('.'),pb=b.split('.');
    return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);
  }).slice(-40);

  const toggleEl=document.getElementById('overview-line-toggle');
  toggleEl.innerHTML=MACHINES.map(m=>`<button class="ltbtn on" data-m="${m}" onclick="toggleLine(this,'chart-overview-trend')" style="border-color:${MCOLORS[m]};color:${MCOLORS[m]}">${m}</button>`).join('');

  mkChart('chart-overview-trend',{
    type:'line',
    data:{
      labels:dates,
      datasets:MACHINES.map(m=>({
        label:m,data:dates.map(dt=>dateMap[dt]?.[m]||0),
        borderColor:MCOLORS[m],backgroundColor:MCOLORS[m]+'22',
        tension:.4,fill:false,pointRadius:2,borderWidth:2,
      }))
    },
    options:{...baseOpts(),plugins:{...baseOpts().plugins,legend:{labels:{color:'#e0eeff',font:{family:'Barlow',size:11}}}}}
  });

  // Pareto Chart
  const sorted=Object.entries(delayTotals).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const total=sorted.reduce((s,x)=>s+x[1],0);
  let cumulative=0;
  const cumPct=sorted.map(x=>{ cumulative+=x[1]; return +(cumulative/total*100).toFixed(1); });

  mkChart('chart-overview-pareto',{
    data:{
      labels:sorted.map(x=>x[0].length>18?x[0].slice(0,18)+'…':x[0]),
      datasets:[
        {type:'bar',label:'Delay (min)',data:sorted.map(x=>x[1]),backgroundColor:sorted.map(x=>delayColor(x[0])),yAxisID:'y',order:2},
        {type:'line',label:'Cumulative %',data:cumPct,borderColor:'#ffd94a',backgroundColor:'transparent',yAxisID:'y2',tension:.3,pointRadius:3,order:1},
      ]
    },
    options:{
      ...baseOpts(),
      plugins:{...baseOpts().plugins,legend:{labels:{color:'#e0eeff',font:{size:10}}}},
      scales:{
        x:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:9},maxRotation:35}},
        y:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:9}}},
        y2:{position:'right',min:0,max:100,grid:{display:false},ticks:{color:'#ffd94a',font:{size:9},callback:v=>v+'%'}},
      }
    }
  });

  // Shift Doughnut
  mkChart('chart-shift-doughnut',{
    type:'doughnut',
    data:{labels:['A – Morning','B – Afternoon','C – Night'],
      datasets:[{data:[shiftTon.A,shiftTon.B,shiftTon.C],backgroundColor:['#00c8ff','#ff6b2b','#ffd94a'],borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#e0eeff',font:{size:11}}}}}
  });

  // Team bar
  const teamSorted=Object.entries(teamTon).sort((a,b)=>b[1]-a[1]);
  mkChart('chart-team-bar',{
    type:'bar',
    data:{labels:teamSorted.map(x=>x[0]),
      datasets:[{label:'Tonnage (MT)',data:teamSorted.map(x=>+x[1].toFixed(1)),backgroundColor:'#00c8ff88',borderColor:'#00c8ff',borderWidth:1}]},
    options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}}}
  });

  // Avail Mini
  document.getElementById('avail-mini').innerHTML=MACHINES.map(m=>{
    const item=availByMachine[m];
    const pct=item.count?item.sum/item.count:0;
    const color=pct>85?'var(--accent3)':pct>70?'var(--accent4)':'var(--danger)';
    return `<div class="avail-item">
      <div class="avail-circle" style="background:conic-gradient(${color} ${pct}%,var(--panel2) 0);color:${color}">
        <span style="background:var(--panel);border-radius:50%;width:68px;height:68px;display:flex;align-items:center;justify-content:center;font-size:16px;">${pct.toFixed(1)}%</span>
      </div>
      <div class="avail-lbl" style="color:${MCOLORS[m]}">${m}</div>
    </div>`;
  }).join('');

  // Incharge tonnage section
  renderInchargeTonnageOverview(d);
}

// ══════════════════════════════════
//  INCHARGE TONNAGE (OVERVIEW TAB)
// ══════════════════════════════════

/**
 * Returns total tonnage per shift incharge from uploaded data.
 * Each incharge's tonnage = sum of MT across ALL lines/shifts they supervised.
 * If no data is uploaded, returns a default placeholder map.
 *
 * Requirement: "One incharge → 1/2/3 lines total tonnage for all lines"
 */
function getProductionByShiftIncharge(data) {
  const result = {};
  if (!data || data.length === 0) {
    // Default state: no file uploaded — return default sum of 3 lines for standard incharges
    const defaults = [
      { name: 'NAGESHWAR REDDY', total: 3600, shifts: 15, lines: ['WCTL-1', 'WCTL-2', 'SLITTER'] },
      { name: 'SUNIL PRADHAN', total: 3100, shifts: 14, lines: ['WCTL-1', 'WCTL-2', 'SLITTER'] },
      { name: 'RAHUL KUMAR', total: 2900, shifts: 13, lines: ['WCTL-1', 'WCTL-2', 'SLITTER'] },
      { name: 'JAGANNATH REDDY', total: 2700, shifts: 12, lines: ['WCTL-1', 'WCTL-2', 'SLITTER'] },
      { name: 'DIGANTA SAHU', total: 2400, shifts: 11, lines: ['WCTL-1', 'WCTL-2', 'SLITTER'] }
    ];
    defaults.forEach(item => {
      result[item.name] = {
        total: item.total,
        shifts: item.shifts,
        lines: new Set(item.lines)
      };
    });
    return result;
  }

  const shiftSeen = {};
  data.forEach(record => {
    const incharge = record._normIncharge || normIncharge(record.incharge || '');
    if (!incharge || incharge === 'UNKNOWN') return;
    const tonnage = parseFloat(record.tonnage) || 0;
    if (!result[incharge]) {
      result[incharge] = { total: 0, shifts: 0, lines: new Set() };
      shiftSeen[incharge] = new Set();
    }

    result[incharge].total += tonnage;
    const shiftKey = `${String(record.date || '').trim()}|${String(record.shift || '').trim().toUpperCase()}`;
    if (shiftKey && !shiftSeen[incharge].has(shiftKey)) {
      shiftSeen[incharge].add(shiftKey);
      result[incharge].shifts += 1;
    }
    if (record.machine) result[incharge].lines.add(record.machine);
  });
  return result;
}

/**
 * Renders the "Total Production by Shift Incharge" section in the Overview tab.
 * Shows a horizontal bar chart + a summary table.
 * If no data is uploaded, renders a placeholder message.
 */
function renderInchargeTonnageOverview(data) {
  const container = document.getElementById('incharge-tonnage-section');
  if (!container) return;

  const icMap = getProductionByShiftIncharge(data);
  const entries = Object.entries(icMap).sort((a, b) => b[1].total - a[1].total);

  // ── No data state ──
  if (entries.length === 0) {
    container.innerHTML = `
      <div style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">
        No data uploaded. Upload an Excel file to see incharge tonnage.
      </div>`;
    return;
  }

  const PALETTE = ['#00c8ff','#ff6b2b','#00e5a0','#ffd94a','#a78bfa','#f97316','#34d399','#ec4899','#06b6d4','#84cc16','#60a5fa','#fb923c'];

  // ── Bar chart ──
  mkChart('chart-incharge-tonnage', {
    type: 'bar',
    data: {
      labels: entries.map(x => x[0]),
      datasets: [{
        label: 'Total Tonnage (MT)',
        data: entries.map(x => +x[1].total.toFixed(1)),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
        borderColor:     entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1,
      }]
    },
    options: { ...baseOpts(), indexAxis: 'y', plugins: { legend: { display: false } } }
  });

  // ── Summary table rows ──
  const tableRows = entries.map(([ name, stats ], i) => {
    const avg = stats.shifts ? (stats.total / stats.shifts).toFixed(1) : '—';
    const lines = [...stats.lines].join(', ') || '—';
    const color = PALETTE[i % PALETTE.length];
    return `<tr>
      <td style="color:${color};font-weight:600">${name}</td>
      <td style="text-align:right;font-family:var(--font-mono)">${lines}</td>
      <td style="text-align:right">${stats.shifts}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent3)">${stats.total.toFixed(1)}</td>
      <td style="text-align:right;color:var(--accent2)">${avg}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
      <div style="min-height:240px;position:relative;">
        <canvas id="chart-incharge-tonnage"></canvas>
      </div>
      <div class="tbl-wrap" style="max-height:260px;overflow-y:auto;">
        <table>
          <thead><tr>
            <th>INCHARGE</th><th style="text-align:right">LINES</th>
            <th style="text-align:right">SHIFTS</th>
            <th style="text-align:right">TOTAL (MT)</th>
            <th style="text-align:right">AVG/SHIFT</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

  // Chart must be rendered AFTER the canvas is in the DOM
  mkChart('chart-incharge-tonnage', {
    type: 'bar',
    data: {
      labels: entries.map(x => x[0]),
      datasets: [{
        label: 'Total Tonnage (MT)',
        data: entries.map(x => +x[1].total.toFixed(1)),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
        borderColor:     entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1,
      }]
    },
    options: { ...baseOpts(), indexAxis: 'y', plugins: { legend: { display: false } } }
  });
}

// ══════════════════════════════════
//  PRODUCTION
// ══════════════════════════════════
function renderProduction(){
  const d=filteredData;
  let ton=0;
  let bestShift={tonnage:0};
  const icTon={};
  const icBest={};
  const dateMap={};
  const teamTon={};
  const shiftMachMap={};
  ['A','B','C'].forEach(s=>{ shiftMachMap[s]={}; MACHINES.forEach(m=>{ shiftMachMap[s][m]=[]; }); });

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    ton += r.tonnage;
    if (r.tonnage > bestShift.tonnage) {
      bestShift = r;
    }

    const n = r._normIncharge;
    icTon[n] = (icTon[n] || 0) + r.tonnage;
    if (!icBest[n] || r.tonnage > icBest[n]) {
      icBest[n] = r.tonnage;
    }

    if (!dateMap[r.date]) dateMap[r.date] = {};
    if (!dateMap[r.date][r.machine]) dateMap[r.date][r.machine] = 0;
    dateMap[r.date][r.machine] += r.tonnage;

    if (shiftMachMap[r.shift] && shiftMachMap[r.shift][r.machine]) {
      shiftMachMap[r.shift][r.machine].push(r.tonnage);
    }

    const t = r.team || 'Unknown';
    teamTon[t] = (teamTon[t] || 0) + r.tonnage;
  }

  const bestIC=Object.entries(icTon).sort((a,b)=>b[1]-a[1])[0]||['—',0];

  document.getElementById('kpi-production').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${ton.toFixed(1)} MT</div><div class="kpi-lbl">TOTAL TONNAGE</div></div>
    <div class="kpi hero" style="--kpi-color:var(--accent)">
      <div class="kpi-val">${bestShift.tonnage.toFixed(1)} MT</div>
      <div class="kpi-lbl">HIGHEST SINGLE SHIFT</div>
      <div class="kpi-sub">${bestShift.date ? `${bestShift.date} · ${bestShift.machine} · Shift ${bestShift.shift}` : 'No data loaded'}</div></div>
    <div class="kpi" style="--kpi-color:var(--accent2)">
      <div class="kpi-val">${bestIC[0].split(' ')[0]}</div>
      <div class="kpi-lbl">TOP INCHARGE</div>
      <div class="kpi-sub">${bestIC[1] > 0 ? `${bestIC[1].toFixed(1)} MT total` : '0.0 MT total'}</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${d.length?( ton/d.length).toFixed(1):0} MT</div>
      <div class="kpi-lbl">AVG TONNAGE/SHIFT</div></div>
  `;

  // Incharge bar
  const icBestSorted=Object.entries(icBest).sort((a,b)=>b[1]-a[1]).slice(0,10);
  mkChart('chart-prod-incharge',{
    type:'bar',
    data:{labels:icBestSorted.map(x=>x[0]),
      datasets:[{label:'Best Shift Tonnage (MT)',data:icBestSorted.map(x=>+x[1].toFixed(1)),
        backgroundColor:icBestSorted.map((_,i)=>['#00c8ff','#ff6b2b','#00e5a0','#ffd94a','#a78bfa','#f97316','#34d399','#ec4899','#06b6d4','#84cc16'][i]),
        borderWidth:0}]},
    options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}}}
  });

  // Daily Tonnage
  const dates=Object.keys(dateMap).sort((a,b)=>{
    const pa=a.split('.'),pb=b.split('.');
    return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);
  }).slice(-50);

  mkChart('chart-prod-daily',{
    type:'bar',
    data:{labels:dates,datasets:MACHINES.map(m=>({
      label:m,data:dates.map(dt=>dateMap[dt]?.[m]||0),
      backgroundColor:MCOLORS[m]+'99',borderColor:MCOLORS[m],borderWidth:1,
    }))},
    options:{...baseOpts(),scales:{...baseOpts().scales,x:{...baseOpts().scales.x,stacked:true},y:{...baseOpts().scales.y,stacked:true}}}
  });

  // Shift compare
  mkChart('chart-shift-compare',{
    type:'bar',
    data:{labels:MACHINES,datasets:['A','B','C'].map((s,i)=>({
      label:`Shift ${s}`,
      data:MACHINES.map(m=>{ const arr=shiftMachMap[s][m]; return arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):0; }),
      backgroundColor:['#00c8ff99','#ff6b2b99','#ffd94a99'][i],
      borderColor:['#00c8ff','#ff6b2b','#ffd94a'][i],borderWidth:1,
    }))},
    options:baseOpts()
  });

  // Team Tonnage
  const teamS=Object.entries(teamTon).sort((a,b)=>b[1]-a[1]).slice(0,8);
  mkChart('chart-team-tonnage',{
    type:'bar',
    data:{labels:teamS.map(x=>x[0].length>20?x[0].slice(0,20)+'…':x[0]),
      datasets:[{label:'Tonnage (MT)',data:teamS.map(x=>+x[1].toFixed(1)),
        backgroundColor:'#00e5a088',borderColor:'#00e5a0',borderWidth:1}]},
    options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}}}
  });

  renderProdTable();
  renderTeamAnchageSection();
}

function renderProdTable(){
  const pageProd = document.getElementById('page-production');
  if (!pageProd || !pageProd.classList.contains('active')) return;

  const search  = (document.getElementById('prod-search')||{}).value?.toLowerCase()||'';
  const role    = (document.getElementById('prod-filter-role')||{}).value||'ALL';
  const shift   = (document.getElementById('prod-filter-shift')||{}).value||'ALL';
  const machine = (document.getElementById('prod-filter-machine')||{}).value||'ALL';
  const avail   = (document.getElementById('prod-filter-avail')||{}).value||'ALL';
  const sort    = (document.getElementById('prod-filter-sort')||{}).value||'DATE';

  const SUPERVISORS=['NAGESHWAR REDDY','SUNIL PRADHAN','RAHUL KUMAR','JAGANNATH REDDY','DIGANTA SAHU'];

  let rows = filteredData.filter(r=>{
    const ic = r._normIncharge;
    if(role==='SUPERVISOR' && !SUPERVISORS.includes(ic)) return false;
    if(shift!=='ALL' && r.shift!==shift) return false;
    if(machine!=='ALL' && r.machine!==machine) return false;
    if(search && ![r.date,ic,r.team,r.machine].join(' ').toLowerCase().includes(search)) return false;
    if(avail!=='ALL'){
      const a = getAvailability(r);
      if(avail==='HIGH' && a<=85) return false;
      if(avail==='MED'  && (a<=70||a>85)) return false;
      if(avail==='LOW'  && a>=70) return false;
    }
    return true;
  });

  // Sort
  if(sort==='TONNAGE_DESC') rows=[...rows].sort((a,b)=>b.tonnage-a.tonnage);
  else if(sort==='TONNAGE_ASC') rows=[...rows].sort((a,b)=>a.tonnage-b.tonnage);
  else if(sort==='DELAY_DESC') rows=[...rows].sort((a,b)=>{
    const da=a.totalDelayMin!==undefined?a.totalDelayMin:a.delays.reduce((s,d)=>s+d.time,0);
    const db=b.totalDelayMin!==undefined?b.totalDelayMin:b.delays.reduce((s,d)=>s+d.time,0);
    return db-da;
  });
  else if(sort==='AVAIL_ASC') rows=[...rows].sort((a,b)=>getAvailability(a)-getAvailability(b));

  const countEl = document.getElementById('prod-filter-count');
  if(countEl) countEl.textContent = `${rows.length} of ${filteredData.length} shifts`;

  const tbody=document.getElementById('prod-tbody');
  if(!tbody) return;
  tbody.innerHTML=rows.slice(0,300).map(r=>{
    const avl=getAvailability(r);
    const aColor=avl>85?'#00e5a0':avl>70?'#ffd94a':'#ff3b5c';
    const totalDelayMin = r.totalDelayMin!==undefined?r.totalDelayMin:r.delays.reduce((s,d)=>s+d.time,0);
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:10px">${r.date}</td>
      <td style="color:${MCOLORS[r.machine]};font-weight:600">${r.machine}</td>
      <td><span class="pill pill-${r.shift?.toLowerCase()}">${r.shift}</span></td>
      <td>${r._normIncharge}</td>
      <td style="font-size:11px">${r.team||'—'}</td>
      <td style="text-align:right">${r.coils||0}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent3)">${r.tonnage?.toFixed?.(1)||0}</td>
      <td style="text-align:right;color:var(--accent2)">${totalDelayMin.toFixed(0)}</td>
      <td style="text-align:right;color:${aColor};font-family:var(--font-mono)">${avl.toFixed(1)}%</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════
//  TEAM & INCHARGE (ANCHAGE) ANALYSIS
// ══════════════════════════════════
function renderTeamAnchageSection() {
  // Only render if Production page is active
  const pageProd = document.getElementById('page-production');
  if (!pageProd || !pageProd.classList.contains('active')) return;

  const d = filteredData;

  // ── Aggregate per-team stats ──
  const teamStats = {};   // { team: { total, shifts, best, delayMin, availSum, byMachine } }
  // ── Aggregate per-incharge stats ──
  const anchStats = {};   // { incharge: { total, shifts, best, delayMin, availSum, teams } }
  const anchShiftSeen = {}; // { incharge: Set<date|shift> }
  // ── Team × Machine breakdown (for stacked chart) ──
  const teamMachMap = {}; // { team: { WCTL-1: 0, WCTL-2: 0, SLITTER: 0 } }

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const team    = (r.team || '').trim() || 'Unassigned';
    const incharge = r._normIncharge || 'UNKNOWN';
    const ton     = r.tonnage || 0;
    const delay   = r.totalDelayMin !== undefined ? r.totalDelayMin : r.delays.reduce((s, x) => s + x.time, 0);
    const avail   = getAvailability(r);

    // — Team stats —
    if (!teamStats[team]) {
      teamStats[team] = { total: 0, shifts: 0, best: 0, delayMin: 0, availSum: 0 };
    }
    teamStats[team].total    += ton;
    teamStats[team].shifts   += 1;
    teamStats[team].best      = Math.max(teamStats[team].best, ton);
    teamStats[team].delayMin += delay;
    teamStats[team].availSum += avail;

    // — Team × Machine —
    if (!teamMachMap[team]) {
      teamMachMap[team] = { 'WCTL-1': 0, 'WCTL-2': 0, 'SLITTER': 0 };
    }
    if (teamMachMap[team][r.machine] !== undefined) {
      teamMachMap[team][r.machine] += ton;
    }

    // — Incharge (anchage) stats —
    if (!anchStats[incharge]) {
      anchStats[incharge] = { total: 0, shifts: 0, best: 0, delayMin: 0, availSum: 0, teams: new Set() };
      anchShiftSeen[incharge] = new Set();
    }
    anchStats[incharge].total    += ton;
    anchStats[incharge].best      = Math.max(anchStats[incharge].best, ton);
    anchStats[incharge].delayMin += delay;
    anchStats[incharge].availSum += avail;
    anchStats[incharge].teams.add(team);

    const shiftKey = `${String(r.date || '').trim()}|${String(r.shift || '').trim().toUpperCase()}`;
    if (shiftKey) {
      anchShiftSeen[incharge].add(shiftKey);
    }
  }

  Object.entries(anchStats).forEach(([name, stats]) => {
    stats.shifts = anchShiftSeen[name] ? anchShiftSeen[name].size : 0;
  });

  // ── Sort helpers ──
  const teamSorted   = Object.entries(teamStats).sort((a, b) => b[1].total - a[1].total);
  const anchSorted   = Object.entries(anchStats).sort((a, b) => b[1].total - a[1].total).slice(0, 12);
  const anchAvgSort  = Object.entries(anchStats)
    .map(([k, v]) => [k, v.shifts ? v.total / v.shifts : 0])
    .sort((a, b) => b[1] - a[1]).slice(0, 12);

  // ── Top-level KPI strip ──
  const topTeam  = teamSorted[0]  || ['—', { total: 0, shifts: 0 }];
  const topAnch  = anchSorted[0]  || ['—', { total: 0 }];
  const totalTeams = teamSorted.length;
  const totalAnch  = anchSorted.length;

  const kpiEl = document.getElementById('kpi-team-anchage');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi" style="--kpi-color:var(--accent3)">
        <div class="kpi-val">${totalTeams}</div>
        <div class="kpi-lbl">ACTIVE TEAMS</div>
        <div class="kpi-sub">Across all lines &amp; shifts</div>
      </div>
      <div class="kpi" style="--kpi-color:var(--accent)">
        <div class="kpi-val">${topTeam[0].length > 18 ? topTeam[0].slice(0, 18) + '…' : topTeam[0]}</div>
        <div class="kpi-lbl">TOP TEAM (TOTAL MT)</div>
        <div class="kpi-sub">${topTeam[1].total.toFixed(1)} MT · ${topTeam[1].shifts} shifts</div>
      </div>
      <div class="kpi" style="--kpi-color:var(--accent2)">
        <div class="kpi-val">${totalAnch}</div>
        <div class="kpi-lbl">INCHARGES (ANCHAGE)</div>
        <div class="kpi-sub">Unique shift anchors</div>
      </div>
      <div class="kpi" style="--kpi-color:#a78bfa">
        <div class="kpi-val">${topAnch[0].split(' ')[0]}</div>
        <div class="kpi-lbl">TOP INCHARGE (MT)</div>
        <div class="kpi-sub">${topAnch[1].total.toFixed(1)} MT total · ${topAnch[1].shifts} shifts</div>
      </div>
    `;
  }

  // ── Chart 1: Team-wise cumulative + avg per shift (grouped bar) ──
  const TEAM_PALETTE = [
    '#00c8ff','#ff6b2b','#00e5a0','#ffd94a','#a78bfa',
    '#f97316','#34d399','#ec4899','#06b6d4','#84cc16',
    '#60a5fa','#fb923c',
  ];
  const teamLabels = teamSorted.map(x => x[0].length > 20 ? x[0].slice(0, 20) + '…' : x[0]);
  mkChart('chart-team-tonnage-detail', {
    type: 'bar',
    data: {
      labels: teamLabels,
      datasets: [
        {
          label: 'Total Tonnage (MT)',
          data: teamSorted.map(x => +x[1].total.toFixed(1)),
          backgroundColor: teamSorted.map((_, i) => TEAM_PALETTE[i % TEAM_PALETTE.length] + 'bb'),
          borderColor:     teamSorted.map((_, i) => TEAM_PALETTE[i % TEAM_PALETTE.length]),
          borderWidth: 1,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'Avg MT/Shift',
          type: 'line',
          data: teamSorted.map(x => x[1].shifts ? +(x[1].total / x[1].shifts).toFixed(1) : 0),
          borderColor: '#ffd94a',
          backgroundColor: 'transparent',
          pointBackgroundColor: '#ffd94a',
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
          yAxisID: 'y2',
          order: 1,
        },
      ],
    },
    options: {
      ...baseOpts(),
      indexAxis: 'y',
      scales: {
        x:  { grid: { color: C.gridLine }, ticks: { color: C.tickColor, font: { size: 9 } } },
        y:  { grid: { color: C.gridLine }, ticks: { color: C.tickColor, font: { size: 9 } } },
        y2: {
          position: 'top', display: false,
          grid: { display: false },
          ticks: { color: '#ffd94a', font: { size: 9 } },
        },
      },
      plugins: {
        ...baseOpts().plugins,
        legend: { position: 'top', labels: { color: '#e0eeff', font: { size: 10 } } },
        tooltip: {
          ...baseOpts().plugins.tooltip,
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const t = teamSorted[ctx.dataIndex];
                return `  Shifts: ${t[1].shifts} · Best: ${t[1].best.toFixed(1)} MT`;
              }
              return '';
            },
          },
        },
      },
    },
  });

  // ── Chart 2: Incharge (anchage) total tonnage horizontal bar ──
  const anchColors = [
    '#00c8ff','#ff6b2b','#00e5a0','#ffd94a','#a78bfa',
    '#f97316','#34d399','#ec4899','#06b6d4','#84cc16','#60a5fa','#fb923c',
  ];
  mkChart('chart-anchage-total', {
    type: 'bar',
    data: {
      labels: anchSorted.map(x => x[0]),
      datasets: [{
        label: 'Total Tonnage (MT)',
        data: anchSorted.map(x => +x[1].total.toFixed(1)),
        backgroundColor: anchSorted.map((_, i) => anchColors[i % anchColors.length] + 'bb'),
        borderColor:     anchSorted.map((_, i) => anchColors[i % anchColors.length]),
        borderWidth: 1,
      }],
    },
    options: {
      ...baseOpts(),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseOpts().plugins.tooltip,
          callbacks: {
            afterLabel: (ctx) => {
              const a = anchSorted[ctx.dataIndex][1];
              return `  Shifts: ${a.shifts} · Best: ${a.best.toFixed(1)} MT · Avg: ${(a.total / a.shifts).toFixed(1)} MT`;
            },
          },
        },
      },
    },
  });

  // ── Chart 3: Team × Machine stacked bar ──
  const tmLabels = Object.keys(teamMachMap)
    .sort((a, b) => (teamStats[b]?.total || 0) - (teamStats[a]?.total || 0))
    .slice(0, 10);
  mkChart('chart-team-by-machine', {
    type: 'bar',
    data: {
      labels: tmLabels.map(t => t.length > 16 ? t.slice(0, 16) + '…' : t),
      datasets: MACHINES.map(m => ({
        label: m,
        data: tmLabels.map(t => +(teamMachMap[t]?.[m] || 0).toFixed(1)),
        backgroundColor: MCOLORS[m] + '99',
        borderColor: MCOLORS[m],
        borderWidth: 1,
      })),
    },
    options: {
      ...baseOpts(),
      scales: {
        x: { ...baseOpts().scales.x, stacked: true, ticks: { color: C.tickColor, font: { size: 9 }, maxRotation: 35 } },
        y: { ...baseOpts().scales.y, stacked: true },
      },
      plugins: {
        ...baseOpts().plugins,
        legend: { position: 'top', labels: { color: '#e0eeff', font: { size: 10 } } },
      },
    },
  });

  // ── Chart 4: Incharge avg MT/shift ──
  mkChart('chart-anchage-avg', {
    type: 'bar',
    data: {
      labels: anchAvgSort.map(x => x[0]),
      datasets: [{
        label: 'Avg MT per Shift',
        data: anchAvgSort.map(x => +x[1].toFixed(1)),
        backgroundColor: anchAvgSort.map((_, i) => anchColors[i % anchColors.length] + 'aa'),
        borderColor:     anchAvgSort.map((_, i) => anchColors[i % anchColors.length]),
        borderWidth: 1,
      }],
    },
    options: {
      ...baseOpts(),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseOpts().plugins.tooltip,
          callbacks: {
            afterLabel: (ctx) => {
              const name = anchAvgSort[ctx.dataIndex][0];
              const a = anchStats[name];
              return a ? `  Total: ${a.total.toFixed(1)} MT · ${a.shifts} shifts` : '';
            },
          },
        },
      },
    },
  });

  // ── Performance table: grouped by incharge × team ──
  // Build rows: one row per (incharge, primary_team) pair
  const tableRows = anchSorted.map(([incharge, stats]) => {
    const avgTon   = stats.shifts ? stats.total / stats.shifts : 0;
    const avgAvail = stats.shifts ? stats.availSum / stats.shifts : 0;
    const teams    = [...stats.teams].filter(t => t !== 'Unassigned').join(', ') || 'Unassigned';
    return { incharge, teams, shifts: stats.shifts, total: stats.total, avgTon, best: stats.best, delayMin: stats.delayMin, avgAvail };
  });

  const tbody = document.getElementById('team-anchage-tbody');
  if (tbody) {
    tbody.innerHTML = tableRows.map((row, idx) => {
      const rankColor = idx === 0 ? '#ffd94a' : idx === 1 ? '#9ca3af' : idx === 2 ? '#f97316' : 'var(--muted)';
      const availColor = row.avgAvail > 85 ? '#00e5a0' : row.avgAvail > 70 ? '#ffd94a' : '#ff3b5c';
      return `<tr>
        <td style="font-weight:600;color:${rankColor}">${row.incharge}</td>
        <td style="font-size:11px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${row.teams}">${row.teams.length > 30 ? row.teams.slice(0, 30) + '…' : row.teams}</td>
        <td style="text-align:right">${row.shifts}</td>
        <td style="text-align:right;font-weight:600;color:var(--accent3)">${row.total.toFixed(1)}</td>
        <td style="text-align:right;color:var(--accent2)">${row.avgTon.toFixed(1)}</td>
        <td style="text-align:right;color:var(--accent4)">${row.best.toFixed(1)}</td>
        <td style="text-align:right;color:var(--danger)">${row.delayMin.toFixed(0)}</td>
        <td style="text-align:right;color:${availColor};font-family:var(--font-mono)">${row.avgAvail.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }
}

function renderDelays(){
  const d=filteredData;
  const allDelays=[];
  let totalTime=0;
  let maintTime=0;          // MAINTENANCE BREAKDOWN (normType match)
  let maintBreakdownTime=0; // PRIMARY: breakdown type + description keyword fallback
  let delayEventsCount=0;
  const dt={};
  const hmData={};
  const dateMap2={};
  const uniqueIncharges = new Set();
  const uniqueTypes = new Set();

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const delays = r.delays;
    const inchargeNorm = r._normIncharge;
    if (inchargeNorm && inchargeNorm !== 'UNKNOWN') {
      uniqueIncharges.add(inchargeNorm);
    }
    for (let j = 0; j < delays.length; j++) {
      const dl = delays[j];
      const typeNorm = dl._normType;
      uniqueTypes.add(typeNorm);
      
      delayEventsCount++;
      totalTime += dl.time;
      if (typeNorm === 'MAINTENANCE BREAKDOWN') {
        maintTime += dl.time;
      }
      // PRIMARY downtime: breakdown type OR description keyword match
      if (typeof getMaintenanceBreakdownDowntime === 'function') {
        const BKWD_KW = ['breakdown','failure','repair','fault','trip'];
        const desc = ((dl.reason || dl.description) || '').toLowerCase();
        if (typeNorm === 'MAINTENANCE BREAKDOWN' || BKWD_KW.some(kw => desc.includes(kw))) {
          maintBreakdownTime += dl.time;
        }
      } else {
        maintBreakdownTime = maintTime; // safe fallback
      }

      dt[typeNorm] = (dt[typeNorm] || 0) + dl.time;

      const k = `${inchargeNorm}__${typeNorm}`;
      hmData[k] = (hmData[k] || 0) + dl.time;

      if (!dateMap2[r.date]) dateMap2[r.date] = {};
      dateMap2[r.date][typeNorm] = (dateMap2[r.date][typeNorm] || 0) + dl.time;

      allDelays.push({
        time: dl.time,
        type: typeNorm,
        date: r.date,
        machine: r.machine,
        incharge: inchargeNorm,
        shift: r.shift,
        description: dl.description,
        reason: dl.reason
      });
    }
  }

  document.getElementById('kpi-delays').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${maintBreakdownTime.toFixed(0)} min</div>
      <div class="kpi-lbl">MAINTENANCE BREAKDOWN DOWNTIME</div>
      <div class="kpi-sub">${(maintBreakdownTime/60).toFixed(1)} h &nbsp;·&nbsp; ${d.length?+(maintBreakdownTime/d.length).toFixed(1):0} min/shift avg</div></div>
    <div class="kpi hero" style="--kpi-color:var(--accent2)">
      <div class="kpi-val">${delayEventsCount}</div><div class="kpi-lbl">TOTAL DELAY EVENTS</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${totalTime.toFixed(0)} min</div><div class="kpi-lbl">ALL DELAY TIME (TOTAL)</div>
      <div class="kpi-sub">${(totalTime/60).toFixed(1)} hours incl. all categories</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${d.length?(totalTime/d.length).toFixed(0):0} min</div>
      <div class="kpi-lbl">AVG TOTAL DELAY/SHIFT</div></div>
  `;

  // Pareto
  const sorted=Object.entries(dt).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const totP=sorted.reduce((s,x)=>s+x[1],0);
  let cum=0;
  const cumP=sorted.map(x=>{ cum+=x[1]; return +(cum/totP*100).toFixed(1); });
  mkChart('chart-pareto-main',{
    data:{labels:sorted.map(x=>x[0].length>16?x[0].slice(0,16)+'…':x[0]),
      datasets:[
        {type:'bar',label:'Delay (min)',data:sorted.map(x=>x[1]),backgroundColor:sorted.map(x=>delayColor(x[0])),yAxisID:'y',order:2},
        {type:'line',label:'Cumulative %',data:cumP,borderColor:'#ffd94a',backgroundColor:'transparent',yAxisID:'y2',tension:.3,pointRadius:3,order:1,borderWidth:2},
      ]},
    options:{...baseOpts(),plugins:{...baseOpts().plugins},
      scales:{
        x:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:9},maxRotation:40}},
        y:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:9}}},
        y2:{position:'right',min:0,max:100,grid:{display:false},ticks:{color:'#ffd94a',font:{size:9},callback:v=>v+'%'}},
      }}
  });

  // Pie
  const top8=sorted.slice(0,8);
  mkChart('chart-delay-pie',{
    type:'doughnut',
    data:{labels:top8.map(x=>x[0]),
      datasets:[{data:top8.map(x=>x[1]),backgroundColor:top8.map(x=>delayColor(x[0])),borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#e0eeff',font:{size:10},boxWidth:12}}}}
  });

  // Heatmap: incharge × delay type
  const incharges=[...uniqueIncharges].sort().slice(0,8);
  const dtypes=[...uniqueTypes].filter(t=>t!=='OTHER').sort().slice(0,10);
  const maxHm=Math.max(...Object.values(hmData),1);

  const hmEl=document.getElementById('heatmap-delay');
  // Short label helper
  const hmLabel = t => t.replace(' DELAY','').replace(' BREAKDOWN','BD').replace('MAINTENANCE','MAINT').replace('COMMUNICATION','COMM');
  hmEl.innerHTML=`
    <div style="overflow-x:auto;padding-bottom:4px;">
      <table style="border-collapse:collapse;min-width:100%;font-family:var(--font-mono);font-size:11px;">
        <thead>
          <tr>
            <th style="width:120px;text-align:left;color:var(--muted);padding:6px 10px;font-size:9px;letter-spacing:.1em;border-bottom:1px solid var(--border)">INCHARGE</th>
            ${dtypes.map(t=>`<th style="text-align:center;color:var(--muted);padding:6px 8px;font-size:9px;letter-spacing:.06em;border-bottom:1px solid var(--border);white-space:nowrap" title="${t}">${hmLabel(t)}</th>`).join('')}
            <th style="text-align:center;color:var(--muted);padding:6px 8px;font-size:9px;border-bottom:1px solid var(--border)">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${incharges.map(ic=>{
            const rowTotal = dtypes.reduce((s,dt2)=>s+(hmData[`${ic}__${dt2}`]||0),0);
            return `<tr>
              <td style="padding:5px 10px;color:var(--text);font-size:11px;white-space:nowrap;border-bottom:1px solid rgba(26,45,74,0.4)">${ic.split(' ')[0]}</td>
              ${dtypes.map(dt2=>{
                const v=hmData[`${ic}__${dt2}`]||0;
                const pct=v/maxHm;
                const bg=pct>0.6?`rgba(255,59,92,${0.2+pct*0.8})`:pct>0.2?`rgba(255,107,43,${0.15+pct*0.85})`:`rgba(0,200,255,${pct*0.35})`;
                const fg=pct>0.5?'#fff':pct>0.15?'#e0eeff':'#5a7898';
                return `<td style="text-align:center;padding:5px 8px;background:${v>0?bg:'transparent'};color:${fg};border-bottom:1px solid rgba(26,45,74,0.4);border-radius:2px" title="${ic} · ${dt2}: ${v} min">${v>0?v.toFixed(0):''}</td>`;
              }).join('')}
              <td style="text-align:center;padding:5px 8px;color:var(--accent2);font-weight:600;border-bottom:1px solid rgba(26,45,74,0.4)">${rowTotal>0?rowTotal.toFixed(0):''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Delay trend
  const dateMap2Dates = Object.keys(dateMap2).sort((a,b)=>{const pa=a.split('.'),pb=b.split('.');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).slice(-35);
  const top5types=sorted.slice(0,5).map(x=>x[0]);
  // Short friendly labels for the legend
  const shortLabel = t => t.replace(' DELAY','').replace(' BREAKDOWN','').replace(' MAINTENANCE','');
  mkChart('chart-delay-trend',{
    type:'line',
    data:{labels:dateMap2Dates,datasets:top5types.map(t=>({
      label:shortLabel(t),
      data:dateMap2Dates.map(dt=>dateMap2[dt]?.[t]||0),
      borderColor:delayColor(t),
      backgroundColor:delayColor(t)+'18',
      tension:.35,pointRadius:2,pointHoverRadius:5,borderWidth:2,fill:false,
    }))},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          position:'top',
          labels:{color:'#e0eeff',font:{family:'Barlow',size:11},boxWidth:14,padding:14,usePointStyle:true,pointStyleWidth:10}
        },
        tooltip:{
          backgroundColor:'#0c1525',borderColor:'#1a2d4a',borderWidth:1,
          titleColor:'#00c8ff',bodyColor:'#e0eeff',
          titleFont:{family:'Rajdhani',size:13,weight:'700'},
          callbacks:{
            title: items => items[0]?.label || '',
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} min`
          }
        }
      },
      scales:{
        x:{
          grid:{color:'rgba(26,45,74,0.6)'},
          ticks:{color:'#5a7898',font:{family:'JetBrains Mono',size:9},maxRotation:45,autoSkip:true,maxTicksLimit:14}
        },
        y:{
          grid:{color:'rgba(26,45,74,0.6)'},
          ticks:{color:'#5a7898',font:{family:'JetBrains Mono',size:10}},
          title:{display:true,text:'Minutes',color:'#5a7898',font:{size:10}}
        }
      }
    }
  });

  // Store allDelays on window so renderDelayTable can filter it
  window._allDelays = allDelays;
  renderDelayTable();
}

// ══════════════════════════════════
//  DELAY LOG TABLE (filterable)
// ══════════════════════════════════
function renderDelayTable(){
  const _catMap = {
    'MAINTENANCE BREAKDOWN':'MAINTENANCE','MAINTENANCE DAILY CHECKLIST':'MAINTENANCE','PLANNED MAINTENANCE':'MAINTENANCE',
    'COIL FEEDING DELAY':'COIL FEEDING',
    'PACKAGING DELAY':'PACKAGING','PACKAGE SHIFTING':'PACKAGING',
    'QUALITY DELAY':'QUALITY',
    'OPERATION DELAY':'OPERATION','SETUP DELAY':'OPERATION',
    'CRANE DELAY':'CRANE',
    'SCRAP REMOVAL':'SCRAP','SCRAP SCHEDULE':'SCRAP',
    'SHIFT HANDOVER':'HANDOVER','TBT':'HANDOVER',
    'COMMUNICATION DELAY':'COMMUNICATION','HR DELAY':'HR','SCHEDULE DELAY':'SCHEDULE',
    'OTHER':'OTHER',
  };
  const _catColors = {
    'MAINTENANCE':'var(--danger)','COIL FEEDING':'var(--accent)',
    'PACKAGING':'var(--accent4)','QUALITY':'#a78bfa',
    'OPERATION':'var(--accent3)','CRANE':'#f97316',
    'SCRAP':'#84cc16','HANDOVER':'#6b7280',
    'COMMUNICATION':'#8b5cf6','HR':'#ec4899','SCHEDULE':'#60a5fa',
    'OTHER':'var(--muted)',
  };

  const search   = (document.getElementById('delay-search')||{}).value?.toLowerCase()||'';
  const machine  = (document.getElementById('delay-filter-machine')||{}).value||'ALL';
  const shift    = (document.getElementById('delay-filter-shift')||{}).value||'ALL';
  const sort     = (document.getElementById('delay-filter-sort')||{}).value||'DATE';

  // Read active category chips (multi-select); fall back to ALL if none / ALL chip is active
  const activeChips = [...(document.querySelectorAll('.delay-cat-chip.chip-active')||[])].map(el=>el.dataset.cat);
  const categoryFilter = (activeChips.length === 0 || activeChips.includes('ALL')) ? 'ALL' : activeChips;

  let rows = (window._allDelays||[]).filter(x=>{
    if(machine!=='ALL' && x.machine!==machine) return false;
    if(shift!=='ALL'   && x.shift!==shift)     return false;
    if(categoryFilter !== 'ALL'){
      const cat = _catMap[x.type]||'OTHER';
      if(!categoryFilter.includes(cat)) return false;
    }
    if(search && ![x.incharge,x.reason||x.description,x.type,x.date].join(' ').toLowerCase().includes(search)) return false;
    return true;
  });

  if(sort==='TIME_DESC') rows=[...rows].sort((a,b)=>b.time-a.time);
  else if(sort==='TIME_ASC') rows=[...rows].sort((a,b)=>a.time-b.time);
  else if(sort==='TYPE') rows=[...rows].sort((a,b)=>a.type.localeCompare(b.type));

  const countEl = document.getElementById('delay-filter-count');
  if(countEl) countEl.textContent = `${rows.length} of ${(window._allDelays||[]).length} events`;

  const tbody=document.getElementById('delay-tbody');
  if(!tbody) return;
  tbody.innerHTML=rows.slice(0,500).map(x=>{
    const cat = _catMap[x.type]||'OTHER';
    const catColor = _catColors[cat]||'var(--muted)';
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:10px">${x.date}</td>
      <td style="color:${MCOLORS[x.machine]||'#fff'}">${x.machine}</td>
      <td><span class="pill pill-${x.shift?.toLowerCase()}">${x.shift}</span></td>
      <td>${x.incharge}</td>
      <td style="color:${delayColor(x.type)};font-size:11px">${x.type}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent2)">${x.time}</td>
      <td style="font-size:11px;color:var(--muted)">${x.reason||x.description||x.type||'—'}</td>
      <td><span style="color:${catColor};font-size:10px;font-family:var(--font-mono);font-weight:600">${cat}</span></td>
    </tr>`;
  }).join('');
}


function renderMaintenance(){
  const d=filteredData;
  const maintEvents=[];
  let totalMaintTime=0;
  const mttrByMachine={};
  const countByMachine={};
  const shiftsByMachine={};
  MACHINES.forEach(m=>{
    mttrByMachine[m]=0;
    countByMachine[m]=0;
    shiftsByMachine[m]=0;
  });

  const dateMap3={};

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    if (shiftsByMachine[r.machine] !== undefined) {
      shiftsByMachine[r.machine]++;
    }
    const delays = r.delays;
    const inchargeNorm = r._normIncharge;
    for (let j = 0; j < delays.length; j++) {
      const dl = delays[j];
      const typeNorm = dl._normType;
      if (typeNorm === 'MAINTENANCE BREAKDOWN') {
        totalMaintTime += dl.time;
        if (mttrByMachine[r.machine] !== undefined) {
          mttrByMachine[r.machine] += dl.time;
          countByMachine[r.machine]++;
        }
        dateMap3[r.date] = (dateMap3[r.date] || 0) + dl.time;

        maintEvents.push({
            time: dl.time,
            type: 'MAINTENANCE BREAKDOWN',
            date: r.date,
            machine: r.machine,
            incharge: inchargeNorm,
            shift: r.shift,
            description: dl.description,
            reason: dl.reason
          });
      }
    }
  }

  let totalBreakdowns = 0;
  MACHINES.forEach(m=>{
    totalBreakdowns += countByMachine[m];
  });
  const breakdowns=totalBreakdowns;

  document.getElementById('kpi-maintenance').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${breakdowns}</div><div class="kpi-lbl">TOTAL BREAKDOWNS</div></div>
    <div class="kpi hero" style="--kpi-color:var(--accent2)">
      <div class="kpi-val">${totalMaintTime.toFixed(0)} min</div><div class="kpi-lbl">TOTAL MAINTENANCE TIME</div>
      <div class="kpi-sub">${(totalMaintTime/60).toFixed(1)} hours</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${breakdowns?(totalMaintTime/breakdowns).toFixed(0):0} min</div>
      <div class="kpi-lbl">AVG MTTR (Overall)</div></div>
    <div class="kpi" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${breakdowns?(d.length*480/breakdowns).toFixed(0):0} min</div>
      <div class="kpi-lbl">AVG MTBF (Overall)</div></div>
  `;

  // MTBF/MTTR cards per machine
  document.getElementById('mtbf-cards').innerHTML=MACHINES.map(m=>{
    const cnt=countByMachine[m];
    const maint=mttrByMachine[m];
    const mttr=cnt?+(maint/cnt).toFixed(1):0;
    const shifts=shiftsByMachine[m];
    const opTime=shifts*480-maint;
    const mtbf=cnt?+(opTime/cnt).toFixed(1):0;
    const mttf=mtbf-mttr;
    return `<div class="card" style="text-align:center;">
      <div style="font-family:var(--font-head);font-size:13px;color:${MCOLORS[m]};letter-spacing:1px;margin-bottom:8px">${m}</div>
      <div class="mtbf-row">
        <div class="mtbf-item"><div class="mtbf-val" style="color:var(--accent)">${mttr} min</div><div class="mtbf-lbl">MTTR</div><div style="font-size:9px;color:var(--muted)">Mean Time to Repair</div></div>
        <div class="mtbf-item"><div class="mtbf-val" style="color:var(--accent3)">${mtbf} min</div><div class="mtbf-lbl">MTBF</div><div style="font-size:9px;color:var(--muted)">Mean Time Between Failures</div></div>
        <div class="mtbf-item"><div class="mtbf-val" style="color:var(--accent4)">${mttf>0?mttf.toFixed(0):'—'} min</div><div class="mtbf-lbl">MTTF</div><div style="font-size:9px;color:var(--muted)">Mean Time to Failure</div></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">${cnt} breakdowns · ${shifts} shifts</div>
    </div>`;
  }).join('');

  // Freq chart
  mkChart('chart-maint-freq',{
    type:'bar',
    data:{labels:MACHINES,
      datasets:[
        {label:'Breakdown Count',data:MACHINES.map(m=>countByMachine[m]),backgroundColor:MACHINES.map(m=>MCOLORS[m]+'99'),borderColor:MACHINES.map(m=>MCOLORS[m]),borderWidth:1},
        {label:'Total Maint Time (min)',data:MACHINES.map(m=>mttrByMachine[m]),backgroundColor:'rgba(255,59,92,0.3)',borderColor:'#ff3b5c',borderWidth:1,yAxisID:'y2'},
      ]},
    options:{...baseOpts(),scales:{
      x:{grid:{color:C.gridLine},ticks:{color:C.tickColor}},
      y:{grid:{color:C.gridLine},ticks:{color:C.tickColor}},
      y2:{position:'right',grid:{display:false},ticks:{color:'#ff3b5c',font:{size:9}}},
    }}
  });

  // Breakdown trend by date
  const dates3=Object.keys(dateMap3).sort((a,b)=>{const pa=a.split('.'),pb=b.split('.');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).slice(-40);
  mkChart('chart-maint-trend',{
    type:'line',
    data:{labels:dates3,datasets:[{label:'Maintenance Time (min)',data:dates3.map(dt=>dateMap3[dt]||0),
      borderColor:'#ff3b5c',backgroundColor:'rgba(255,59,92,0.1)',fill:true,tension:.3,pointRadius:2,borderWidth:2}]},
    options:{...baseOpts(),plugins:{legend:{display:false}}}
  });

  // Breakdown table
  const tbody=document.getElementById('maint-tbody');
  if(tbody){
    tbody.innerHTML=maintEvents.map(x=>`<tr>
      <td style="font-family:var(--font-mono);font-size:10px">${x.date}</td>
      <td style="color:${MCOLORS[x.machine]||'#fff'}">${x.machine}</td>
      <td><span class="pill pill-${x.shift?.toLowerCase()}">${x.shift}</span></td>
      <td>${x.incharge}</td>
      <td style="color:var(--danger);font-size:11px">${x.type}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent2)">${x.time}</td>
      <td style="font-size:11px;color:var(--muted)">${x.reason||x.description||x.type||'—'}</td>
    </tr>`).join('');
  }
}

// ══════════════════════════════════
//  AVAILABILITY
// ══════════════════════════════════
function renderAvailability(){
  const d=filteredData;
  let avg=0;
  let minR={avail:100};
  let maxR={avail:-1};
  let availSum=0;
  let shiftsAbove85Count=0;
  let maintBdTotal=0;  // for calculateAvailabilityTillDate
  
  const allAvail=[];
  const dateMap4={};
  const pivData={};

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const avail = getAvailability(r);
    const rWithAvail = { ...r, avail };
    allAvail.push(rWithAvail);

    availSum += avail;
    maintBdTotal += typeof getMaintenanceBreakdownDowntime === 'function'
      ? getMaintenanceBreakdownDowntime(r.delays) : 0;
    if (avail < minR.avail) {
      minR = rWithAvail;
    }
    if (avail > maxR.avail) {
      maxR = rWithAvail;
    }
    if (avail > 85) {
      shiftsAbove85Count++;
    }

    // Heatmap dateMap4
    if (!dateMap4[r.date]) dateMap4[r.date] = {};
    if (!dateMap4[r.date][r.machine]) dateMap4[r.date][r.machine] = [];
    dateMap4[r.date][r.machine].push(avail);

    // Pivot pivData
    const ic = r._normIncharge;
    if (!pivData[ic]) pivData[ic] = {};
    if (!pivData[ic][r.shift]) pivData[ic][r.shift] = [];
    pivData[ic][r.shift].push(avail);
  }

  avg = d.length ? availSum / d.length : 0;
  if (d.length === 0) {
    minR = { avail: 100 };
    maxR = { avail: 0 };
  }

  const atd = calculateAvailabilityTillDate(d.length, maintBdTotal);

  document.getElementById('kpi-avail').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${atd.availPct.toFixed(1)}%</div>
      <div class="kpi-lbl">AVAILABILITY TILL DATE</div>
      <div class="kpi-sub">${atd.availMinutes.toFixed(0)} min avail &nbsp;/&nbsp; ${atd.totalPlanned.toFixed(0)} min planned &nbsp;(${d.length} shifts × 480)</div></div>
    <div class="kpi hero" style="--kpi-color:var(--accent)">
      <div class="kpi-val">${avg.toFixed(1)}%</div><div class="kpi-lbl">AVG SHIFT AVAILABILITY</div>
      <div class="kpi-sub">Per-shift avg (excl. OTHER delays)</div></div>
    <div class="kpi" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${minR.date ? minR.avail.toFixed(1) + '%' : '—'}</div><div class="kpi-lbl">LOWEST AVAILABILITY</div>
      <div class="kpi-sub">${minR.date ? `${minR.date} · ${minR.machine}` : 'No data loaded'}</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${maxR.date ? maxR.avail.toFixed(1) + '%' : '—'}</div><div class="kpi-lbl">HIGHEST AVAILABILITY</div>
      <div class="kpi-sub">${maxR.date ? `${maxR.date} · ${maxR.machine}` : 'No data loaded'}</div></div>
    <div class="kpi" style="--kpi-color:#a78bfa">
      <div class="kpi-val">${shiftsAbove85Count}</div>
      <div class="kpi-lbl">SHIFTS &gt; 85% AVAIL</div></div>
  `;

  // Per machine availability trend
  MACHINES.forEach((m,i)=>{
    const md=allAvail.filter(r=>r.machine===m).slice(-30);
    const canvasId=['chart-avail-wctl1','chart-avail-wctl2','chart-avail-slit'][i];
    mkChart(canvasId,{
      type:'line',
      data:{labels:md.map(r=>`${r.date} ${r.shift}`),
        datasets:[{label:'Availability %',data:md.map(r=>+r.avail.toFixed(2)),
          borderColor:MCOLORS[m],backgroundColor:MCOLORS[m]+'22',fill:true,tension:.3,pointRadius:2,borderWidth:2}]},
      options:{...baseOpts(),scales:{
        x:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:8},maxRotation:50,maxTicksLimit:10}},
        y:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{size:9}},min:0,max:100,},
      },plugins:{legend:{display:false}}}
    });
  });

  // Availability heatmap: date × machine
  const dates4=Object.keys(dateMap4).sort((a,b)=>{const pa=a.split('.'),pb=b.split('.');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).slice(-30);

  const hmEl2=document.getElementById('heatmap-avail');
  hmEl2.innerHTML=`
    <table style="border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:11px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 12px;color:var(--muted);font-size:9px;letter-spacing:.1em;border-bottom:2px solid var(--border);width:110px;">DATE</th>
          ${MACHINES.map(m=>`
            <th style="text-align:center;padding:8px 16px;color:${MCOLORS[m]};font-size:11px;font-family:var(--font-head);letter-spacing:.08em;border-bottom:2px solid ${MCOLORS[m]}44;font-weight:700;">
              ${m}
            </th>
          `).join('')}
          <th style="text-align:center;padding:8px 12px;color:var(--muted);font-size:9px;letter-spacing:.1em;border-bottom:2px solid var(--border);">AVG</th>
        </tr>
      </thead>
      <tbody>
        ${dates4.map((dt,rowIdx)=>{
          const rowVals = MACHINES.map(m=>{
            const arr=dateMap4[dt]?.[m]||[];
            return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
          });
          const validVals = rowVals.filter(v=>v!==null);
          const rowAvg = validVals.length ? validVals.reduce((a,b)=>a+b,0)/validVals.length : null;
          const rowBg = rowIdx%2===0 ? 'rgba(10,22,40,0.4)' : 'transparent';
          return `<tr style="background:${rowBg}">
            <td style="padding:7px 12px;color:var(--text);font-size:10px;white-space:nowrap;border-bottom:1px solid rgba(26,45,74,0.3);">${dt}</td>
            ${rowVals.map((v,mi)=>{
              if(v===null) return `<td style="text-align:center;padding:7px 16px;color:var(--muted);font-size:11px;border-bottom:1px solid rgba(26,45,74,0.3);">—</td>`;
              const bg = v>85 ? `rgba(0,229,160,${0.12+v/100*0.55})` : v>70 ? `rgba(255,217,74,${0.12+v/100*0.45})` : `rgba(255,59,92,${0.15+(1-v/100)*0.6})`;
              const fg = v>85 ? '#00e5a0' : v>70 ? '#ffd94a' : '#ff3b5c';
              const bold = v<60 ? 'font-weight:700;' : '';
              return `<td style="text-align:center;padding:7px 16px;background:${bg};color:${fg};${bold}border-bottom:1px solid rgba(26,45,74,0.3);border-radius:3px;" title="${MACHINES[mi]} on ${dt}: ${v.toFixed(1)}%">${v.toFixed(1)}%</td>`;
            }).join('')}
            <td style="text-align:center;padding:7px 12px;color:${rowAvg!==null?(rowAvg>85?'#00e5a0':rowAvg>70?'#ffd94a':'#ff3b5c'):'var(--muted)'};font-size:10px;border-bottom:1px solid rgba(26,45,74,0.3);font-weight:600;">${rowAvg!==null?rowAvg.toFixed(1)+'%':'—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Pivot: incharge × shift
  const pivIncharges=Object.keys(pivData).sort().slice(0,10);
  const pivEl=document.getElementById('pivot-avail');
  pivEl.innerHTML=`<table style="width:100%;font-size:11px;">
    <thead><tr><th>INCHARGE</th><th>SHIFT A</th><th>SHIFT B</th><th>SHIFT C</th><th>OVERALL AVG</th></tr></thead>
    <tbody>${pivIncharges.map(ic=>{
      const avg2=(s)=>{ const arr=pivData[ic][s]||[]; return arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)+'%':'—'; };
      const all=Object.values(pivData[ic]).flat();
      const oa=all.length?(all.reduce((a,b)=>a+b,0)/all.length).toFixed(1)+'%':'—';
      return `<tr>
        <td style="font-weight:600">${ic}</td>
        <td style="color:var(--accent)">${avg2('A')}</td>
        <td style="color:var(--accent2)">${avg2('B')}</td>
        <td style="color:var(--accent4)">${avg2('C')}</td>
        <td class="bold">${oa}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ══════════════════════════════════
//  ML PREDICTIONS
// ══════════════════════════════════
function renderML(){
  const d=filteredData;

  // Only show machines that have actual uploaded data
  const uploadedMachines = [...new Set(d.map(r => r.machine))];
  const activeMachines = MACHINES.filter(m => uploadedMachines.includes(m));

  if (activeMachines.length === 0) {
    document.getElementById('kpi-ml').innerHTML = `
      <div style="color:var(--muted);padding:20px;font-size:13px;">
        No data uploaded. Use the Upload tab to load Excel files.
      </div>`;
    ['pred-next','ml-insights'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  // Find latest reference date
  let latestDate = new Date();
  if (d.length > 0) {
    let maxTime = 0;
    for (let i = 0; i < d.length; i++) {
      const t = d[i]._parsedDate ? d[i]._parsedDate.getTime() : 0;
      if (t > maxTime) maxTime = t;
    }
    if (maxTime > 0) latestDate = new Date(maxTime);
  }

  // Pre-sort d once by parsed date
  const sortedD = [...d].sort((a, b) => (a._parsedDate || 0) - (b._parsedDate || 0));

  // Pre-build mach-date breakdown count map for rolling chart
  const machDateBreakdownCount = {};
  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const hasBreakdown = r.delays.some(dl => dl._normType === 'MAINTENANCE BREAKDOWN');
    if (hasBreakdown) {
      const k = `${r.machine}__${r.date}`;
      machDateBreakdownCount[k] = (machDateBreakdownCount[k] || 0) + 1;
    }
  }

  // Per machine: rolling avg of breakdown intervals
  const mlData={};
  activeMachines.forEach(m=>{
    const mShifts = sortedD.filter(r => r.machine === m);
    const breakdownDates=[];
    mShifts.forEach(r=>{
      if(r.delays.some(dl=>dl._normType==='MAINTENANCE BREAKDOWN')) {
        breakdownDates.push(r._parsedDate);
      }
    });
    
    const intervals=[];
    for(let i=1;i<breakdownDates.length;i++){
      intervals.push((breakdownDates[i]-breakdownDates[i-1])/(1000*3600*24));
    }
    const avgInterval=intervals.length?intervals.slice(-10).reduce((a,b)=>a+b,0)/Math.min(intervals.length,10):0;
    const lastBreakdown=breakdownDates[breakdownDates.length-1];
    const daysSince=lastBreakdown?(latestDate-lastBreakdown)/(1000*3600*24):null;
    const riskScore=avgInterval>0&&daysSince!==null?Math.min(100,daysSince/avgInterval*100):0;
    const daysUntil=avgInterval-daysSince;

    // MTTR
    const maintEvents=[];
    for (let i = 0; i < mShifts.length; i++) {
      const r = mShifts[i];
      for (let j = 0; j < r.delays.length; j++) {
        const dl = r.delays[j];
        if (dl._normType === 'MAINTENANCE BREAKDOWN') {
          maintEvents.push(dl.time);
        }
      }
    }
    const mttr=maintEvents.length?maintEvents.reduce((a,b)=>a+b,0)/maintEvents.length:0;
    const mtbf=intervals.length?avgInterval*1440:0; // convert days to minutes

    mlData[m]={avgInterval,daysSince,riskScore,daysUntil,mttr,mtbf,breakdowns:breakdownDates.length,intervals};
  });

  document.getElementById('kpi-ml').innerHTML=activeMachines.map(m=>{
    const ml=mlData[m];
    const risk=ml.riskScore;
    const color=risk>75?'var(--danger)':risk>50?'var(--accent4)':'var(--accent3)';
    return `<div class="kpi hero" style="--kpi-color:${color}">
      <div class="kpi-val">${risk.toFixed(0)}%</div>
      <div class="kpi-lbl">${m} BREAKDOWN RISK</div>
      <div class="kpi-sub">Avg MTBF: ${ml.avgInterval.toFixed(1)} days</div>
    </div>`;
  }).join('')+`
    <div class="kpi" style="--kpi-color:var(--accent)">
      <div class="kpi-val">EWA</div>
      <div class="kpi-lbl">ML MODEL</div>
      <div class="kpi-sub">Exponential Weighted Avg</div>
    </div>
  `;

  // Prediction cards
  document.getElementById('pred-next').innerHTML=activeMachines.map(m=>{
    const ml=mlData[m];
    const risk=ml.riskScore;
    const riskClass=risk>75?'risk-high':risk>50?'risk-med':'risk-low';
    const riskLabel=risk>75?'HIGH RISK':risk>50?'MODERATE':'LOW RISK';
    const daysTxt=ml.daysUntil>0?`in ~${ml.daysUntil.toFixed(0)} days`:'OVERDUE';
    return `<div class="pred-row ${riskClass}">
      <div>
        <div class="pred-machine">${m}</div>
        <div class="pred-val">${riskLabel}</div>
        <div style="font-size:10px;color:var(--muted)">Next predicted breakdown: <span style="color:var(--accent4)">${daysTxt}</span></div>
      </div>
      <div class="pred-conf">
        <div style="font-family:var(--font-head);font-size:20px;color:${risk>75?'var(--danger)':risk>50?'var(--accent4)':'var(--accent3)'}">${risk.toFixed(0)}%</div>
        <div>Risk Score</div>
        <div style="margin-top:4px">${ml.breakdowns} events logged</div>
      </div>
    </div>`;
  }).join('');

  // MTTR/MTBF chart
  mkChart('chart-ml-mttr',{
    type:'bar',
    data:{labels:activeMachines,datasets:[
      {label:'MTTR (min)',data:activeMachines.map(m=>+mlData[m].mttr.toFixed(1)),backgroundColor:'rgba(255,107,43,0.7)',borderColor:'#ff6b2b',borderWidth:1},
      {label:'MTBF (min)',data:activeMachines.map(m=>+mlData[m].mtbf.toFixed(1)),backgroundColor:'rgba(0,229,160,0.5)',borderColor:'#00e5a0',borderWidth:1},
    ]},
    options:baseOpts()
  });

  // Rolling dates from sortedD
  const allDates=[];
  const seenDates = new Set();
  for (let i = 0; i < sortedD.length; i++) {
    const dt = sortedD[i].date;
    if (!seenDates.has(dt)) {
      seenDates.add(dt);
      allDates.push(dt);
    }
  }
  const rollingDates=allDates.slice(-30);

  mkChart('chart-ml-rolling',{
    type:'line',
    data:{labels:rollingDates,datasets:activeMachines.map(m=>({
      label:m,
      data:rollingDates.map(dt=>{
        const idx=allDates.indexOf(dt);
        const window7=allDates.slice(Math.max(0,idx-6),idx+1);
        let sum = 0;
        for (let w = 0; w < window7.length; w++) {
          sum += machDateBreakdownCount[`${m}__${window7[w]}`] || 0;
        }
        return sum;
      }),
      borderColor:MCOLORS[m],backgroundColor:'transparent',tension:.3,pointRadius:2,borderWidth:2,
    }))},
    options:{...baseOpts(),plugins:{...baseOpts().plugins}}
  });

  // Risk trend
  mkChart('chart-ml-risk',{
    type:'bar',
    data:{labels:activeMachines,datasets:[{
      label:'Risk Score (%)',data:activeMachines.map(m=>+mlData[m].riskScore.toFixed(1)),
      backgroundColor:activeMachines.map(m=>{ const r=mlData[m].riskScore; return r>75?'rgba(255,59,92,0.7)':r>50?'rgba(255,217,74,0.7)':'rgba(0,229,160,0.7)'; }),
      borderColor:activeMachines.map(m=>{ const r=mlData[m].riskScore; return r>75?'#ff3b5c':r>50?'#ffd94a':'#00e5a0'; }),
      borderWidth:1,
    }]},
    options:{...baseOpts(),scales:{...baseOpts().scales,y:{...baseOpts().scales.y,min:0,max:100}},plugins:{legend:{display:false}}}
  });

  // Insights
  const ins=activeMachines.map(m=>{
    const ml=mlData[m];
    const risk=ml.riskScore;
    const icon=risk>75?'🔴':risk>50?'🟡':'🟢';
    const action=risk>75?`<strong>Immediate preventive maintenance recommended.</strong> Schedule inspection within 24 hours. Last breakdown interval was ${ml.avgInterval.toFixed(1)} days.`:
      risk>50?`Plan maintenance within ${ml.daysUntil.toFixed(0)} days. Monitor closely for early signs of failure.`:
      `Machine is operating normally. Continue regular maintenance schedule.`;
    return `<div style="padding:10px 14px;background:var(--panel2);border-radius:6px;margin-bottom:8px;border-left:3px solid ${risk>75?'var(--danger)':risk>50?'var(--accent4)':'var(--accent3)'}">
      <div style="font-family:var(--font-head);font-size:14px;margin-bottom:4px;">${icon} ${m} – ${risk.toFixed(0)}% Breakdown Risk</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">${action}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px;font-family:var(--font-mono)">MTTR: ${ml.mttr.toFixed(0)} min · MTBF: ${ml.mtbf.toFixed(0)} min · ${ml.breakdowns} breakdowns logged</div>
    </div>`;
  }).join('');
  document.getElementById('ml-insights').innerHTML=ins+`
    <div style="font-size:10px;color:var(--muted);padding:8px;border-top:1px solid var(--border);margin-top:4px">
      ⚙ ML Model: Exponential Weighted Average on historical breakdown intervals. Risk score = days since last breakdown / avg MTBF × 100. 
      For production deployment, integrate LSTM/Random Forest on full sensor data for higher accuracy.
    </div>
  `;
  
  // Call the FastAPI-based RUL predictions
  if (typeof renderRULPredictions === 'function') {
    renderRULPredictions();
  }
}