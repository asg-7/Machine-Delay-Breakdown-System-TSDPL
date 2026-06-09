// Global State Repository
if (typeof RAW_DATA === 'undefined') {
  var RAW_DATA = [];
}
let filteredData = [];

function updateClock() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (5.5 * 3600000));
  const h = ist.getHours();
  let shift = 'C';
  let workDate = new Date(ist);
  
  if (h >= 6 && h < 14) shift = 'A';
  else if (h >= 14 && h < 22) shift = 'B';
  else {
    shift = 'C';
    if (h < 6) workDate.setDate(workDate.getDate() - 1);
  }

  const dd = String(workDate.getDate()).padStart(2, '0');
  const mm = String(workDate.getMonth() + 1).padStart(2, '0');
  const yy = workDate.getFullYear();
  
  const hdr = document.getElementById('hdr-datetime');
  if (hdr) hdr.innerText = `${dd}.${mm}.${yy} / SHIFT ${shift}`;
}

function setupNav(){
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('page-'+t.dataset.page).classList.add('active');
      if (t.dataset.page === 'operator-logs') {
        if (typeof loadAdminLogs === 'function') {
          loadAdminLogs();
        }
      }
      renderPage(t.dataset.page);
    });
  });
}

function setupFilterEvents(){
  document.getElementById('apply-btn').addEventListener('click',applyFilters);
  document.getElementById('reset-btn').addEventListener('click',()=>{
    document.getElementById('f-machine').value='ALL';
    document.getElementById('f-shift').value='ALL';
    document.getElementById('f-incharge').value='ALL';
    document.getElementById('f-delay').value='ALL';
    document.getElementById('f-date-from').value='';
    document.getElementById('f-date-to').value='';
    applyFilters();
  });
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Production table filters
  const searchInput = document.getElementById('prod-search');
  if (searchInput) searchInput.addEventListener('input', debounce(renderProdTable, 250));
  ['prod-filter-role','prod-filter-shift','prod-filter-machine','prod-filter-avail','prod-filter-sort'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', renderProdTable);
  });
  const prodReset = document.getElementById('prod-filter-reset');
  if(prodReset) prodReset.addEventListener('click', ()=>{
    ['prod-filter-role','prod-filter-shift','prod-filter-machine','prod-filter-avail'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='ALL';
    });
    const ps=document.getElementById('prod-filter-sort'); if(ps) ps.value='DATE';
    const si=document.getElementById('prod-search'); if(si) si.value='';
    renderProdTable();
  });

  // Delay table filters
  const delaySearch = document.getElementById('delay-search');
  if(delaySearch) delaySearch.addEventListener('input', debounce(renderDelayTable, 250));
  ['delay-filter-machine','delay-filter-shift','delay-filter-category','delay-filter-sort'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('change', renderDelayTable);
  });
  const delayReset = document.getElementById('delay-filter-reset');
  if(delayReset) delayReset.addEventListener('click', ()=>{
    ['delay-filter-machine','delay-filter-shift','delay-filter-category'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='ALL';
    });
    const ds_sort=document.getElementById('delay-filter-sort'); if(ds_sort) ds_sort.value='DATE';
    const ds=document.getElementById('delay-search'); if(ds) ds.value='';
    renderDelayTable();
  });
}

function updateHeader(){
  // Header KPI elements (TOTAL SHIFTS, TOTAL TONNAGE, AVG AVAILABILITY)
  // were removed per user request. Keep this function as a no-op
  // to avoid errors where callers expect updateHeader to exist.
}

