// Global State Repository
var RAW_DATA = [];
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

  const searchInput = document.getElementById('prod-search');
  if (searchInput) searchInput.addEventListener('input', debounce(renderProdTable, 250));
  const filterRole = document.getElementById('prod-filter-role');
  if (filterRole) filterRole.addEventListener('change', renderProdTable);
}

function updateHeader(){
  // Header KPI elements (TOTAL SHIFTS, TOTAL TONNAGE, AVG AVAILABILITY)
  // were removed per user request. Keep this function as a no-op
  // to avoid errors where callers expect updateHeader to exist.
}

async function runAnomalyDetection(shiftRecords) {
  try {
    const res = await fetch('http://localhost:8000/api/anomaly/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shiftRecords)
    });
    const { results, anomaly_count } = await res.json();
    // Store on window for analytics.js to consume
    window.ANOMALY_RESULTS = results;
    window.ANOMALY_COUNT = anomaly_count;
    console.log(`Anomaly detection complete: ${anomaly_count} flagged shifts`);
  } catch (e) {
    console.warn('Anomaly detection unavailable (is the FastAPI server running?)', e);
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  populateFilters();
  applyFilters();
  setupNav();
  setupFilterEvents();
  
  setInterval(updateClock, 1000);
  updateClock();
});
