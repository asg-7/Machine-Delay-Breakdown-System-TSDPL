// ─── MASTER DELAY CAUSE MAPPINGS (Extracted from excel sheets) ───────────────
const MASTER_DELAY_MAP = {
  "SLITTER": {
    "SHIFT HAND OVER": [
      "SHIFT HANDOVER FROM PREVIOUS SHIFT",
      "TOOLBOX/SAFETYTALK",
      "OTHER"
    ],
    "COIL FEEDING": [
      "TOTAL COIL FEEDING TIME DURING SHIFT WORKING",
      "OTHER"
    ],
    "COMMUNICATION - MEETING DEALY": [
      "TOOLBOX/SAFETYTALK",
      "OTHER"
    ],
    "SETUP DELAY": [
      "SLITTER ARBOR SETUP INTER CHANGE & LOOP LINE/OVER ARM CHANGE",
      "SLITTER CUTTER CHANGE & CLEARANCE",
      "FELT PAD CHANGE",
      "SEGMENT CHANGE",
      "CHOPPER CALIBIRATION",
      "CHOPPER CHANGE & CALLIBRATION",
      "CUTTER JAM IN ARBOUR",
      "INLINE SEPERATOR CHANGING",
      "OVERARM SET UP",
      "CHUTE PIPE SHIFTING",
      "ARBOR SETUP",
      "OTHER"
    ],
    "SCRAP REMOVAL": [
      "SCRAP BOX CLEANING",
      "TRIM SCRAP CLEANING",
      "SCRAP VEHICLE LOADING",
      "END CUT BUNDLE HANDLING",
      "OTHER"
    ],
    "QUALITY DELAY": [
      "REWORK COIL PROCESSING",
      "POP COIL  DUE TO  RM DEFECT",
      "SAMPLE COLLECTION",
      "SHEET MEASUREMENT DELAY",
      "OTHER"
    ],
    "OPERATION DELAY": [
      "CHOPPER CHUTE  SCRAP JAM",
      "COIL NOT AVAILABLE",
      "COIL UNLOAD FROM UNCOILER",
      "ENDCUT CUTTING DELAY",
      "FELT PAD CHANGE",
      "LUNCH/TEA",
      "RECOILING DELAY",
      "SHEET BEND IN TENSION PAD",
      "SLITTER TRIM SCRAP STUCK",
      "WRONG COIL PROCESSING",
      "WRONG ARBOUR SET UP",
      "NO SPACE FOR FG COIL STORAGE",
      "OTHER"
    ],
    "CRANE DELAY": [
      "COIL TRANSFER CAR EVACUATION DELAY",
      "SLIT COIL SEGRIGATION",
      "FG SPACE ISSUE",
      "CRANE MAINTENANCE",
      "LT/CT OPERATION ISSUE",
      "CRANE TRIP ISSUE",
      "EXIT TURNSTILE JAM",
      "OTHER"
    ],
    "MAINTENANCE BREAKDOWN": [
      "BRUSHING ROLL FIXING",
      "CHOPPER CALIBIRATION",
      "CHOPPER CHUTE PIPE  CYLINDER BOLT BROKEN",
      "CHOPPER CHUTE PIPE  UP/DOWN PROBLEM",
      "COMMUNICATION FAULT",
      "CONVEYOR FORWARS REVERSE ISSUE",
      "ENTRY COIL CAR IN/OUT PROBLEM",
      "ENTRY SHEAR NOT WORKING",
      "ENTRY SIDE GUIDE OPEN/CLOSE ISSUE",
      "EXIT COIL CAR BEARING DAMAGED",
      "EXIT COIL CAR HOSE PIPE LEAKAGE",
      "EXIT COIL CAR IN/OUT PROBLEM",
      "EXIT COIL CAR LEASER SENSOR ISSUE",
      "EXIT COIL CAR OUT FROM TRACK",
      "EXIT SHEAR BLADE CHANGE",
      "EXIT SHEAR CUTTING ISSUE",
      "EXIT SHEAR GAP ADJUSTMENT",
      "EXIT TRUN STILE BOTTOM BEARING BOLT BROKEN",
      "EXIT TURNSTILE PIANO LOCK BROKEN",
      "FELT PAD PNEUMATIC LECKAGE",
      "FELTPAD NUMETIC CYLINDER LOCK UNLOCK PROBLEM",
      "HYDRAULIC LEACKAGE IN LINE",
      "HYDRAULIC POWER PACK TEMPERATURE HIGH",
      "GENERAL AIR PRESSURE NOT AVAILABLE",
      "LOOP TABLE UP/DOWN ISSUE",
      "MANUAL JOG NOT WORKING",
      "OVER ARM CHECK NUT DAMAGE",
      "OVER ARM LOCKING CYLINDER ISSUE",
      "OVER ARM ROTATION ISSUE",
      "PIANO SUPPORT ROLL BROKEN",
      "PREVENTIVE MAINTENANCE",
      "RECOILER CYLINDER CHANGE",
      "RECOILER DRIVE FAULT",
      "RECOILER EXPAND/COLLAPSE ISSUE",
      "RECOILER FEEDING TABLE BASE  WELDING BROKEN",
      "RECOILER GEAR BROKEN",
      "RECOILER OBBS BOLT BROKEN",
      "RECOILER SEGMENT BOLT BROKEN",
      "RECOILER SHAFT BROKEN",
      "RECOILER TURN STYLE LOCKING CYLINDER BROKEN",
      "SCRAP CONVEYER BREAKDOWN",
      "SLITTER ARBOR PENETRATION ISSUE",
      "SLITTER ARBOR TURNSTILE AUTO IN/OUT ISSUE",
      "SLITTER ARBOR TURNSTILE ROTATE ISSUE",
      "SLITTER DRIVE FAULT",
      "SLITTER HEAD OPEN/CLOSE ISSUE",
      "SLITTER PENETRATION UP/DOWN ISSUE",
      "SLITTER TURNSTILE BOTTOM LINER BEARING CHANGE",
      "TENSION UNIT BOTTOM LINER BEARING CHANGE",
      "TENSION UNIT WHEEL LINEAR  PLATE DAMAGE",
      "THREADING TABLE ISSUE",
      "UNCOILER DRIVE FAULT",
      "UNCOILER SEGMENT BOLT BROKEN",
      "UNCOILER SHAFT BROKEN",
      "UNCOILER WEDGE BOLT BROKEN",
      "OVER ARM NUMETIC AIR PRESSURE PIPE WELDING",
      "OTHER"
    ],
    "MAINTENANCE DAILY CHECK LIST": [
      "MAINTENANCE DAILY CHECK LIST",
      "OTHER"
    ],
    "NO SPACE": [
      "NO SPACE - FG STORAGE FULL",
      "NO SPACE - CRANE BLOCKED",
      "OTHER"
    ],
    "NO SCHEDULE": [
      "NO SCHEDULE - WAITING FOR PLAN",
      "NO SCHEDULE - PRODUCTION PLANNING DELAY",
      "OTHER"
    ]
  },
  "WCTL-1": {
    "SHIFT HANDOVER": [
      "SHIFT HANDOVER FROM PREVIOUS SHIFT",
      "OTHER"
    ],
    "TOTAL COIL FEEDING DELAY": [
      "COIL FEEDING ISSUE",
      "TOTAL COIL FEEDING TIME DURING SHIFT WORKING",
      "OTHER"
    ],
    "TOTAL QUALITY INSPECTION DELAY": [
      "RM COIL SURFACE CHECKING & MEASUREMENT OF SHEET",
      "OTHER"
    ],
    "OPERATION DELAY": [
      "SHEET BEND IN LINE",
      "SHEET STUCK IN STACKER OVER PASSING",
      "COIL UNLOADING",
      "HEAVY RAIN",
      "LEVELLER CLEANING",
      "FLATTNER CLEANING",
      "SCRAP STUCK IN BOTTOM  SCRAP PINCH ROLL",
      "SCRATCHES FROM RUNNING LINE",
      "THINNER MATERIAL PROCESSED",
      "OPERATIOC DELAY",
      "LEVELLER CASSATTE CHANGE",
      "OTHER"
    ],
    "CRANE DELAY": [
      "FG SPACE ISSUE",
      "FG VEHICLE LOADING",
      "SCRAP LOADING",
      "SHEET LIFTER OPEN/CLOSE ISSUE",
      "20-20 CRANE TRIP ISSUE",
      "20-20 CRANE CT/LT ISSUE",
      "20-20 CRANE BOTTOM LEVER BEND",
      "20-20 CRANE LIGHT SENSOR ISSUE",
      "OTHER"
    ],
    "MAINTENANCE BREAKDOWN": [
      "BELT CONVEYER SHIFTING",
      "BOTTOM SCRATCH ISSUE",
      "BOX.1 SIDE GUIDE  JOGGING ISSUE",
      "BOX.2 SIDE GUIDE  JOGGING ISSUE",
      "BRUSHING ROLL CHANGE",
      "COIL FEEDING ISSUE",
      "CONVEYER BELT CHANGE",
      "CONVEYER ROLL BEARING CHANGE",
      "CROSS 90 CHAIN BROKEN",
      "COOLING TOWER CLEANING",
      "ENTRY COIL CAR CRADE ROLL ROTATE ISSUE",
      "ENTRY COIL CAR FWD/BWD ISSUE",
      "ENTRY PINCH ROLL UP/DOWN",
      "FLATTNER GREASE LUBRICATION ISSUE",
      "FLATTNER ROLL BUFFING",
      "FLATTNER ROLL CHANGE",
      "FLYING SHEAR BLADE CHANGE",
      "FLYING SHEAR BLADE PROTECT ROLL O/S WELDING BROKEN",
      "FLYING SHEAR HOMING PROBLEM",
      "FLYING SHAER LINEAR BEARING CHANGE",
      "FLYING SHEAR RACK DAMAGE",
      "HEADSTOPPER DRAG CHAIN DAMAGED",
      "HEADSTOPPER FWD/BWD ISSUE",
      "HEADSTOPPER JOGGING ISSUE",
      "HEADSTOPPER LENGTH ENCODER NOT WORKING",
      "HEADSTOPPER MOTOR BASE BROKEN",
      "HEADSTOPPER PUSHER CYLINDER CHANGE",
      "IDLE ROLL BEARING DAMAGE",
      "LEVELLER  ROLL CHANGE",
      "LEVELLER CALLIBRATION",
      "LEVELLER BOLT BROKEN",
      "LEVELLER GREASE LUBRICATION ISSUE",
      "LEVELLER ROLL BUFFING",
      "MEASURING WHEEL COUPLING CHANGE",
      "MEASURING WHEEL BEARING CHANGE",
      "OBBS BOLT BROKEN",
      "PACKETS BEND IN ZONE NO.2",
      "PRESSURE ROLL UP/DOWN  ISSUE",
      "PREVENTIVE MAINTENANCE",
      "PUP UP CONVEYER UP/DOWN ISSUE",
      "SIDE GUIDE OPEN/CLOSE ISSUE",
      "STACKER  ROLLER CONVEYER CHAIN BROKEN",
      "STACKER  ROLLER CONVEYER CHAIN SPROCKET BROKEN",
      "STACKER  SUPPORT ROLL CHANGE",
      "STACKER AUTO CENTERING ISSUE",
      "STACKER LINER PLATE BROKEN",
      "STACKER PIN AIR LEAKAGE",
      "STACKER PIN UP ISSUE",
      "STACKER ROLLER BEARING DAMAGED",
      "TAIL ROLL BEARING CHANGE",
      "UNCOILER EXPAND/COLLAPSE ISSUE",
      "UNCOILER SEGMENT BOLT BROKEN",
      "UNCOILER WEDGE BOLT BROKEN ISSUE",
      "LEVELLER CASSETE CHANGE",
      "MANDREL ROTATION DRIVE FULT",
      "EVERY COIL STACKER 1&2 LENGTH MANUAL ADJUST",
      "FLYING SHEAR MOTER DRIVE ISSUE",
      "KNOCK DOWN ROLL UP ISSUE",
      "Flying shear entry table roll replaced",
      "FRONT STOPER-2 GIDE BAR OUT & SENSOR ADJUST",
      "COIL CAR INOUT PROBLEM",
      "DANT GENERATE FROM CHAIN CONVEYOR -1",
      "MANDREL BREAK NOT WORKING",
      "FLYING SHEAR DRIVE GENARL FAULT",
      "MEN POWER PACK HIGH TEMPERATURES",
      "CHAIN CONVYER 2 CHAIN  BROKEN AND SPOKET BEND",
      "BELT CONVEYOR-2 MOTOR CHAIN BROKEN",
      "LINE STOP DUE TO DIAGONAL ISSUE",
      "COIL UNLOADING DUE TO DENT MARK GENERATE FROM LEVELLER",
      "LEVELLER CLEANING 3 TIMES",
      "BRUSHING-3 MAINTENANCE WORK",
      "MAIN HYDROLIC POWER PACK TEMP HIGH",
      "SCRATCH GENERATE  FROM ENTRY PINCH  ROLL",
      "CRANE ENGAGE WITH DISPATCH FG AREA 12M PACKETS",
      "OTHER"
    ],
    "PACKET SHIFTING/PACKAGING DELAY": [
      "PACKAGING DELAY",
      "HDPE PACKAGING DELAY",
      "AUTO SHEET PACKAGING DELAY",
      "RUNNER SHIFTING DELAY",
      "OTHER"
    ],
    "SCRAP REMOVAL": [
      "ENDCUT SCRAP HANDLING",
      "SCRAP VEHICLE LOADING",
      "TRIM SCRAP BOX HANDLING",
      "OTHER"
    ],
    "HR DELAY": [
      "LESS MANPOWER",
      "BUS LATE",
      "OTHER"
    ],
    "MAINTENANCE DAILY CHECKLIST": [
      "MAINTENANCE DAILY CHECKLIST",
      "OTHER"
    ],
    "TBT": [
      "TBT",
      "OTHER"
    ],
    "LESS MANPOWER": [
      "LESS MANPOWER",
      "OTHER"
    ],
    "SCHEDULE DELAY": [
      "SCHEDULE DELAY",
      "OTHER"
    ]
  },
  "WCTL-2": {
    "SHIFT HANDOVER": [
      "SHIFT HANDOVER FROM PREVIOUS SHIFT",
      "OTHER"
    ],
    "TOTAL COIL FEEDING DELAY": [
      "TOTAL COIL FEEDING TIME DURING SHIFT WORKING",
      "COIL FEEDING ISSUE",
      "OTHER"
    ],
    "TOTAL QUALITY INSPECTION DELAY": [
      "RM COIL SURFACE CHECKING & MEASUREMENT OF SHEET",
      "04 PCS. SAMPLE COLLECTED",
      "SAMPLE COLLECTED",
      "OTHER"
    ],
    "OPERATION DELAY": [
      "PRINTER NOT WORKING",
      "SHEET BEND IN LINE",
      "SHEET STUCK IN STACKER OVER PASSING",
      "COIL UNLOADING",
      "HEAVY RAIN",
      "LEVELLER CLEANING",
      "FLATTNER ENTRY SENSER AND STACKER SIDE GUIDE PROBLEM",
      "COIL FEEDING ISSUE",
      "SCRAP STUCK IN BOTTOM  SCRAP PINCH ROLL",
      "SCRATCHES FROM RUNNING LINE",
      "FLYING SHEAR MODEL ERROR.",
      "SHORT LENGTH STACKING PROBLEM",
      "SIDE GUIDE PROBLEM",
      "TONGE CHANGE TWO TIMES",
      "FLYING SHEAR BOTTOM BLADE REPLACE.",
      "BOX1 OVER PASSING ROLL PROBLEM",
      "BOTTOM  DENT GENERATED FROM STACKER CHAIN CON.",
      "RUNING LINE STACKER PIN UP ISSUE",
      "STACKER CHAIN CONVEYOR IN CHAIN DENT",
      "MAX-HDPE PACKET.",
      "LINE STOP FOR BOTTOM SCRATCH INSPECTION",
      "OTHER"
    ],
    "CRANE DELAY": [
      "SHEET TRANSFER CAR EVACUATION DELAY",
      "MULTIPLE PACKETS HANDLING",
      "FG SPACE ISSUE",
      "FG VEHICLE LOADING",
      "SCRAP LOADING",
      "SHEET LIFTER OPEN/CLOSE ISSUE",
      "20-20 CRANE TRIP ISSUE",
      "20-20 CRANE CT/LT ISSUE",
      "20-20 CRANE BOTTOM LEVER BEND",
      "PREVENTIVE MAINTENANCE",
      "20-20 CRANE LIGHT SENSOR ISSUE",
      "PACKAGING DELAY",
      "HDPE PACKAGING DELAY",
      "AUTO SHEET PACKAGING DELAY",
      "RUNNER SHIFTING DELAY",
      "PACKAGING BED SHORTAGE FOR PACKING DOUBLE STACK 12 MTR PKT",
      "STACKER AREA NOT WORKING",
      "PINCH ROLL NO3 OIL LEAKAGE",
      "25MM SHEET STUCK IN STACKER",
      "CROP SHEAR EXIT TABLE DOWN",
      "OTHER"
    ],
    "MAINTENANCE BREAKDOWN": [
      "ACB ROLL UP/DOWN ISSUE",
      "BOTTOM SCRATCH ISSUE",
      "BOX 1 O\\S SIDE GUIDE VERTICAL ROLL CHANGE",
      "BOX.1 ROLLER CONVEYER NO.2 CHAIN BROKEN",
      "BOX.1 ROLLER CONVEYER NO.3 CHAIN BROKEN",
      "BOX.1 ROLLER CONVEYER NO.4 CHAIN BROKEN",
      "BRUSHING ROLL CHANGE",
      "CONVEYER BELT CHANGE",
      "CONVEYER ROLL BEARING CHANGE",
      "CROSS 90 CHAIN BROKEN",
      "DAILY CHECKLIFT JOB",
      "ENTRY COIL CAR CRADE ROLL ROTATE ISSUE",
      "ENTRY COIL CAR FWD/BWD ISSUE",
      "ENTRY PINCH ROLL UP/DOWN",
      "FLATTNER GREASE LUBRICATION ISSUE",
      "FLATTNER ROLL BUFFING",
      "FLATTNER ROLL CHANGE",
      "FLYING SHEAR BELT CONV. BELT CHANGE",
      "FLYING SHEAR BLADE CHANGE",
      "FLYING SHEAR TAIL ROLL PROBLEM",
      "HEADSTOPPER FWD/BWD ISSUE",
      "HEADSTOPPER JOGGING ISSUE",
      "IDLE ROLL BEARING DAMAGE",
      "LEVELLER  ROLL CHANGE",
      "LEVELLER GREASE LUBRICATION ISSUE",
      "LEVELLER ROLL BUFFING",
      "MEASUREING WHEEL ISSUE",
      "OBBS BOLT BROKEN",
      "OVER PASSING BELT CHANGE",
      "PRESSURE ROLL UP/DOWN  ISSUE",
      "PREVENTIVE MAINTENANCE",
      "PUP UP CONVEYER UP/DOWN ISSUE",
      "SCRAP PINCH ROLL DRIVE CHAIN BROKEN",
      "SIDE GUIDE CALLIBRATION",
      "SIDE GUIDE JOGGING ISSUE",
      "SIDE GUIDE OPEN/CLOSE ISSUE",
      "STACKER  ROLLER CONVEYER CHAIN BROKEN",
      "STACKER  ROLLER CONVEYER CHAIN SPROCKET BROKEN",
      "STACKER  SUPPORT ROLL CHANGE",
      "STACKER DROPING ROLL ISSUE",
      "STACKER LINER PLATE BROKEN",
      "STACKER OVER PASSING ROLL ISSUE",
      "STACKER PIN AIR LEAKAGE",
      "STACKER PIN UP ISSUE",
      "STACKER ROLLER BEARING DAMAGED",
      "TAIL ROLL NOT WORKING",
      "UNCOILER EXPAND/COLLAPSE ISSUE",
      "UNCOILER SEGMENT BOLT BROKEN",
      "UNCOILER WEDGE BOLT BROKEN ISSUE",
      "WEIGHT SCALE CALLIBRATION",
      "OTHER"
    ],
    "PACKET SHIFTING/PACKAGING DELAY": [
      "PACKAGING DELAY",
      "HDPE PACKAGING DELAY",
      "AUTO SHEET PACKAGING DELAY",
      "RUNNER SHIFTING DELAY",
      "PACKAGING BED SHORTAGE FOR PACKING DOUBLE STACK 12 MTR PKT",
      "STACKER AREA NOT WORKING",
      "OTHER"
    ],
    "SCRAP REMOVAL": [
      "ENDCUT SCRAP HANDLING",
      "SCRAP VEHICLE LOADING",
      "TRIM SCRAP BOX HANDLING",
      "CROSS 90 CHINE BROKEN",
      "CHINE BROKEN",
      "OTHER"
    ],
    "HR DELAY": [
      "LESS MANPOWER",
      "BUS LATE",
      "OTHER"
    ],
    "MAINTENANCE DAILY CHECKLIST": [
      "MAINTENANCE DAILY CHECKLIST",
      "OTHER"
    ]
  }
};

