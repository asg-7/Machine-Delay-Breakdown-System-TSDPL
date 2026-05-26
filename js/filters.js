// Normalize incharge names (handle typos)
function normIncharge(name){
  if(!name||name==='nan') return 'UNKNOWN';
  const n=name.trim().toUpperCase();
  if(n.includes('NAGESHWAR')) return 'NAGESHWAR REDDY';
  if(n.includes('SUNIL')) return 'SUNIL PRADHAN';
  if(n.includes('RAHUL')) return 'RAHUL KUMAR';
  if(n.includes('JAGANNATH')||n.includes('JAGANATH')) return 'JAGANNATH REDDY';
  if(n.includes('DIGANTA')) return 'DIGANTA SAHU';
  if(n.includes('ASHISH')) return 'ASHISH SINGH';
  if(n.includes('RAVI')) return 'RAVI MAHATO';
  if(n.includes('VIKRAM')) return 'VIKRAM SINGH';
  if(n.includes('CHETAN')) return 'CHETAN SINGH';
  return n;
}

// Normalize delay types — covers raw Excel text variants from operators
function normDelay(t){
  if(!t||t==='nan'||t===''||t===null||t===undefined) return 'OTHER';
  const u=String(t).toUpperCase().trim();

  // ── Maintenance Breakdown (check BEFORE generic maintenance) ──
  if(u.includes('MAINTENANCE BREAKDOWN')||u.includes('MAINT BREAKDOWN')||
     u.includes('M/C BREAKDOWN')||u.includes('MACHINE BREAKDOWN')||
     u.includes('BREAKDOWN')||u.includes('BREAK DOWN')||
     u.includes('FAILURE')||u.includes('FAULT')||u.includes('TRIP')||
     u.includes('REPAIR')) return 'MAINTENANCE BREAKDOWN';

  // ── Maintenance Daily Checklist ──
  if(u.includes('DAILY CHECKLIST')||u.includes('MAINTENANCE DAILY')||
     u.includes('MAINT CHECKLIST')||u.includes('MAINTENANCE CHECKLIST')||
     u.includes('DAILY CHECK')) return 'MAINTENANCE DAILY CHECKLIST';

  // ── Planned Maintenance ──
  if(u.includes('PLANNED MAINTENANCE')||u.includes('PLANNED MAINT')||
     u.includes('PM ')||u==='PM') return 'PLANNED MAINTENANCE';

  // ── Generic maintenance fallback (after specific ones above) ──
  if(u.includes('MAINTENANCE')||u.includes('MAINT')) return 'MAINTENANCE BREAKDOWN';

  // ── Coil Feeding ──
  if(u.includes('COIL FEEDING')||u.includes('COIL FEED')||
     u.includes('TOTAL COIL')||u.includes('COIL DELAY')) return 'COIL FEEDING DELAY';

  // ── Quality ──
  if(u.includes('QUALITY INSPECTION')||u.includes('TOTAL QUALITY')||
     u.includes('QUALITY')) return 'QUALITY DELAY';

  // ── Packaging / Shifting / Packet ──
  if(u.includes('PACKET SHIFTING')||u.includes('PACKAGE SHIFTING')||
     u.includes('PACKAGING SHIFTING')||u.includes('PACKET SHIFTING/PACKAGING')) return 'PACKAGE SHIFTING';
  if(u.includes('PACKET')||u.includes('PACKAGING')||u.includes('PACKING')||
     u.includes('PACK ')) return 'PACKAGING DELAY';

  // ── Shift Handover / TBT ──
  if(u.includes('SHIFT HAND')||u.includes('HANDOVER')||u.includes('HAND OVER')) return 'SHIFT HANDOVER';
  if(u.includes('TBT')||u.includes('TOOL BOX TALK')||u.includes('TOOLBOX')) return 'TBT';

  // ── Scrap ──
  if(u.includes('SCRAP SCHEDULE')) return 'SCRAP SCHEDULE';
  if(u.includes('SCRAP')) return 'SCRAP REMOVAL';

  // ── Crane ──
  if(u.includes('CRANE')) return 'CRANE DELAY';

  // ── Operation / Setup ──
  if(u.includes('OPERATION')||u.includes('OPRATION')||u.includes('OPERATIONAL')) return 'OPERATION DELAY';
  if(u.includes('SETUP')||u.includes('SET UP')||u.includes('SET-UP')) return 'SETUP DELAY';

  // ── Communication / HR / Schedule ──
  if(u.includes('COMMUNICATION')||u.includes('MEETING')||u.includes('COMM ')) return 'COMMUNICATION DELAY';
  if(u.includes('HR ')||u==='HR'||u.includes('HUMAN RESOURCE')) return 'HR DELAY';
  if(u.includes('SCHEDULE')) return 'SCHEDULE DELAY';

  // ── Explicit "OTHER" (catch last so nothing leaks in early) ──
  if(u==='OTHER'||u==='OTHER DELAY') return 'OTHER';

  // Unknown → OTHER
  return 'OTHER';
}

