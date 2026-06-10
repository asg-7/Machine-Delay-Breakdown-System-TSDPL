// ─────────────────────────────────────────────────────────────
//  parser.js  –  FIXED (v1.1)
//  Bugs fixed:
//    1. input.value reset after upload → re-uploading same / different file
//       always fires onchange again
//    2. filterRevision incremented after load → renderPage() re-renders
//       instead of returning from cache
//    3. SLITTER channel div onclick removed → no double-trigger conflict
//       (clicks are now handled exclusively via label[for] in the HTML)
// ─────────────────────────────────────────────────────────────

async function handleUpload(event, machine) {
  const file = event.target.files[0];

  // ── FIX 1: reset the input immediately so the same file can be
  //           re-selected (or a different file chosen) next time
  event.target.value = '';

  if (!file) return;

  const channelId = `ch-${machine.toLowerCase().replace(/-/g, '')}`;
  const statusDiv = document.getElementById('upload-status');
  statusDiv.innerHTML = `⏳ Parsing <strong>${file.name}</strong> for ${machine}…`;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    const normalize = s => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');

    let targetSheetName = workbook.SheetNames[0];
    let nonEmptyRows = [];
    let headerRowIndex = -1;
    let detectedHeaders = [];

    // ── SMART SHEET DETECTION ───────────────────────────────────────
    // Some uploaded Excel files have Pivot Tables as their first sheet.
    // We scan all sheets to find the one containing raw data (identified
    // by having 'DATE' and 'SHIFT' in the first 10 rows).
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const currentNonEmpty = (rows || []).filter(r =>
        Array.isArray(r) && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
      );
      
      let foundHeaderIdx = -1;
      let foundHeaders = [];
      for (let i = 0; i < Math.min(10, currentNonEmpty.length); i++) {
        const norm = currentNonEmpty[i].map(cell => normalize(cell));
        const hasDate  = norm.some(c => c.includes('DATE'));
        const hasShift = norm.some(c => c === 'SHIFT' || c.includes('SHIFT'));
        if (hasDate && hasShift) {
          foundHeaderIdx = i;
          foundHeaders = norm;
          break;
        }
      }

      if (foundHeaderIdx !== -1) {
        targetSheetName = name;
        nonEmptyRows = currentNonEmpty;
        headerRowIndex = foundHeaderIdx;
        detectedHeaders = foundHeaders;
        break; // Found the correct data sheet!
      }
    }

    // If no perfect match found, fallback to the first sheet that doesn't look like a Pivot Table
    if (headerRowIndex === -1) {
      console.warn('⚠️ Could not find a sheet with clear DATE/SHIFT headers. Attempting fallback.');
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const currentNonEmpty = (rows || []).filter(r =>
          Array.isArray(r) && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
        );
        
        // Avoid Pivot tables (often start with "Row Labels")
        const firstCell = currentNonEmpty.length > 0 ? normalize(currentNonEmpty[0][0]) : '';
        if (firstCell !== 'ROW LABELS' && currentNonEmpty.length > 0) {
          targetSheetName = name;
          nonEmptyRows = currentNonEmpty;
          break;
        }
      }
      
      // Ultimate fallback: just use the first sheet if everything else failed
      if (nonEmptyRows.length === 0) {
        targetSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        nonEmptyRows = (rows || []).filter(r =>
          Array.isArray(r) && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
        );
      }
    }

    if (!nonEmptyRows || nonEmptyRows.length < 1) throw new Error('File has no data rows in any valid sheet');
    
    console.log(`✅ Selected sheet for parsing: "${targetSheetName}"`);

    let colIndex = {};
    let dataStartRow = 0;

    if (headerRowIndex !== -1) {
      dataStartRow = headerRowIndex + 1;
      colIndex = {
        DATE:        detectedHeaders.findIndex(h => h.includes('DATE')),
        SHIFT:       detectedHeaders.findIndex(h => h === 'SHIFT' || h.includes('SHIFT')),
        INCHARGE:    detectedHeaders.findIndex(h => h.includes('INCHARGE') || h === 'SHIFT INCHARGE'),
        TEAM:        detectedHeaders.findIndex(h => h === 'TEAM' || h.includes('TEAM')),
        TONNAGE:     detectedHeaders.findIndex(h => h.includes('TONNAGE') || h === 'MT'),
        COIL:        detectedHeaders.findIndex(h => h.includes('COIL') || h.includes('COILS') || h.includes('NO OF')),
        TIME:        detectedHeaders.findIndex(h => h.includes('TIME') || h.includes('DURATION')),
        REASON:      detectedHeaders.findIndex(h => h.includes('REASON')),
        DESCRIPTION: detectedHeaders.findIndex(h => h.includes('DESCRIPTION') || h.includes('REMARK') || h.includes('DESC')),
      };

      // WCTL-2 fallback (uses MT for Tonnage and blank header for Reason/Description columns)
      if (colIndex.REASON === -1 && colIndex.DESCRIPTION === -1) {
        if (detectedHeaders.some(h => h === 'MT') || detectedHeaders.some(h => h === 'LINE')) {
          colIndex.REASON      = 11;
          colIndex.DESCRIPTION = 12;
          console.log('✏️ Detected WCTL-2 style columns. Overriding: REASON=11, DESCRIPTION=12');
        }
      }
      console.log('✅ Header detected at nonEmpty row', headerRowIndex, detectedHeaders);
    } else {
      // Fallback: original SLITDELAY fixed-column layout
      console.warn('⚠️ No header row with DATE/SHIFT found. Falling back to fixed columns.');
      dataStartRow = 0;
      colIndex = { DATE:0, SHIFT:1, INCHARGE:2, TEAM:3, TONNAGE:4, COIL:5, TIME:7, REASON:9, DESCRIPTION:10 };
    }

    if (colIndex.DATE === -1 || colIndex.SHIFT === -1) {
      throw new Error(`Could not locate DATE or SHIFT column. Tried headers: ${detectedHeaders.join(', ')}`);
    }

    const shifts    = [];
    const shiftMap  = {};
    let   validRows = 0;

    let lastDate    = null;
    let lastShift   = null;
    let lastIncharge = '';
    let lastTeam    = '';

    for (let i = dataStartRow; i < nonEmptyRows.length; i++) {
      const row = nonEmptyRows[i];
      let rawDate  = row[colIndex.DATE];
      let rawShift = row[colIndex.SHIFT];

      const isEmptyDate  = rawDate  === undefined || rawDate  === null || String(rawDate).trim()  === '';
      const isEmptyShift = rawShift === undefined || rawShift === null || String(rawShift).trim() === '';

      if (isEmptyDate  && lastDate)  rawDate  = lastDate;
      if (isEmptyShift && lastShift) rawShift = lastShift;

      if (rawDate === undefined || rawDate === null || String(rawDate).trim() === '') continue;

      // ── DATE NORMALISATION (strict) ──────────────────────────────
      // All dates are canonicalised to DD.MM.YYYY before being stored.
      // This ensures the dedup key is always identical for the same calendar date,
      // even if the raw value arrives as a serial number, "1.5.2026", "01-05-2026", etc.
      let date = rawDate;
      let dateValid = true;

      // Helper to repair truncated year strings from Excel corruption
      // '26' → '2026', '025' → '2025', '202' → '2020'
      function _repairYear(y) {
        y = String(y).trim();
        if (y.length <= 2) return '20' + y.padStart(2, '0');        // '26' → '2026', '6' → '2006'
        if (y.length === 3) {
          if (y.startsWith('0'))  return '2' + y;                   // '025' → '2025'
          return y + '0';                                           // '202' → '2020'
        }
        return y;
      }

      if (typeof date === 'number') {
        // Excel serial date — use SheetJS decoder (always reliable for >= 1900 serials)
        const pd = XLSX.SSF.parse_date_code(date);
        // Sanity-check: reject obviously wrong years
        if (!pd || pd.y < 2000 || pd.y > 2100) {
          // SheetJS sometimes returns 1900 for text-stored dates it can't parse.
          // Try treating the raw number as a string-encoded date (e.g. 10052026 → rare)
          dateValid = false;
        } else {
          date = `${String(pd.d).padStart(2,'0')}.${String(pd.m).padStart(2,'0')}.${pd.y}`;
        }
      }

      if (!dateValid || typeof rawDate !== 'number') {
        // String path — handle DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
        date = String(rawDate).trim();
        let dd, mm, yy;

        if (date.includes('.')) {
          const p = date.split('.');
          // Could be DD.MM.YYYY or DD.MM.YY
          if (p.length === 3) {
            [dd, mm, yy] = p;
            // Repair truncated years: '025' → '2025', '26' → '2026', '202' → '2026'
            if (yy.length < 4) yy = _repairYear(yy);
          }
        } else if (date.includes('/')) {
          const p = date.split('/');
          if (p.length === 3) {
            // Assume DD/MM/YYYY (Indian standard)
            [dd, mm, yy] = p;
            if (yy.length < 4) yy = _repairYear(yy);
          }
        } else if (date.includes('-')) {
          const p = date.split('-');
          if (p.length === 3) {
            if (p[0].length === 4) {
              // YYYY-MM-DD (ISO)
              [yy, mm, dd] = p;
            } else {
              // DD-MM-YYYY
              [dd, mm, yy] = p;
              if (yy.length < 4) yy = _repairYear(yy);
            }
          }
        }

        if (dd && mm && yy) {
          dd = String(dd).padStart(2, '0');
          mm = String(mm).padStart(2, '0');
          yy = String(yy);
          // Validate ranges
          const dNum = parseInt(dd), mNum = parseInt(mm), yNum = parseInt(yy);
          if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 2000 && yNum <= 2100) {
            date = `${dd}.${mm}.${yy}`;
            dateValid = true;
          } else {
            dateValid = false;
          }
        } else {
          dateValid = false;
        }
      }

      // Skip rows with unparseable or out-of-range dates; log a warning
      if (!dateValid) {
        console.warn(`⚠️ Skipped row ${i}: unrecognised date value "${rawDate}"`);
        continue;
      }
      // ── END DATE NORMALISATION ───────────────────────────────────

      const shift = String(rawShift || '').trim().toUpperCase();
      if (!shift) continue;

      let incharge = row[colIndex.INCHARGE];
      if ((incharge === undefined || incharge === null || String(incharge).trim() === '') && lastIncharge) incharge = lastIncharge;
      if (typeof incharge === 'string') incharge = incharge.trim();

      let team = row[colIndex.TEAM];
      if ((team === undefined || team === null || String(team).trim() === '') && lastTeam) team = lastTeam;

      let tonnage = parseFloat(row[colIndex.TONNAGE]); if (isNaN(tonnage)) tonnage = 0;
      let coils   = parseFloat(row[colIndex.COIL]);    if (isNaN(coils))   coils   = 0;

      lastDate     = rawDate;
      lastShift    = rawShift;
      lastIncharge = incharge;
      lastTeam     = team;

      // Dedup key: date is already canonical DD.MM.YYYY; trim incharge + team to avoid ghost duplicates
      const keyIncharge = String(incharge || '').trim().toUpperCase();
      const keyTeam     = String(team     || '').trim().toUpperCase();
      const key = `${date}|${shift}|${keyIncharge}|${keyTeam}`;
      let shiftObj = shiftMap[key];
      if (!shiftObj) {
        shiftObj = { date, shift, incharge: normIncharge(incharge), team, machine, tonnage, coils, delays: [] };
        shiftMap[key]  = shiftObj;
        shifts.push(shiftObj);
      } else {
        shiftObj.tonnage = Math.max(shiftObj.tonnage, tonnage);
        shiftObj.coils   = Math.max(shiftObj.coils, coils);
      }

      const time = parseInt(row[colIndex.TIME]);
      if (time && !isNaN(time) && time > 0) {
        const reason      = String(row[colIndex.REASON]      || '').trim();
        const description = String(row[colIndex.DESCRIPTION] || '').trim();
        const extraReason = row.slice(Math.max(colIndex.REASON, colIndex.DESCRIPTION) + 1)
          .map(cell => String(cell || '').trim())
          .find(val => val && !/^#REF!$/i.test(val));
        const delayReason = reason || extraReason || description;

        // The REASON column may contain the detailed reason-for-delay text,
        // while DESCRIPTION often carries the generic delay label. If the right
        // side of the row has extra non-empty text, prefer that as the true reason.
        const typeFromDesc   = description ? normDelay(description) : 'OTHER';
        const typeFromReason = (reason || extraReason) ? normDelay(reason || extraReason) : 'OTHER';
        const resolvedType   = (typeFromDesc !== 'OTHER') ? typeFromDesc : typeFromReason;

        shiftObj.delays.push({ time, type: resolvedType, description, reason: delayReason });
      }
      validRows++;
    }

    if (shifts.length === 0) {
      throw new Error(`No shifts found. First few data rows: ${JSON.stringify(nonEmptyRows.slice(dataStartRow, dataStartRow + 3))}`);
    }

    // ── DATE RANGE VALIDATION WARNING ────────────────────────────
    const now = new Date();
    const warnDates = [];
    for (const s of shifts) {
      const p = s.date.split('.');
      if (p.length === 3) {
        const d = new Date(p[2], p[1] - 1, p[0]);
        if (d > now) warnDates.push(`${s.date} (future)`);
        else if (parseInt(p[2]) < 2000) warnDates.push(`${s.date} (pre-2000)`);
      }
    }
    if (warnDates.length > 0) {
      statusDiv.innerHTML += `<br>⚠️ <span style="color:var(--accent4)">Suspicious dates detected (${warnDates.length}):</span> ${warnDates.slice(0,5).join(', ')}${warnDates.length>5?' …':''} — check source file.`;
    }
    // ── END DATE RANGE VALIDATION ─────────────────────────────────

    // Replace data for this machine only
    window.RAW_DATA = RAW_DATA.filter(entry => entry.machine !== machine);
    window.RAW_DATA.push(...shifts);

    // Persist parsed data to backend for global sharing
    fetch(`https://machine-delay-breakdown-system-tsdpl.onrender.com/api/upload-data?machine=${encodeURIComponent(machine)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shifts)
    }).then(res => {
      if (res.ok) console.log(`Successfully synced ${machine} data to backend server.`);
    }).catch(err => {
      console.warn("FastAPI backend offline. Data is kept in-memory for this session.", err);
    });

    // Update channel card UI
    if (typeof updateUCNCards === 'function') {
      updateUCNCards(window.RAW_DATA);
    } else {
      const channelDiv = document.getElementById(channelId);
      if (channelDiv) channelDiv.classList.add('loaded');
      const countSpan = document.getElementById(`cnt-${machine.toLowerCase().replace(/-/g,'')}`);
      if (countSpan) countSpan.textContent = shifts.length;
    }

    // Sync parsed Excel rows to Supabase
    if (window.supabase) {
      await uploadExcelToSupabase(shifts, machine);
    }

    statusDiv.innerHTML += `<br>✅ <span style="color:var(--accent3)">${machine}</span>: ${shifts.length} shifts loaded (${validRows} delay rows). Old ${machine} data replaced.`;

    // Refresh filters and data
    populateFilters();
    document.getElementById('f-incharge').value = 'ALL';
    document.getElementById('f-delay').value    = 'ALL';
    applyFilters();

    // ── FIX 2: bump filterRevision so renderPage() doesn't skip re-render
    window.filterRevision = (window.filterRevision || 0) + 1;
    window.renderedRevisions = {};   // clear all page caches

    const activeTab = document.querySelector('.tab.active');
    if (activeTab) renderPage(activeTab.dataset.page);

    // Kick off anomaly detection if server is up
    if (typeof runAnomalyDetection === 'function' && window.RAW_DATA.length > 0) {
      runAnomalyDetection(window.RAW_DATA);
    }

  } catch (err) {
    console.error(err);
    statusDiv.innerHTML += `<br>❌ <strong>Error:</strong> ${err.message}. Open DevTools (F12) → Console for details.`;
  }
}

// ─────────────────────────────────────────────────────────────
//  Per-Line Upload & Sync  –  Orchestrator
// ─────────────────────────────────────────────────────────────

function _pluId(machine) {
  return machine.toLowerCase().replace(/-/g, '');
}

async function perLineUpload(machine) {
  const id       = _pluId(machine);
  const fileInput = document.getElementById('plu-file-' + id);
  const btn       = document.getElementById('plu-btn-' + id);
  const msgDiv    = document.getElementById('plu-msg-' + id);

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (msgDiv) { msgDiv.innerHTML = '<span style="color:var(--danger)">⚠ No file selected.</span>'; }
    return;
  }

  const file = fileInput.files[0];

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;
  if (msgDiv) msgDiv.innerHTML = '<span style="color:var(--accent4)">⏳ Parsing & uploading…</span>';

  try {
    // Synthesise a change-event-like object compatible with handleUpload
    const syntheticEvent = { target: { files: [file], value: '' } };
    await handleUpload(syntheticEvent, machine);

    // Count the shifts for this machine in RAW_DATA after upload
    const machineShifts = (window.RAW_DATA || []).filter(s => s.machine === machine);
    const count = machineShifts.length;

    if (msgDiv) {
      msgDiv.innerHTML = `<span style="color:var(--accent3)">✅ ${machine} data synced — ${count} rows uploaded</span>`;
    }

    // Refresh last-sync timestamp
    await fetchLastSyncTime(machine, id);

  } catch (err) {
    console.error('Per-line upload error:', err);
    if (msgDiv) {
      msgDiv.innerHTML = `<span style="color:var(--danger)">❌ Upload failed: ${err.message}</span>`;
    }
  } finally {
    btn.classList.remove('loading');
    // Reset file input so the same file can be re-selected
    fileInput.value = '';
    const label = document.getElementById('plu-label-' + id);
    if (label) {
      label.textContent = '📎 Choose .xlsx file…';
      label.classList.remove('has-file');
    }
    btn.disabled = true;
  }
}

async function fetchLastSyncTime(machine, id) {
  const statusDiv = document.getElementById('plu-status-' + id);
  if (!statusDiv) return;

  try {
    // Query the max created_at timestamp for excel-sourced rows of this machine
    // Supabase doesn't have a direct max() shorthand, so we order desc + limit 1
    const { data, error } = await window.supabase
      .from('delay_logs')
      .select('created_at')
      .eq('machine', machine)
      .eq('source', 'excel')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0 && data[0].created_at) {
      const ts = new Date(data[0].created_at);
      const formatted = ts.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      statusDiv.className = 'plu-status synced';
      statusDiv.innerHTML = `<span class="plu-dot"></span><span class="plu-status-text">Last synced: ${formatted}</span>`;
    } else {
      statusDiv.className = 'plu-status';
      statusDiv.innerHTML = '<span class="plu-dot"></span><span class="plu-status-text">No data synced yet</span>';
    }
  } catch (err) {
    console.warn('fetchLastSyncTime error for ' + machine + ':', err);
    statusDiv.className = 'plu-status error';
    statusDiv.innerHTML = '<span class="plu-dot"></span><span class="plu-status-text">Could not check sync status</span>';
  }
}

// ─────────────────────────────────────────────────────────────
//  uploadExcelToSupabase  –  Batch insert to Supabase
// ─────────────────────────────────────────────────────────────

async function uploadExcelToSupabase(shifts, machine) {
  const statusDiv = document.getElementById('upload-status');
  const originalHtml = statusDiv.innerHTML;
  try {
    statusDiv.innerHTML = originalHtml + `<br>⏳ Uploading data to Supabase…`;
    
    // 1. Delete existing excel shifts for this machine
    const { error: deleteError } = await window.supabase
      .from('delay_logs')
      .delete()
      .eq('machine', machine)
      .eq('source', 'excel');

    if (deleteError) {
      console.error(`Failed to delete old Excel shifts for ${machine} from Supabase:`, deleteError.message);
      statusDiv.innerHTML = originalHtml + `<br>⚠️ Supabase delete error: ${deleteError.message}`;
      return;
    }

    // 2. Format new shifts — convert DD.MM.YYYY → YYYY-MM-DD for Supabase
    const formatted = shifts.map(row => {
      let isoDate = row.date;
      if (row.date && row.date.includes('.')) {
        const parts = row.date.split('.');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
        }
      }
      return {
        machine:       machine,
        date:          isoDate,
        shift:         row.shift,
        incharge:      row.incharge,
        team:          row.team,
        tonnage:       row.tonnage,
        coils:         row.coils,
        delays:        row.delays || [],
        source:        'excel'
      };
    });

    // 3. Batch insert in chunks of 200
    const chunkSize = 200;
    for (let i = 0; i < formatted.length; i += chunkSize) {
      const chunk = formatted.slice(i, i + chunkSize);
      statusDiv.innerHTML = originalHtml + `<br>⏳ Uploading to Supabase (${i} of ${formatted.length})…`;
      const { error: insertError } = await window.supabase
        .from('delay_logs')
        .insert(chunk);

      if (insertError) {
        console.error(`Failed to upload batch ${i} to Supabase:`, insertError.message);
        throw insertError;
      }
    }

    console.log(`Successfully uploaded ${formatted.length} Excel shifts for ${machine} to Supabase.`);
    statusDiv.innerHTML = originalHtml + `<br>✅ Synced ${formatted.length} shifts to Supabase.`;
  } catch(e) {
    console.error('Supabase Excel upload error:', e);
    statusDiv.innerHTML = originalHtml + `<br>❌ Supabase upload failed: ${e.message}`;
  }
}