// ─── LOGIN USER CREDENTIALS ──────────────────────────────────────────────────
const LOGIN_CREDENTIALS = {
  // Operators
  "OP-SLIT-01": { role: "operator", line: "SLITTER" },
  "OP-WCTL-01":   { role: "operator", line: "WCTL-1" },
  "OP-WCTL-02":   { role: "operator", line: "WCTL-2" },
  // Admins
  "ADMIN01":    { role: "admin" },
  "ADMIN02":    { role: "admin" },
  "ADMIN03":    { role: "admin" },
  "ADMIN04":    { role: "admin" }
};

const BACKEND_URL = "https://machine-delay-breakdown-system-tsdpl.onrender.com";
let entryCount = 0;
let csvData = "";

// ─── AUTOMATIC CLOCK & SHIFT ─────────────────────────────────────────────────
function getISTDateTime() {
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
  
  return {
    dateStr: `${dd}.${mm}.${yy}`,
    yyyymmdd: `${yy}-${mm}-${dd}`,
    shift: shift,
    timeStr: ist.toLocaleTimeString('en-IN', { hour12: false })
  };
}

// Update clock in Operator & Login screens
function initOperatorClock() {
  const clockEl = document.getElementById('op-clock');
  const loginClockEl = document.getElementById('login-clock');
  
  function tick() {
    const { dateStr, shift, timeStr } = getISTDateTime();
    const txt = `${dateStr} / SHIFT ${shift} / ${timeStr} IST`;
    if (clockEl) clockEl.textContent = txt;
    if (loginClockEl) loginClockEl.textContent = txt;
  }
  tick();
  setInterval(tick, 1000);
}