/**
 * Returns total downtime EXCLUDING "OTHER" delay category.
 */
function getDowntimeExcludingOther(delays){
  return delays
    .filter(d => (d._normType || normDelay(d.type)) !== 'OTHER')
    .reduce((sum, d) => sum + d.time, 0);
}

/**
 * Returns total downtime from MAINTENANCE BREAKDOWN delays only.
 */
function getMaintenanceBreakdownDowntime(delays) {
  const BREAKDOWN_DESC_KEYWORDS = ['breakdown','break down','failure','repair','fault','trip'];
  return delays
    .filter(d => {
      const nt = d._normType || normDelay(d.type || '');
      if (nt === 'MAINTENANCE BREAKDOWN') return true;
      const desc = ((d.reason || d.description) || '').toLowerCase();
      return BREAKDOWN_DESC_KEYWORDS.some(kw => desc.includes(kw));
    })
    .reduce((sum, d) => sum + d.time, 0);
}

function isMaintenance(type){
  return normDelay(type)==='MAINTENANCE BREAKDOWN';
}

function prepareRawData() {
  if (!window.RAW_DATA) return;
  for (let i = 0; i < window.RAW_DATA.length; i++) {
    const r = window.RAW_DATA[i];
    if (r._parsedDate === undefined) {
      r._parsedDate = parseDate(r.date);
      r._normIncharge = normIncharge(r.incharge);
      for (let j = 0; j < r.delays.length; j++) {
        r.delays[j]._normType = normDelay(r.delays[j].type);
      }
      r.totalDelayMin = r.delays.reduce((sum, d) => sum + d.time, 0);
      const effectiveDelay = getDowntimeExcludingOther(r.delays);
      r.availabilityPct = Math.max(0, ((480 - effectiveDelay) / 480 * 100));
    }
  }
}

function populateFilters(){
  const sel=document.getElementById('f-incharge');
  while(sel.options.length>1) sel.remove(1);
  const ds=document.getElementById('f-delay');
  while(ds.options.length>1) ds.remove(1);

  prepareRawData();

  const incharges=[...new Set(RAW_DATA.map(r=>r._normIncharge))].filter(x=>x&&x!=='UNKNOWN').sort();
  incharges.forEach(i=>{const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o);});

  const dtypes=[...new Set(RAW_DATA.flatMap(r=>r.delays.map(d=>d._normType)))].sort();
  dtypes.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;ds.appendChild(o);});
}

function parseDate(s){
  if(!s||s==='nan') return null;
  const p=s.split('.');
  if(p.length===3) return new Date(p[2],p[1]-1,p[0]);
  return null;
}

function applyFilters(){
  const fm=document.getElementById('f-machine').value;
  const fs=document.getElementById('f-shift').value;
  const fi=document.getElementById('f-incharge').value;
  const fd=document.getElementById('f-delay').value;
  const df=document.getElementById('f-date-from').value;
  const dt=document.getElementById('f-date-to').value;
  const dfDate=df?parseDate(df):null;
  const dtDate=dt?parseDate(dt):null;

  prepareRawData();

  window.filterRevision = (window.filterRevision || 0) + 1;

  filteredData=RAW_DATA.filter(r=>{
    if(fm!=='ALL'&&r.machine!==fm) return false;
    if(fs!=='ALL'&&r.shift!==fs) return false;
    if(fi!=='ALL'&&r._normIncharge!==fi) return false;
    if(fd!=='ALL'){
      const hasDelay=r.delays.some(d=>d._normType===fd);
      if(!hasDelay) return false;
    }
    const rd=r._parsedDate;
    if(dfDate&&rd&&rd<dfDate) return false;
    if(dtDate&&rd&&rd>dtDate) return false;
    return true;
  });

  updateHeader();
  renderPage(document.querySelector('.tab.active').dataset.page);
}