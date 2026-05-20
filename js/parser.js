async function handleUpload(event, machine) {
  const file = event.target.files[0];
  if (!file) return;

  const channelId = `ch-${machine.toLowerCase().replace('-', '')}`;
  const statusDiv = document.getElementById('upload-status');
  statusDiv.innerHTML = `⏳ Parsing ${file.name} for ${machine}...`;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Remove completely empty rows
    const nonEmptyRows = (rows || []).filter(r => Array.isArray(r) && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));
    if (!nonEmptyRows || nonEmptyRows.length < 1) throw new Error('File has no data rows');

    const normalize = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');

    // Try to locate a header row within the first 10 non-empty rows
    let headerRowIndex = -1;
    let detectedHeaders = [];
    for (let i = 0; i < Math.min(10, nonEmptyRows.length); i++) {
      const r = nonEmptyRows[i];
      const norm = r.map(cell => normalize(cell));
      const hasDate = norm.some(c => c.includes('DATE'));
      const hasShift = norm.some(c => c === 'SHIFT' || c.includes('SHIFT'));
      if (hasDate && hasShift) {
        headerRowIndex = i;
        detectedHeaders = norm;
        break;
      }
    }

    let colIndex = {};
    let dataStartRow = 0;

    if (headerRowIndex !== -1) {
      dataStartRow = headerRowIndex + 1;
      colIndex = {
        DATE: detectedHeaders.findIndex(h => h.includes('DATE')),
        SHIFT: detectedHeaders.findIndex(h => h === 'SHIFT' || h.includes('SHIFT')),
        INCHARGE: detectedHeaders.findIndex(h => h.includes('INCHARGE') || h === 'SHIFT INCHARGE'),
        TEAM: detectedHeaders.findIndex(h => h === 'TEAM' || h.includes('TEAM')),
        TONNAGE: detectedHeaders.findIndex(h => h.includes('TONNAGE') || h === 'MT'),
        COIL: detectedHeaders.findIndex(h => h.includes('COIL') || h.includes('COILS') || h.includes('NO OF')),
        TIME: detectedHeaders.findIndex(h => h.includes('TIME') || h.includes('DURATION')),
        REASON: detectedHeaders.findIndex(h => h.includes('REASON')),
        DESCRIPTION: detectedHeaders.findIndex(h => h.includes('DESCRIPTION') || h.includes('REMARK') || h.includes('DESC')),
      };

      // WCTL-2 layout fallback overrides (which has MT for Tonnage and blank header for Reason)
      if (colIndex.REASON === -1 || colIndex.DESCRIPTION === -1) {
        if (detectedHeaders.some(h => h === 'MT') || detectedHeaders.some(h => h === 'LINE')) {
          colIndex.REASON = 11;
          colIndex.DESCRIPTION = 12;
          console.log('✏️ Detected WCTL-2 style columns. Overriding: REASON=11, DESCRIPTION=12');
        }
      }
      console.log('✅ Header detected at nonEmpty row', headerRowIndex, detectedHeaders);
    } else {
      // Fallback: assume original SLITDELAY layout (A=DATE, B=SHIFT, C=INCHARGE, D=TEAM, E=TONNAGE, F=COIL, H=TIME, J=REASON, K=DESCRIPTION)
      console.warn('⚠️ No header row with DATE/SHIFT found. Falling back to fixed columns (A=DATE,B=SHIFT,C=INCHARGE,D=TEAM,E=TONNAGE,F=COIL,H=TIME,J=REASON,K=DESCRIPTION)');
      dataStartRow = 0;
      colIndex = { DATE: 0, SHIFT: 1, INCHARGE: 2, TEAM: 3, TONNAGE: 4, COIL: 5, TIME: 7, REASON: 9, DESCRIPTION: 10 };
    }

    if (colIndex.DATE === -1 || colIndex.SHIFT === -1) {
      throw new Error(`Could not locate DATE or SHIFT column. Tried headers: ${detectedHeaders.join(', ')}`);
    }

    const shifts = [];
    const shiftMap = {};
    let validRows = 0;

    let lastDate = null;
    let lastShift = null;
    let lastIncharge = '';
    let lastTeam = '';

    for (let i = dataStartRow; i < nonEmptyRows.length; i++) {
      const row = nonEmptyRows[i];
      let rawDate = row[colIndex.DATE];
      let rawShift = row[colIndex.SHIFT];
      
      let isEmptyDate = rawDate === undefined || rawDate === null || String(rawDate).trim() === '';
      let isEmptyShift = rawShift === undefined || rawShift === null || String(rawShift).trim() === '';

      if (isEmptyDate && lastDate) rawDate = lastDate;
      if (isEmptyShift && lastShift) rawShift = lastShift;

      if (rawDate === undefined || rawDate === null || String(rawDate).trim() === '') continue;

      let date = rawDate;
      if (typeof date === 'number') {
        const pd = XLSX.SSF.parse_date_code(date);
        if (pd.y < 2000) {
          const str = String(rawDate);
          if (str.includes('.')) {
            const parts = str.split('.');
            if (parts[1].length === 6) {
              date = `${parts[0].padStart(2,'0')}.${parts[1].substring(0,2)}.${parts[1].substring(2)}`;
            } else {
              date = `${String(pd.d).padStart(2, '0')}.${String(pd.m).padStart(2, '0')}.${pd.y}`;
            }
          } else {
            date = `${String(pd.d).padStart(2, '0')}.${String(pd.m).padStart(2, '0')}.${pd.y}`;
          }
        } else {
          date = `${String(pd.d).padStart(2, '0')}.${String(pd.m).padStart(2, '0')}.${pd.y}`;
        }
      } else {
        date = String(date).trim();
        if (date.includes('-')) {
          const parts = date.split('-');
          if (parts.length === 3) date = `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
      }

      const shift = String(rawShift || '').trim().toUpperCase();
      if (!shift) continue;

      let incharge = row[colIndex.INCHARGE];
      if ((incharge === undefined || incharge === null || String(incharge).trim() === '') && lastIncharge) incharge = lastIncharge;
      if (typeof incharge === 'string') incharge = incharge.trim();

      let team = row[colIndex.TEAM];
      if ((team === undefined || team === null || String(team).trim() === '') && lastTeam) team = lastTeam;

      let tonnage = parseFloat(row[colIndex.TONNAGE]);
      if (isNaN(tonnage)) tonnage = 0;
      let coils = parseFloat(row[colIndex.COIL]);
      if (isNaN(coils)) coils = 0;

      lastDate = rawDate;
      lastShift = rawShift;
      lastIncharge = incharge;
      lastTeam = team;

      const key = `${date}|${shift}|${incharge}|${team}`;
      let shiftObj = shiftMap[key];
      if (!shiftObj) {
        shiftObj = { date, shift, incharge: normIncharge(incharge), team, machine, tonnage, coils, delays: [] };
        shiftMap[key] = shiftObj;
        shifts.push(shiftObj);
      } else {
        shiftObj.tonnage = Math.max(shiftObj.tonnage, tonnage);
        shiftObj.coils = Math.max(shiftObj.coils, coils);
      }

      const time = parseInt(row[colIndex.TIME]);
      if (time && !isNaN(time) && time > 0) {
        let reason = row[colIndex.REASON] || '';
        let description = row[colIndex.DESCRIPTION] || '';
        shiftObj.delays.push({ time: time, type: normDelay(reason), description: description });
      }
      validRows++;
    }

    if (shifts.length === 0) {
      throw new Error(`No shifts found. First few data rows: ${JSON.stringify(nonEmptyRows.slice(dataStartRow, dataStartRow + 3))}`);
    }

    // Replace data for this machine
    window.RAW_DATA = RAW_DATA.filter(entry => entry.machine !== machine);
    window.RAW_DATA.push(...shifts);

    // Update UI
    const channelDiv = document.getElementById(channelId);
    if (channelDiv) channelDiv.classList.add('loaded');
    const countSpan = document.getElementById(`cnt-${machine.toLowerCase().replace('-', '')}`);
    if (countSpan) countSpan.textContent = shifts.length;

    statusDiv.innerHTML += `<br>✅ <span style="color:var(--accent3)">${machine}</span>: ${shifts.length} shifts loaded (${validRows} delay rows). Old data replaced.`;

    // Refresh dashboard
    populateFilters();
    // Reset filter dropdowns so stale selections don't hide the newly loaded data
    document.getElementById('f-incharge').value = 'ALL';
    document.getElementById('f-delay').value = 'ALL';
    applyFilters();
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) renderPage(activeTab.dataset.page);

  } catch (err) {
    console.error(err);
    statusDiv.innerHTML += `<br>❌ Error: ${err.message}. Check console (F12) for details.`;
  }
}