// ─── AUTHENTICATION FLOW ─────────────────────────────────────────────────────
function checkSession() {
  const session = sessionStorage.getItem('tsdpl_session');
  if (session) {
    try {
      const user = JSON.parse(session);
      applyUserRole(user);
    } catch(e) {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
}

function handleGuestLogin() {
  const user = { role: "guest", employeeId: "GUEST" };
  sessionStorage.setItem('tsdpl_session', JSON.stringify(user));
  applyUserRole(user);
}

function handleLogin(event) {
  if (event) event.preventDefault();
  
  const idInput = document.getElementById('login-id');
  const errorEl = document.getElementById('login-error');
  const rawId = idInput.value.trim().toUpperCase();
  
  if (!rawId) {
    showError("Please enter your Employee ID.");
    return;
  }
  
  const user = LOGIN_CREDENTIALS[rawId];
  if (user) {
    user.employeeId = rawId;
    sessionStorage.setItem('tsdpl_session', JSON.stringify(user));
    applyUserRole(user);
    idInput.value = "";
    errorEl.style.display = "none";
  } else {
    showError("Invalid Employee or Admin ID. Please try again.");
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
    idInput.classList.add('error');
    setTimeout(() => idInput.classList.remove('error'), 500);
  }
}

function applyUserRole(user) {
  document.getElementById('login-container').style.display = 'none';
  
  if (user.role === 'admin' || user.role === 'guest') {
    document.getElementById('operator-container').style.display = 'none';
    document.getElementById('admin-container').style.display = 'block';
    
    // Hide/show the Operator Logs tab
    const logsTab = document.querySelector('.tab[data-page="operator-logs"]');
    if (logsTab) {
      logsTab.style.display = (user.role === 'admin') ? 'block' : 'none';
    }
    
    // Switch to Overview or Upload (Overview is default tab)
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.page === 'operator-logs' && user.role !== 'admin') {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const overviewTab = document.querySelector('.tab[data-page="overview"]');
      if (overviewTab) {
        overviewTab.classList.add('active');
        document.getElementById('page-overview').classList.add('active');
        renderPage('overview');
      }
    } else if (activeTab) {
      // do nothing
    } else {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const overviewTab = document.querySelector('.tab[data-page="overview"]');
      if (overviewTab) {
        overviewTab.classList.add('active');
        document.getElementById('page-overview').classList.add('active');
        renderPage('overview');
      }
    }
    if (user.role === 'admin') {
      loadAdminLogs();
    }
  } else {
    // Operator Role
    document.getElementById('admin-container').style.display = 'none';
    document.getElementById('operator-container').style.display = 'block';
    
    // Set Operator ID in Header
    document.getElementById('op-employee-id').textContent = user.employeeId;
    
    // Pre-select and lock the machine line
    setupOperatorForm(user.line);
  }
}

function handleLogout() {
  sessionStorage.removeItem('tsdpl_session');
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('admin-container').style.display = 'none';
  document.getElementById('operator-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-id').focus();
}

// ─── OPERATOR FORM SETUP ─────────────────────────────────────────────────────
function setupOperatorForm(line) {
  // Clear previous entries
  document.getElementById('entriesContainer').innerHTML = `
    <div class="no-entries" id="noEntriesMsg">
      <div class="no-entries-icon">⏱</div>
      No delay entries yet.<br>Click <strong>+ Add Delay Entry</strong> to begin.
    </div>
  `;
  document.getElementById('totalBar').style.display = 'none';
  entryCount = 0;
  
  // Set Line label
  const lineBadge = document.getElementById('op-line-badge');
  lineBadge.textContent = line;
  lineBadge.dataset.val = line;
  
  // Auto-set Date & Shift values in UI
  const { dateStr, shift } = getISTDateTime();
  const dateInput = document.getElementById('op-dateField');
  const shiftInput = document.getElementById('op-shiftField');
  
  dateInput.value = dateStr;
  shiftInput.value = `SHIFT ${shift}`;
  
  // Clear other inputs
  document.getElementById('op-inchargeField').value = "";
  document.getElementById('op-teamField').value = "";
  document.getElementById('op-tonnageField').value = "";
  document.getElementById('op-coilField').value = "";
  document.getElementById('op-startTime').value = "";
  document.getElementById('op-endTime').value = "";
  
  // Clear error classes
  document.querySelectorAll('.error, .error-border, .field-error.visible').forEach(el => {
    el.classList.remove('error', 'error-border', 'visible');
    if (el.tagName === 'DIV' && el.id.includes('Error')) el.style.display = 'none';
  });
}

// ─── ADD DELAY ROW ───────────────────────────────────────────────────────────
function addOperatorDelayEntry() {
  entryCount++;
  const id = entryCount;
  const container = document.getElementById('entriesContainer');
  document.getElementById('noEntriesMsg').style.display = 'none';
  document.getElementById('totalBar').style.display = 'flex';

  const row = document.createElement('div');
  row.className = 'entry-row';
  row.id = 'op-entry-' + id;

  const currentLine = document.getElementById('op-line-badge').dataset.val;
  const lineMap = MASTER_DELAY_MAP[currentLine] || {};
  
  // Build primary options
  const primaryOpts = Object.keys(lineMap).map(k =>
    `<option value="${k}">${k}</option>`
  ).join('');

  row.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">DELAY ENTRY #${id}</span>
      <button type="button" class="remove-btn" onclick="removeOperatorDelayEntry(${id})" title="Remove entry">✕</button>
    </div>
    <div class="entry-grid">
      <div class="field">
        <label>Primary Cause <span class="req">*</span></label>
        <select id="op-primary-${id}" onchange="onOpPrimaryChange(${id})">
          <option value="">— Select Primary Cause —</option>
          ${primaryOpts}
        </select>
        <div class="field-error" id="op-primaryErr-${id}">Select a primary cause.</div>
      </div>
      <div class="field">
        <label>Detailed Cause <span class="req">*</span></label>
        <select id="op-secondary-${id}" onchange="onOpSecondaryChange(${id})" disabled>
          <option value="">— Select Primary First —</option>
        </select>
        <div class="field-error" id="op-secondaryErr-${id}">Select a detailed cause.</div>
      </div>
      <div class="field">
        <label>Duration <span class="req">*</span></label>
        <div class="numeric-field">
          <input type="number" id="op-duration-${id}" placeholder="0"
            min="1" max="960" step="1"
            oninput="updateOpTotal()" />
          <span class="unit-badge">MIN</span>
        </div>
        <div class="field-error" id="op-durationErr-${id}">Enter duration (min).</div>
      </div>
    </div>
    <div class="other-row" id="op-otherRow-${id}">
      <div class="other-notice">
        <span class="other-notice-icon">✎</span>
        <strong>OTHER selected</strong> — Please describe the delay reason below (required):
      </div>
      <textarea class="other-textarea" id="op-otherText-${id}"
        placeholder="Describe the delay cause in detail... (alphanumeric only, required)"
        rows="2" oninput="validateOpOther(${id})"></textarea>
      <div class="field-error" id="op-otherErr-${id}">Please describe the delay reason (cannot be empty).</div>
    </div>
  `;

  container.appendChild(row);
}

function removeOperatorDelayEntry(id) {
  const el = document.getElementById('op-entry-' + id);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(10px)';
    el.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      el.remove();
      updateOpTotal();
      if (document.querySelectorAll('.entry-row').length === 0) {
        document.getElementById('noEntriesMsg').style.display = 'block';
        document.getElementById('totalBar').style.display = 'none';
      }
    }, 200);
  }
}

function onOpPrimaryChange(id) {
  const currentLine = document.getElementById('op-line-badge').dataset.val;
  const primary = document.getElementById('op-primary-' + id).value;
  const secSel = document.getElementById('op-secondary-' + id);
  const otherRow = document.getElementById('op-otherRow-' + id);
  
  // Hide error
  document.getElementById('op-primaryErr-' + id).style.display = 'none';
  document.getElementById('op-entry-' + id).classList.remove('has-error');

  if (!primary) {
    secSel.innerHTML = '<option value="">— Select Primary First —</option>';
    secSel.disabled = true;
    otherRow.classList.remove('visible');
    return;
  }

  const lineMap = MASTER_DELAY_MAP[currentLine] || {};
  const subs = lineMap[primary] || [];
  
  secSel.innerHTML = '<option value="">— Select Detailed Cause —</option>' +
    subs.map(s => `<option value="${s}">${s}</option>`).join('');
  secSel.disabled = false;
  otherRow.classList.remove('visible');
  document.getElementById('op-otherText-' + id).value = '';
}

function onOpSecondaryChange(id) {
  const val = document.getElementById('op-secondary-' + id).value;
  const otherRow = document.getElementById('op-otherRow-' + id);
  
  document.getElementById('op-secondaryErr-' + id).style.display = 'none';
  document.getElementById('op-entry-' + id).classList.remove('has-error');

  if (val === 'OTHER') {
    otherRow.classList.add('visible');
  } else {
    otherRow.classList.remove('visible');
    document.getElementById('op-otherText-' + id).value = '';
    document.getElementById('op-otherErr-' + id).style.display = 'none';
  }
}

function validateOpOther(id) {
  const val = document.getElementById('op-otherText-' + id).value;
  // Clean special characters: allow letters, numbers, spaces, dots, dashes, slashes, brackets
  const cleaned = val.replace(/[^a-zA-Z0-9 .,\-\/\(\)]/g, '');
  document.getElementById('op-otherText-' + id).value = cleaned;
  
  if (cleaned.trim().length > 0) {
    document.getElementById('op-otherErr-' + id).style.display = 'none';
  }
}

function updateOpTotal() {
  let total = 0;
  document.querySelectorAll('[id^="op-duration-"]').forEach(el => {
    const v = parseFloat(el.value);
    if (!isNaN(v) && v > 0) total += v;
  });
  document.getElementById('op-totalMinutes').textContent = total + ' MIN';
  const h = Math.floor(total / 60);
  const m = total % 60;
  document.getElementById('op-totalHours').textContent = h + ' hrs ' + m + ' min';
}

// ─── FORM VALIDATION & SUBMISSION ────────────────────────────────────────────
function validateOperatorForm() {
  let valid = true;

  // Incharge
  const incharge = document.getElementById('op-inchargeField').value;
  const inchargeErr = document.getElementById('op-inchargeError');
  if (!incharge) {
    inchargeErr.style.display = 'block';
    document.getElementById('op-inchargeField').classList.add('error');
    valid = false;
  } else {
    inchargeErr.style.display = 'none';
    document.getElementById('op-inchargeField').classList.remove('error');
  }

  // Team
  const team = document.getElementById('op-teamField').value;
  const teamErr = document.getElementById('op-teamError');
  if (!team) {
    teamErr.style.display = 'block';
    document.getElementById('op-teamField').classList.add('error');
    valid = false;
  } else {
    teamErr.style.display = 'none';
    document.getElementById('op-teamField').classList.remove('error');
  }

  // Tonnage
  const tonnage = document.getElementById('op-tonnageField').value;
  const tonnageErr = document.getElementById('op-tonnageError');
  if (tonnage === '' || isNaN(parseFloat(tonnage)) || parseFloat(tonnage) < 0) {
    tonnageErr.style.display = 'block';
    document.getElementById('op-tonnageField').classList.add('error');
    valid = false;
  } else {
    tonnageErr.style.display = 'none';
    document.getElementById('op-tonnageField').classList.remove('error');
  }

  // Coils
  const coils = document.getElementById('op-coilField').value;
  const coilErr = document.getElementById('op-coilError');
  if (coils === '' || isNaN(parseInt(coils)) || parseInt(coils) < 0) {
    coilErr.style.display = 'block';
    document.getElementById('op-coilField').classList.add('error');
    valid = false;
  } else {
    coilErr.style.display = 'none';
    document.getElementById('op-coilField').classList.remove('error');
  }

  // Entries count check
  const rows = document.querySelectorAll('.entry-row');
  if (rows.length === 0) {
    alert('⚠ Please add at least one delay entry before submitting.');
    return false;
  }

  // Row items check
  rows.forEach(row => {
    const id = row.id.replace('op-entry-', '');
    let rowValid = true;

    const primary = document.getElementById('op-primary-' + id).value;
    const priErr = document.getElementById('op-primaryErr-' + id);
    if (!primary) {
      priErr.style.display = 'block';
      rowValid = false;
    } else {
      priErr.style.display = 'none';
    }

    const secondary = document.getElementById('op-secondary-' + id).value;
    const secErr = document.getElementById('op-secondaryErr-' + id);
    if (!secondary) {
      secErr.style.display = 'block';
      rowValid = false;
    } else {
      secErr.style.display = 'none';
    }

    if (secondary === 'OTHER') {
      const otherTxt = document.getElementById('op-otherText-' + id).value.trim();
      const othErr = document.getElementById('op-otherErr-' + id);
      if (!otherTxt || !/[a-zA-Z0-9]/.test(otherTxt)) {
        othErr.style.display = 'block';
        rowValid = false;
      } else {
        othErr.style.display = 'none';
      }
    }

    const dur = document.getElementById('op-duration-' + id).value;
    const durErr = document.getElementById('op-durationErr-' + id);
    if (!dur || isNaN(parseInt(dur)) || parseInt(dur) <= 0) {
      durErr.style.display = 'block';
      rowValid = false;
    } else {
      durErr.style.display = 'none';
    }

    if (!rowValid) {
      row.classList.add('has-error');
      valid = false;
    } else {
      row.classList.remove('has-error');
    }
  });

  return valid;
}

async function submitOperatorForm() {
  if (!validateOperatorForm()) return;

  const session = JSON.parse(sessionStorage.getItem('tsdpl_session') || '{}');
  const employeeId = session.employeeId || 'OP-UNKNOWN';
  
  const { dateStr } = getISTDateTime();
  const shiftText = document.getElementById('op-shiftField').value; // e.g. "SHIFT A"
  const shift = shiftText.replace('SHIFT ', '');
  const line = document.getElementById('op-line-badge').dataset.val;

  // Supabase Duplicate Guard Check
  if (window.supabase) {
    try {
      const { data, error } = await window.supabase
        .from('delay_logs')
        .select('id')
        .eq('machine', line)
        .eq('date', dateStr)
        .eq('shift', shift)
        .eq('employee_id', employeeId)
        .eq('source', 'operator');

      if (error) {
        console.error("Supabase duplicate check failed:", error.message);
      } else if (data && data.length > 0) {
        alert(`⚠️ Duplicate Submission Blocked!\nYou have already submitted a log for ${line} on ${dateStr} (Shift ${shift}).`);
        return;
      }
    } catch (err) {
      console.warn("Could not check duplicate entries in Supabase.", err);
    }
  }

  const incharge = document.getElementById('op-inchargeField').value;
  const team = document.getElementById('op-teamField').value;
  const tonnage = parseFloat(document.getElementById('op-tonnageField').value);
  const coils = parseInt(document.getElementById('op-coilField').value);
  const startTime = document.getElementById('op-startTime').value || '';
  const endTime = document.getElementById('op-endTime').value || '';

  // 1. Build CSV and save local log struct
  const csvHeaders = ['DATE','SHIFT','SHIFT INCHARGE','TEAM','TONNAGE','COIL','MACHINE','TIME','Start time','End Time','REASON','DESCRIPTION','OTHERS'];
  const csvRows = [];
  const delaysList = [];

  document.querySelectorAll('.entry-row').forEach((row, idx) => {
    const id = row.id.replace('op-entry-', '');
    const primary = document.getElementById('op-primary-' + id).value;
    let secondary = document.getElementById('op-secondary-' + id).value;
    const dur = parseInt(document.getElementById('op-duration-' + id).value) || 0;
    let otherDesc = '';

    if (secondary === 'OTHER') {
      otherDesc = document.getElementById('op-otherText-' + id).value.trim();
    }

    delaysList.push({
      time: dur,
      type: primary,
      description: secondary,
      reason: otherDesc || secondary
    });

    const isFirst = idx === 0;
    csvRows.push([
      isFirst ? dateStr : '',
      isFirst ? shift : '',
      isFirst ? incharge : '',
      isFirst ? team : '',
      isFirst ? tonnage : '',
      isFirst ? coils : '',
      isFirst ? line : '',
      dur,
      isFirst ? startTime : '',
      isFirst ? endTime : '',
      primary,
      secondary,
      otherDesc
    ]);
  });

  // Calculate total minutes
  let totalMin = 0;
  delaysList.forEach(d => totalMin += d.time);

  // Generate CSV text
  const csvLines = [csvHeaders.join(',')];
  csvRows.forEach(r => {
    csvLines.push(r.map(v => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ?
        `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  });
  csvData = csvLines.join('\n');

  // Load log entry model
  const logEntry = {
    timestamp: new Date().toISOString(),
    employeeId: employeeId,
    machine: line,
    date: dateStr,
    shift: shift,
    incharge: incharge,
    team: team,
    tonnage: tonnage,
    coils: coils,
    startTime: startTime,
    endTime: endTime,
    totalDelayMin: totalMin,
    delays: delaysList
  };

  // 2. Submit to Backend /api/operator-log
  let backendSuccess = false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/operator-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logEntry)
    });
    if (res.ok) {
      backendSuccess = true;
      console.log("Operator log saved to backend successfully.");
    }
  } catch(err) {
    console.warn("Backend offline. Falling back to local storage.", err);
  }

  // 3. Fallback: Save to LocalStorage
  const localLogs = JSON.parse(localStorage.getItem('tsdpl_operator_logs') || '[]');
  localLogs.push(logEntry);
  localStorage.setItem('tsdpl_operator_logs', JSON.stringify(localLogs));

  // 4. Save to Supabase
  if (window.supabase) {
    await saveOperatorLogToSupabase(logEntry);
  }

  // 4. Update the live RAW_DATA in memory so it reflects instantly if we view dashboard
  // (We'll also reload it from backend/localStorage on dashboard initialization)
  const memoryShift = {
    date: dateStr,
    shift: shift,
    incharge: incharge,
    team: team,
    machine: line,
    tonnage: tonnage,
    coils: coils,
    delays: delaysList
  };
  
  if (typeof window.RAW_DATA !== 'undefined') {
    // Avoid duplicates in memory
    window.RAW_DATA = window.RAW_DATA.filter(r => 
      !(r.date === dateStr && r.shift === shift && r.machine === line && r.incharge === incharge && r.team === team)
    );
    window.RAW_DATA.push(memoryShift);
    
    // Clear caches and trigger filter apply
    if (typeof prepareRawData === 'function') prepareRawData();
    if (typeof populateFilters === 'function') populateFilters();
    if (typeof applyFilters === 'function') applyFilters();
  }

  // 5. Display success Toast
  showToast("Entry Submitted!", `Shift report for ${line} saved successfully.`);

  // 6. Populate export modal
  const summaryGrid = document.getElementById('op-summaryGrid');
  summaryGrid.innerHTML = `
    <div class="summary-card">
      <div class="summary-val">${delaysList.length}</div>
      <div class="summary-lbl">DELAY ENTRIES</div>
    </div>
    <div class="summary-card">
      <div class="summary-val" style="color:var(--accent4);">${totalMin}</div>
      <div class="summary-lbl">TOTAL MINUTES</div>
    </div>
    <div class="summary-card">
      <div class="summary-val">${tonnage.toFixed(2)}</div>
      <div class="summary-lbl">TONNAGE (MT)</div>
    </div>
    <div class="summary-card">
      <div class="summary-val">${line}</div>
      <div class="summary-lbl">LINE</div>
    </div>
    <div class="summary-card">
      <div class="summary-val">SHIFT ${shift}</div>
      <div class="summary-lbl">SHIFT</div>
    </div>
    <div class="summary-card">
      <div class="summary-val">${dateStr}</div>
      <div class="summary-lbl">DATE</div>
    </div>
  `;

  document.getElementById('op-csvPreview').textContent = csvData;
  document.getElementById('op-exportModal').classList.add('open');
  
  // Reset form
  setupOperatorForm(line);
}