async function runAnomalyDetection(shiftRecords) {
  try {
    const mappedRecords = shiftRecords.map(r => {
      // Format date from DD.MM.YYYY to YYYY-MM-DD
      let yyyymmdd = '';
      if (r.date) {
        const parts = r.date.split('.');
        if (parts.length === 3) {
          yyyymmdd = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      if (!yyyymmdd) {
        yyyymmdd = new Date().toISOString().split('T')[0];
      }

      // Calculate delay durations by category
      let delayBreakdown = 0;
      let delayPlanned = 0;
      let delayOther = 0;
      let breakdownCount = 0;

      if (r.delays && Array.isArray(r.delays)) {
        r.delays.forEach(d => {
          const type = d._normType || (typeof normDelay === 'function' ? normDelay(d.type) : 'OTHER');
          if (type === 'MAINTENANCE BREAKDOWN') {
            delayBreakdown += d.time;
            breakdownCount += 1;
          } else if (type === 'PLANNED MAINTENANCE') {
            delayPlanned += d.time;
          } else {
            delayOther += d.time;
          }
        });
      }

      // Default target tonnage by machine type
      let targetTonnes = 450.0;
      if (r.machine === 'SLITTER') {
        targetTonnes = 300.0;
      }

      return {
        shift_date:         yyyymmdd,
        shift:              r.shift || 'A',
        line:               r.machine || 'UNKNOWN',
        incharge:           r._normIncharge || r.incharge || 'UNKNOWN',
        production_tonnes:  parseFloat(r.tonnage) || 0.0,
        available_hours:    8.0,
        delay_minutes:      parseFloat(r.totalDelayMin) || 0.0,
        breakdown_count:    breakdownCount,
        delay_breakdown:    delayBreakdown,
        delay_planned:      delayPlanned,
        delay_other:        delayOther,
        target_tonnes:      targetTonnes
      };
    });

    const res = await fetch('http://127.0.0.1:8000/api/anomaly/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappedRecords)
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    const { results, anomaly_count } = await res.json();
    // Store on window for analytics.js to consume
    window.ANOMALY_RESULTS = results;
    window.ANOMALY_COUNT = anomaly_count;
    console.log(`Anomaly detection complete: ${anomaly_count} flagged shifts`);
  } catch (e) {
    console.warn('Anomaly detection unavailable (is the FastAPI server running?)', e);
  }
}

async function loadSharedBackendData() {
  // 1. Fetch excel data from backend
  try {
    const res = await fetch('http://127.0.0.1:8000/api/get-data');
    if (res.ok) {
      const serverShifts = await res.json();
      if (Array.isArray(serverShifts) && serverShifts.length > 0) {
        window.RAW_DATA = serverShifts;
        console.log(`Loaded ${serverShifts.length} shifts from FastAPI backend.`);
        updateUCNCards(serverShifts);
      }
    }
  } catch(e) {
    console.warn("FastAPI backend offline or unreachable. Using offline mode.", e);
  }

  // 2. Load operator logs from backend or localStorage, and merge them
  let operatorLogs = [];
  try {
    const res = await fetch('http://127.0.0.1:8000/api/operator-logs');
    if (res.ok) {
      operatorLogs = await res.json();
    }
  } catch(e) {
    console.warn("Backend offline. Loading operator logs from localStorage.");
    operatorLogs = JSON.parse(localStorage.getItem('tsdpl_operator_logs') || '[]');
  }

  if (Array.isArray(operatorLogs) && operatorLogs.length > 0) {
    operatorLogs.forEach(log => {
      const shiftObj = {
        date: log.date,
        shift: log.shift,
        incharge: log.incharge,
        team: log.team,
        machine: log.machine,
        tonnage: log.tonnage,
        coils: log.coils,
        delays: log.delays.map(d => ({
          time: d.time,
          type: d.type,
          description: d.description,
          reason: d.reason
        }))
      };

      // Avoid duplicates
      window.RAW_DATA = window.RAW_DATA.filter(r =>
        !(r.date === shiftObj.date && r.shift === shiftObj.shift && r.machine === shiftObj.machine && r.incharge === shiftObj.incharge && r.team === shiftObj.team)
      );
      window.RAW_DATA.push(shiftObj);
    });
  }
}

function getMinMaxDates(shifts) {
  if (!shifts || shifts.length === 0) return null;
  const dates = [];
  shifts.forEach(s => {
    if (s.date) {
      const parts = s.date.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          dates.push({ dateObj: d, dateStr: s.date });
        }
      }
    }
  });
  if (dates.length === 0) return null;
  dates.sort((a, b) => a.dateObj - b.dateObj);
  return {
    start: dates[0].dateStr,
    end: dates[dates.length - 1].dateStr
  };
}

function updateUCNCards(shifts) {
  const machines = ["SLITTER", "WCTL-1", "WCTL-2"];
  machines.forEach(machine => {
    const machineShifts = shifts.filter(s => s.machine === machine);
    const count = machineShifts.length;
    const key = machine.toLowerCase().replace(/-/g, '');
    const channelId = `ch-${key}`;
    const channelDiv = document.getElementById(channelId);
    
    if (channelDiv) {
      const countSpan = document.getElementById(`cnt-${key}`);
      const pillDiv = document.getElementById(`cnt-${key}-wrap`);
      const hintDiv = document.getElementById(`hint-${key}`);
      const datesDiv = document.getElementById(`dates-${key}`);
      
      if (count > 0) {
        channelDiv.classList.add('loaded');
        if (countSpan) countSpan.textContent = count;
        if (pillDiv) pillDiv.style.display = 'flex';
        if (hintDiv) hintDiv.style.display = 'block';
        
        // Calculate min/max dates
        const dateRange = getMinMaxDates(machineShifts);
        if (dateRange && datesDiv) {
          datesDiv.textContent = `📅 ${dateRange.start} — ${dateRange.end}`;
          datesDiv.style.display = 'block';
        } else if (datesDiv) {
          datesDiv.style.display = 'none';
        }
      } else {
        channelDiv.classList.remove('loaded');
        if (countSpan) countSpan.textContent = '0';
        if (pillDiv) pillDiv.style.display = 'none';
        if (hintDiv) hintDiv.style.display = 'none';
        if (datesDiv) datesDiv.style.display = 'none';
      }
    }
  });
  
  // Also update global count
  const gc = document.getElementById('upload-global-count');
  if (gc) gc.textContent = shifts.length.toLocaleString();
}


async function loadFromSupabase() {
  const overlay = document.getElementById('supabase-loading-overlay');
  try {
    if (!window.supabase) {
      throw new Error("Supabase client not initialized.");
    }
    const { data, error } = await window.supabase
      .from('delay_logs')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;

    if (Array.isArray(data)) {
      window.RAW_DATA = data.map(row => ({
        machine:       row.machine,
        date:          row.date,
        shift:         row.shift,
        incharge:      row.incharge,
        team:          row.team,
        tonnage:       parseFloat(row.tonnage) || 0,
        coils:         parseInt(row.coils) || 0,
        delays:        row.delays || [],
        source:        row.source,
        employeeId:    row.employee_id,
        startTime:     row.start_time,
        endTime:       row.end_time,
        timestamp:     row.timestamp
      }));
      console.log(`Loaded ${window.RAW_DATA.length} records from Supabase.`);
      
      // Update local card UI
      updateUCNCards(window.RAW_DATA);
      
      // Refresh UI state
      if (typeof populateFilters === 'function') populateFilters();
      if (typeof applyFilters === 'function') applyFilters();
      
      // Clear page caches and re-render
      window.filterRevision = (window.filterRevision || 0) + 1;
      window.renderedRevisions = {};
      const activeTab = document.querySelector('.tab.active');
      if (activeTab && typeof renderPage === 'function') {
        renderPage(activeTab.dataset.page);
      }
      
      // Run anomaly detection
      if (typeof runAnomalyDetection === 'function' && window.RAW_DATA.length > 0) {
        runAnomalyDetection(window.RAW_DATA);
      }
    }
  } catch(e) {
    console.warn("Supabase load failed. Falling back to local backend data.", e);
    await loadSharedBackendData();
    if (typeof populateFilters === 'function') populateFilters();
    if (typeof applyFilters === 'function') applyFilters();
  } finally {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 400);
    }
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // Check session first
  if (typeof checkSession === 'function') {
    checkSession();
  }
  
  // Initialize operator clock
  if (typeof initOperatorClock === 'function') {
    initOperatorClock();
  }

  // Load backend data from Supabase
  await loadFromSupabase();

  if (window.RAW_DATA && window.RAW_DATA.length > 0) {
    // Automatically switch active tab/page from upload to overview
    const uploadTab = document.querySelector('.tab[data-page="upload"]');
    const overviewTab = document.querySelector('.tab[data-page="overview"]');
    if (uploadTab && overviewTab) {
      uploadTab.classList.remove('active');
      overviewTab.classList.add('active');
      
      const uploadPage = document.getElementById('page-upload');
      const overviewPage = document.getElementById('page-overview');
      if (uploadPage && overviewPage) {
        uploadPage.classList.remove('active');
        overviewPage.classList.add('active');
      }
    }
  }

  setupNav();
  setupFilterEvents();
  
  setInterval(updateClock, 1000);
  updateClock();

  // Set up Supabase Realtime channel subscription
  if (window.supabase) {
    window.supabase
      .channel('delay_logs_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delay_logs'
      }, (payload) => {
        console.log('New database change received:', payload);
        if (window._supabaseDebounceTimer) clearTimeout(window._supabaseDebounceTimer);
        window._supabaseDebounceTimer = setTimeout(() => {
          loadFromSupabase();
        }, 1000);
      })
      .subscribe((status) => {
        console.log(`Supabase Realtime subscription status: ${status}`);
      });
  }
});