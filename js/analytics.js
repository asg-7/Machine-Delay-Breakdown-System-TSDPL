// Availability formula: (480 - totalDelay) / 480 * 100
function getAvailability(shift){
  if (shift.availabilityPct !== undefined) return shift.availabilityPct;
  const td = shift.delays.reduce((s,d)=>s+d.time,0);
  return Math.max(0,((480-td)/480*100));
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
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${(totalDelay/60).toFixed(0)}h</div><div class="kpi-lbl">TOTAL DOWNTIME</div>
      <div class="kpi-sub">${totalDelay.toFixed(0)} minutes</div>
    </div>
    <div class="kpi" style="--kpi-color:#a78bfa">
      <div class="kpi-val">${avail.toFixed(1)}%</div><div class="kpi-lbl">AVG AVAILABILITY</div>
      <div class="kpi-sub">Machine uptime</div>
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
}// ══════════════════════════════════
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
}

function renderProdTable(){
  // Only render if Production page is active
  const pageProd = document.getElementById('page-production');
  if (!pageProd || !pageProd.classList.contains('active')) return;

  const search=(document.getElementById('prod-search')||{}).value?.toLowerCase()||'';
  const role=(document.getElementById('prod-filter-role')||{}).value||'ALL';
  const SUPERVISORS=['NAGESHWAR REDDY','SUNIL PRADHAN','RAHUL KUMAR','JAGANNATH REDDY','DIGANTA SAHU'];

  const rows=filteredData.filter(r=>{
    const ic=r._normIncharge;
    if(role==='SUPERVISOR'&&!SUPERVISORS.includes(ic)) return false;
    if(search&&![r.date,ic,r.team,r.machine].join(' ').toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody=document.getElementById('prod-tbody');
  if(!tbody) return;
  tbody.innerHTML=rows.slice(0,200).map(r=>{
    const avail=getAvailability(r);
    const aColor=avail>85?'#00e5a0':avail>70?'#ffd94a':'#ff3b5c';
    const totalDelayMin = r.totalDelayMin !== undefined ? r.totalDelayMin : r.delays.reduce((s,d)=>s+d.time,0);
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:10px">${r.date}</td>
      <td style="color:${MCOLORS[r.machine]};font-weight:600">${r.machine}</td>
      <td><span class="pill pill-${r.shift?.toLowerCase()}">${r.shift}</span></td>
      <td>${r._normIncharge}</td>
      <td style="font-size:11px">${r.team||'—'}</td>
      <td style="text-align:right">${r.coils||0}</td>
      <td style="text-align:right;font-weight:600;color:var(--accent3)">${r.tonnage?.toFixed?.(1)||0}</td>
      <td style="text-align:right;color:var(--accent2)">${totalDelayMin.toFixed(0)}</td>
      <td style="text-align:right;color:${aColor};font-family:var(--font-mono)">${avail.toFixed(1)}%</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════
//  DELAYS
// ══════════════════════════════════
function renderDelays(){
  const d=filteredData;
  const allDelays=[];
  let totalTime=0;
  let maintTime=0;
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

      dt[typeNorm] = (dt[typeNorm] || 0) + dl.time;

      const k = `${inchargeNorm}__${typeNorm}`;
      hmData[k] = (hmData[k] || 0) + dl.time;

      if (!dateMap2[r.date]) dateMap2[r.date] = {};
      dateMap2[r.date][typeNorm] = (dateMap2[r.date][typeNorm] || 0) + dl.time;

      if (allDelays.length < 200) {
        allDelays.push({
          time: dl.time,
          type: typeNorm,
          date: r.date,
          machine: r.machine,
          incharge: inchargeNorm,
          shift: r.shift,
          description: dl.description
        });
      }
    }
  }

  document.getElementById('kpi-delays').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${totalTime.toFixed(0)} min</div><div class="kpi-lbl">TOTAL DELAY TIME</div>
      <div class="kpi-sub">${(totalTime/60).toFixed(1)} hours</div></div>
    <div class="kpi hero" style="--kpi-color:var(--accent2)">
      <div class="kpi-val">${delayEventsCount}</div><div class="kpi-lbl">TOTAL DELAY EVENTS</div></div>
    <div class="kpi" style="--kpi-color:#ff3b5c">
      <div class="kpi-val">${maintTime.toFixed(0)} min</div><div class="kpi-lbl">MAINTENANCE DOWNTIME</div>
      <div class="kpi-sub">${d.length?+(maintTime/d.length).toFixed(1):0} min/shift avg</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
      <div class="kpi-val">${d.length?(totalTime/d.length).toFixed(0):0} min</div>
      <div class="kpi-lbl">AVG DELAY/SHIFT</div></div>
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
  const dtypes=[...uniqueTypes].sort().slice(0,8);
  const maxHm=Math.max(...Object.values(hmData),1);

  const hmEl=document.getElementById('heatmap-delay');
  hmEl.innerHTML=`
    <div class="hmap-labels-row" style="margin-left:114px">
      ${dtypes.map(t=>`<div class="hmap-label" style="min-width:80px">${t.length>10?t.slice(0,10)+'…':t}</div>`).join('')}
    </div>
    ${incharges.map(ic=>`
      <div class="hmap-row">
        <div class="hmap-row-label">${ic.split(' ')[0]}</div>
        ${dtypes.map(dt=>{
          const v=hmData[`${ic}__${dt}`]||0;
          const pct=v/maxHm;
          const bg=pct>0?`rgba(255,59,92,${0.1+pct*0.9})`:'rgba(16,28,48,0.5)';
          const fg=pct>0.5?'#fff':'#9ca3af';
          return `<div class="hmap-cell" style="background:${bg};color:${fg};min-width:80px;flex:1" title="${ic} · ${dt}: ${v} min">${v>0?v.toFixed(0):''}</div>`;
        }).join('')}
      </div>
    `).join('')}
  `;

  // Delay trend
  const dateMap2Dates = Object.keys(dateMap2).sort((a,b)=>{const pa=a.split('.'),pb=b.split('.');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).slice(-35);
  const top5types=sorted.slice(0,5).map(x=>x[0]);
  mkChart('chart-delay-trend',{
    type:'line',
    data:{labels:dateMap2Dates,datasets:top5types.map(t=>({
      label:t,data:dateMap2Dates.map(dt=>dateMap2[dt]?.[t]||0),
      borderColor:delayColor(t),backgroundColor:'transparent',tension:.3,pointRadius:1,borderWidth:1.5,
    }))},
    options:{...baseOpts(),plugins:{...baseOpts().plugins,legend:{labels:{color:'#e0eeff',font:{size:9}}}}}
  });

  // Delay log table
  const tbody=document.getElementById('delay-tbody');
  if(tbody){
    tbody.innerHTML=allDelays.map(x=>{
      const cat=(x.type==='MAINTENANCE BREAKDOWN'||x.type==='MAINTENANCE DAILY CHECKLIST')?'MAINTENANCE':x.type==='QUALITY DELAY'?'QUALITY':x.type==='OPERATION DELAY'?'OPERATION':'OTHER';
      const catColor={'MAINTENANCE':'var(--danger)','QUALITY':'#a78bfa','OPERATION':'var(--accent3)','OTHER':'var(--muted)'}[cat];
      return `<tr>
        <td style="font-family:var(--font-mono);font-size:10px">${x.date}</td>
        <td style="color:${MCOLORS[x.machine]||'#fff'}">${x.machine}</td>
        <td><span class="pill pill-${x.shift?.toLowerCase()}">${x.shift}</span></td>
        <td>${x.incharge}</td>
        <td style="color:${delayColor(x.type)};font-size:11px">${x.type}</td>
        <td style="text-align:right;font-weight:600;color:var(--accent2)">${x.time}</td>
        <td style="font-size:11px;color:var(--muted)">${x.description||'—'}</td>
        <td><span style="color:${catColor};font-size:10px;font-family:var(--font-mono)">${cat}</span></td>
      </tr>`;
    }).join('');
  }
}

// ══════════════════════════════════
//  MAINTENANCE
// ══════════════════════════════════
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

        if (maintEvents.length < 200) {
          maintEvents.push({
            time: dl.time,
            type: 'MAINTENANCE BREAKDOWN',
            date: r.date,
            machine: r.machine,
            incharge: inchargeNorm,
            shift: r.shift,
            description: dl.description
          });
        }
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
      <td style="font-size:11px;color:var(--muted)">${x.description||'—'}</td>
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
  
  const allAvail=[];
  const dateMap4={};
  const pivData={};

  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const avail = getAvailability(r);
    const rWithAvail = { ...r, avail };
    allAvail.push(rWithAvail);

    availSum += avail;
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

  document.getElementById('kpi-avail').innerHTML=`
    <div class="kpi hero" style="--kpi-color:var(--accent3)">
      <div class="kpi-val">${avg.toFixed(1)}%</div><div class="kpi-lbl">AVG AVAILABILITY</div></div>
    <div class="kpi hero" style="--kpi-color:var(--danger)">
      <div class="kpi-val">${minR.date ? minR.avail.toFixed(1) + '%' : '—'}</div><div class="kpi-lbl">LOWEST AVAILABILITY</div>
      <div class="kpi-sub">${minR.date ? `${minR.date} · ${minR.machine}` : 'No data loaded'}</div></div>
    <div class="kpi" style="--kpi-color:var(--accent)">
      <div class="kpi-val">${maxR.date ? maxR.avail.toFixed(1) + '%' : '—'}</div><div class="kpi-lbl">HIGHEST AVAILABILITY</div>
      <div class="kpi-sub">${maxR.date ? `${maxR.date} · ${maxR.machine}` : 'No data loaded'}</div></div>
    <div class="kpi" style="--kpi-color:var(--accent4)">
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
  const dates4=Object.keys(dateMap4).sort((a,b)=>{const pa=a.split('.'),pb=b.split('.');return new Date(pa[2],pa[1]-1,pa[0])-new Date(pb[2],pb[1]-1,pb[0]);}).slice(-25);

  const hmEl2=document.getElementById('heatmap-avail');
  hmEl2.innerHTML=`
    <div class="hmap-labels-row" style="margin-left:90px">
      ${MACHINES.map(m=>`<div class="hmap-label" style="min-width:80px;color:${MCOLORS[m]}">${m}</div>`).join('')}
    </div>
    ${dates4.map(dt=>`
      <div class="hmap-row">
        <div class="hmap-row-label" style="width:90px">${dt}</div>
        ${MACHINES.map(m=>{
          const arr=dateMap4[dt]?.[m]||[];
          const v=arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
          if(v===null) return `<div class="hmap-cell" style="background:rgba(16,28,48,0.3);min-width:80px;flex:1">—</div>`;
          const g=v>85?`rgba(0,229,160,${0.2+v/100*0.7})`:v>70?`rgba(255,217,74,${0.3+v/100*0.5})`:`rgba(255,59,92,${0.3+v/100*0.5})`;
          const fg=v>85?'#00e5a0':v>70?'#ffd94a':'#ff3b5c';
          return `<div class="hmap-cell" style="background:${g};color:${fg};min-width:80px;flex:1;font-size:10px" title="${m} ${dt}: ${v.toFixed(1)}%">${v.toFixed(0)}%</div>`;
        }).join('')}
      </div>
    `).join('')}
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
  MACHINES.forEach(m=>{
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

  document.getElementById('kpi-ml').innerHTML=MACHINES.map(m=>{
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
  document.getElementById('pred-next').innerHTML=MACHINES.map(m=>{
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
    data:{labels:MACHINES,datasets:[
      {label:'MTTR (min)',data:MACHINES.map(m=>+mlData[m].mttr.toFixed(1)),backgroundColor:'rgba(255,107,43,0.7)',borderColor:'#ff6b2b',borderWidth:1},
      {label:'MTBF (min)',data:MACHINES.map(m=>+mlData[m].mtbf.toFixed(1)),backgroundColor:'rgba(0,229,160,0.5)',borderColor:'#00e5a0',borderWidth:1},
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
    data:{labels:rollingDates,datasets:MACHINES.map(m=>({
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
    data:{labels:MACHINES,datasets:[{
      label:'Risk Score (%)',data:MACHINES.map(m=>+mlData[m].riskScore.toFixed(1)),
      backgroundColor:MACHINES.map(m=>{ const r=mlData[m].riskScore; return r>75?'rgba(255,59,92,0.7)':r>50?'rgba(255,217,74,0.7)':'rgba(0,229,160,0.7)'; }),
      borderColor:MACHINES.map(m=>{ const r=mlData[m].riskScore; return r>75?'#ff3b5c':r>50?'#ffd94a':'#00e5a0'; }),
      borderWidth:1,
    }]},
    options:{...baseOpts(),scales:{...baseOpts().scales,y:{...baseOpts().scales.y,min:0,max:100}},plugins:{legend:{display:false}}}
  });

  // Insights
  const ins=MACHINES.map(m=>{
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
}