function closeOpModal() {
  document.getElementById('op-exportModal').classList.remove('open');
}

function downloadOpCSV() {
  const line = document.getElementById('op-line-badge').dataset.val || 'MACHINE';
  const { dateStr, shift } = getISTDateTime();
  const dateFormatted = dateStr.replace(/\./g, '');
  const filename = `DELAY_${line}_SHIFT${shift}_${dateFormatted}.csv`;
  
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function copyOpToClipboard() {
  navigator.clipboard.writeText(csvData).then(() => {
    const copyBtn = document.getElementById('op-copyBtn');
    const oldText = copyBtn.innerHTML;
    copyBtn.innerHTML = "✅ Copied!";
    copyBtn.classList.add('copy-confirm');
    setTimeout(() => {
      copyBtn.innerHTML = oldText;
      copyBtn.classList.remove('copy-confirm');
    }, 2000);
  });
}

function showToast(title, sub) {
  const toast = document.getElementById('op-toast');
  document.getElementById('op-toast-title').textContent = title;
  document.getElementById('op-toast-sub').textContent = sub;
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function confirmOpReset() {
  if (confirm("Are you sure you want to clear the entire form? Any unsaved delay rows will be lost.")) {
    const currentLine = document.getElementById('op-line-badge').dataset.val;
    setupOperatorForm(currentLine);
  }
}

// ─── ADMIN LOGS AUDITING PANEL ───────────────────────────────────────────────
async function loadAdminLogs() {
  let logs = [];
  
  if (window.supabase) {
    try {
      const { data, error } = await window.supabase
        .from('delay_logs')
        .select('*')
        .eq('source', 'operator')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      if (data) {
        logs = data.map(row => ({
          id:            row.id,
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
      }
    } catch(err) {
      console.warn("Supabase load failed. Loading operator logs from localStorage.", err);
      logs = JSON.parse(localStorage.getItem('tsdpl_operator_logs') || '[]');
      logs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  } else {
    // Fallback: Read from LocalStorage
    logs = JSON.parse(localStorage.getItem('tsdpl_operator_logs') || '[]');
    logs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  
  const tbody = document.getElementById('op-logs-tbody');
  const countSpan = document.getElementById('op-logs-count');
  
  if (!tbody) return;
  tbody.innerHTML = "";
  
  if (countSpan) countSpan.textContent = `${logs.length} entries`;
  
  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center;color:var(--muted);padding:30px;">
          No operator entries logged yet.
        </td>
      </tr>
    `;
    return;
  }
  
  logs.forEach(log => {
    const tr = document.createElement('tr');
    const timeLocal = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN') : '--';
    
    // Format delays list preview
    const delaySummaries = log.delays.map(d => `${d.type} (${d.time}m: ${d.reason})`).join(', ');
    
    tr.innerHTML = `
      <td><span style="font-family:var(--font-mono);font-size:11px;">${timeLocal}</span></td>
      <td><span class="pill pill-op">${log.employeeId}</span></td>
      <td><strong>${log.machine}</strong></td>
      <td>${log.date}</td>
      <td><span class="pill pill-a">Shift ${log.shift}</span></td>
      <td>${log.incharge}</td>
      <td>${log.team}</td>
      <td style="font-family:var(--font-mono);">${log.tonnage.toFixed(2)}</td>
      <td style="font-family:var(--font-mono);">${log.coils}</td>
      <td style="font-family:var(--font-mono);color:var(--accent4);font-weight:600;">${log.totalDelayMin} min</td>
      <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${delaySummaries}">${delaySummaries}</td>
      <td>
        <button class="filter-btn" style="padding: 4px 8px; font-size: 10px; background: var(--accent3); color: #000; border: none; border-radius: 4px; cursor: pointer;" onclick="promoteOperatorLog(${log.id})">
          ➕ ADD TO FILE DATA
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function promoteOperatorLog(logId) {
  if (!window.supabase) {
    alert("Supabase client is not initialized.");
    return;
  }
  if (!confirm("Are you sure you want to promote this operator entry to official file data?")) {
    return;
  }
  try {
    const { error } = await window.supabase
      .from('delay_logs')
      .update({ source: 'excel' })
      .eq('id', logId);
      
    if (error) throw error;
    
    alert("Successfully promoted operator log to file data! Dashboard will refresh automatically.");
    loadAdminLogs();
  } catch(e) {
    console.error("Failed to promote operator log:", e);
    alert(`Error: ${e.message}`);
  }
}

function downloadAdminLogsCSV() {
  const tbody = document.getElementById('op-logs-tbody');
  if (!tbody || tbody.rows.length === 0 || tbody.rows[0].cells.length <= 1) {
    alert("No logs available to export.");
    return;
  }
  
  // We will build a full CSV of operator entries
  const headers = ['TIMESTAMP','EMPLOYEE_ID','MACHINE','DATE','SHIFT','SHIFT INCHARGE','TEAM','TONNAGE','COILS','TOTAL DELAY (MIN)','DELAY_DETAILS'];
  const csvLines = [headers.join(',')];
  
  // Read from local storage or recall via API
  // To keep it simple and robust, we can query localStorage + fetch, or just parse the table rows
  let logs = [];
  const localLogs = JSON.parse(localStorage.getItem('tsdpl_operator_logs') || '[]');
  logs = localLogs; // Default to local
  
  // If we can get them dynamically
  const tableRows = tbody.querySelectorAll('tr');
  if (tableRows.length > 0 && tableRows[0].cells.length > 1) {
    // We can map table rows to CSV
    tableRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 10) return;
      const csvRow = [
        cells[0].textContent.trim(),
        cells[1].textContent.trim(),
        cells[2].textContent.trim(),
        cells[3].textContent.trim(),
        cells[4].textContent.trim(),
        cells[5].textContent.trim(),
        cells[6].textContent.trim(),
        cells[7].textContent.trim(),
        cells[8].textContent.trim(),
        cells[9].textContent.trim(),
        cells[10].getAttribute('title') || cells[10].textContent.trim()
      ];
      csvLines.push(csvRow.map(v => {
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ?
          `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    });
  }
  
  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `TSDPL_OPERATOR_DOWNTIME_LOGS.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function saveOperatorLogToSupabase(logEntry) {
  try {
    const formatted = {
      machine:       logEntry.machine,
      date:          logEntry.date,
      shift:         logEntry.shift,
      incharge:      logEntry.incharge,
      team:          logEntry.team,
      tonnage:       logEntry.tonnage,
      coils:         logEntry.coils,
      delays:        logEntry.delays || [],
      source:        'operator',
      employee_id:    logEntry.employeeId,
      start_time:     logEntry.startTime,
      end_time:       logEntry.endTime,
      timestamp:     logEntry.timestamp
    };

    const { error } = await window.supabase
      .from('delay_logs')
      .insert([formatted]);

    if (error) {
      console.error('Failed to save operator log to Supabase:', error.message);
    } else {
      console.log('Operator log saved to Supabase successfully.');
    }
  } catch(e) {
    console.error('Supabase Operator Log upload error:', e);
  }
}
