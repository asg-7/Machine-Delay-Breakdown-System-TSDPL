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

// Normalize delay types
function normDelay(t){
  if(!t||t==='nan') return 'OTHER';
  const u=t.toUpperCase().trim();
  if(u.includes('MAINTENANCE BREAKDOWN')) return 'MAINTENANCE BREAKDOWN';
  if(u.includes('MAINTENANCE DAILY')) return 'MAINTENANCE DAILY CHECKLIST';
  if(u.includes('COIL FEEDING')) return 'COIL FEEDING DELAY';
  if(u.includes('QUALITY')) return 'QUALITY DELAY';
  if(u.includes('PACKET')||u.includes('PACKAGING')||u.includes('PACKING')) return 'PACKAGING DELAY';
  if(u.includes('SHIFT HAND')) return 'SHIFT HANDOVER';
  if(u.includes('OPERATION')||u.includes('OPRATION')) return 'OPERATION DELAY';
  if(u.includes('CRANE')) return 'CRANE DELAY';
  if(u.includes('SCRAP')) return 'SCRAP REMOVAL';
  if(u.includes('SETUP')) return 'SETUP DELAY';
  if(u.includes('TBT')) return 'TBT';
  if(u.includes('COMMUNICATION')||u.includes('MEETING')) return 'COMMUNICATION DELAY';
  if(u.includes('HR')) return 'HR DELAY';
  if(u.includes('SCHEDULE')) return 'SCHEDULE DELAY';
  return 'OTHER';
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
      r.totalDelayMin = r.delays.reduce((sum, d) => sum + d.time, 0);
      r.availabilityPct = Math.max(0, ((480 - r.totalDelayMin) / 480 * 100));
      for (let j = 0; j < r.delays.length; j++) {
        r.delays[j]._normType = normDelay(r.delays[j].type);
      }
    }
  }
}

function populateFilters(){
  // Clear dynamic options first to prevent duplicates on re-upload
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
