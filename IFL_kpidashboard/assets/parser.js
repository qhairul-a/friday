// IFL_kpidashboard/assets/parser.js
window.IFL = window.IFL || {};

window.IFL.parser = (function () {
  const KPI_TARGET = 0.985;

  function excelTimeToStr(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      // Strip integer part — Excel datetime serials include a date component;
      // time-only values are pure fractions < 1. % 1 isolates the time fraction.
      const frac = value % 1;
      const totalMinutes = Math.round(frac * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return String(value).trim();
  }

  function excelDateToStr(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      try {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
      } catch(e) {}
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).trim();
  }

  function isPassFail(value, trueWords) {
    const v = String(value || '').trim().toUpperCase();
    return trueWords.some(w => v.includes(w));
  }

  function rows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  }

  // ── File 1 parsers ──────────────────────────────────────────────────────────

  function parseFile1RegionSheet(workbook, sheetName, regionCode) {
    const allRows = rows(workbook, sheetName);
    if (!allRows) return [];
    const shipments = [];
    let headerIdx = -1;

    // Find header row: first col must be 'No.' or 'No'
    for (let i = 0; i < allRows.length; i++) {
      const c0 = String(allRows[i][0] || '').trim().toLowerCase();
      if (c0 === 'no.' || c0 === 'no') { headerIdx = i; break; }
    }
    if (headerIdx === -1) return [];

    // Dynamically map column names to indices — each sheet has different layouts
    const hdr = allRows[headerIdx];
    const col = {};
    for (let i = 0; i < hdr.length; i++) {
      const h = String(hdr[i] || '').trim().toLowerCase();
      if (h === 'cw')                                           col.cw           = i;
      else if (h.includes('shipment type'))                     col.shipmentType  = i;
      else if ((h === 'truck number' || h === 'truck no.'))     col.truck         = i;
      else if (h === 'kpi deadline')                            col.kpiDeadline   = i;
      else if (h === 'delivered on')                            col.deliveredOn   = i;
      else if (h === 'delivery time' && col.deliveredOn == null) col.deliveredOn  = i;
      else if (h.includes('kpi pass') || h === 'kpi pass/fail') col.before       = i;
      else if (h.includes('after investigation'))               col.after         = i;
      else if ((h === 'date' || h.includes('collection date')) && col.date == null) col.date = i;
      else if ((h === 'remarks' || h === 'remark for customer') && col.remarks == null) col.remarks = i;
    }

    // Must have at least CW and before-investigation columns to be useful
    if (col.cw == null || col.before == null) return [];

    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const r = allRows[i];
      if (r[0] === null || r[0] === '') continue;
      if (isNaN(Number(r[0]))) continue;

      // CW column is always an integer in these sheets (19, 20, 21…)
      const cwRaw = r[col.cw];
      if (cwRaw === null || cwRaw === undefined) continue;
      const cw = typeof cwRaw === 'number' ? `CW${cwRaw}` : String(cwRaw).trim().toUpperCase().replace(/\s+/, '');
      if (!cw.match(/^CW\d+/)) continue;

      const achievedBefore = isPassFail(r[col.before], ['ACHIEV', 'PASS', 'YES', 'Y', '✓']);
      const rawAfter = col.after != null ? String(r[col.after] || '').trim() : '';
      const achievedAfter = rawAfter === '' ? achievedBefore
        : isPassFail(r[col.after], ['ACHIEV', 'PASS', 'YES', 'Y', '✓']);

      shipments.push({
        region: regionCode,
        hub: null,
        dealer: null,
        vin: null,
        cw,
        date:         col.date       != null ? excelDateToStr(r[col.date])   : null,
        shipmentType: col.shipmentType != null ? String(r[col.shipmentType] || '').trim().toUpperCase() : '',
        truckNumber:  col.truck       != null ? String(r[col.truck]       || '').trim() : '',
        kpiDeadline:  col.kpiDeadline != null ? excelTimeToStr(r[col.kpiDeadline]) : null,
        deliveredOn:  col.deliveredOn != null ? excelTimeToStr(r[col.deliveredOn])  : null,
        achievedBefore,
        achievedAfter,
        remarks:      col.remarks     != null ? String(r[col.remarks]     || '').trim() : '',
      });
    }
    return shipments;
  }

  function parseFile1(workbook) {
    const regionMap = { 'CZ': 'CZ', 'SG': 'SG', 'MY': 'MY', 'THAI': 'THAI' };
    const allShipments = [];
    for (const [sheet, code] of Object.entries(regionMap)) {
      const s = parseFile1RegionSheet(workbook, sheet, code);
      allShipments.push(...s);
    }
    return allShipments;
  }

  // ── File 2 parsers ──────────────────────────────────────────────────────────

  function parseFile2KpiReport(workbook) {
    const allRows = rows(workbook, 'KPI Report');
    if (!allRows) return [];
    const summaries = [];

    const hubNames = [
      'JB Hub SG', 'JB Hub CZ', 'JB Hub South', 'KL Hub Central',
      'JB Hub - Singapore', 'JB Hub - Singapore CZ', 'JB Hub - Southern',
      'KL Hub - Central'
    ];
    let currentHub = null;

    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      const c0 = String(r[0] || '').trim();
      if (!c0) continue;

      // Detect hub header rows
      const isHub = hubNames.some(h => c0.toLowerCase().includes(h.toLowerCase().split(' ')[0]) &&
                                       c0.toLowerCase().includes('hub'));
      if (isHub) { currentHub = c0; continue; }

      // Detect CW data rows: col 0 matches CW pattern, col 2 is numeric
      const cwMatch = c0.toUpperCase().match(/CW\s*(\d+)/);
      if (cwMatch && currentHub && typeof r[2] === 'number') {
        summaries.push({
          cw: `CW${cwMatch[1]}`,
          source: 'hub',
          name: currentHub,
          totalShipments: r[2] || 0,
          achievedBefore: r[3] || 0,
          notAchievedBefore: r[4] || 0,
          kpiBefore: typeof r[5] === 'number' ? r[5] : parseFloat(r[5]) || 0,
          achievedAfter: r[6] || r[3] || 0,
          notAchievedAfter: r[7] || r[4] || 0,
          kpiAfter: typeof r[8] === 'number' ? r[8] : (typeof r[5] === 'number' ? r[5] : 0),
        });
      }
    }
    return summaries;
  }

  function parseFile2CwSheet(workbook, sheetName, cwLabel) {
    const allRows = rows(workbook, sheetName);
    if (!allRows) return [];
    const shipments = [];
    let currentDealer = null;
    let currentHub = null;

    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      const c0 = String(r[0] || '').trim();
      const c1 = String(r[1] || '').trim();

      if (!c0 && !c1) continue;

      // Detect hub label rows
      if (c0.toLowerCase().includes('hub') && !r[2]) {
        currentHub = c0; continue;
      }
      // Detect dealer header rows: c0 has text, c1 is empty, no numeric cols after
      if (c0 && !c1 && r[2] === null && r[3] === null) {
        const low = c0.toLowerCase();
        if (!low.includes('total') && !low.includes('achieved') && !low.includes('failed') &&
            !low.includes('report') && !low.includes('ifl')) {
          currentDealer = c0; continue;
        }
      }
      // Detect VIN rows: c0 is a date (number) OR c1 looks like VIN / booking number
      const hasDate = typeof r[0] === 'number' && r[0] > 40000;
      const hasVin  = c1 && c1.length > 4 && !/^(total|achieved|failed|shipment)/i.test(c1);
      if ((hasDate || hasVin) && currentDealer) {
        const kpiStatus = String(r[5] || r[6] || '').trim().toUpperCase();
        const achievedBefore = isPassFail(kpiStatus, ['ACHIEV', 'PASS', '✓']);
        const afterVal = String(r[8] || r[7] || '').trim().toUpperCase();
        const achievedAfter = afterVal === '' ? achievedBefore
          : isPassFail(afterVal, ['ACHIEV', 'PASS', '✓']);

        shipments.push({
          region: null,
          hub: currentHub,
          dealer: currentDealer,
          vin: c1 || null,
          cw: cwLabel,
          date: excelDateToStr(r[0]),
          shipmentType: String(r[3] || '').trim().toUpperCase() || null,
          truckNumber: null,
          kpiDeadline: excelTimeToStr(r[4]),
          deliveredOn: excelTimeToStr(r[5]),
          achievedBefore,
          achievedAfter,
          remarks: String(r[9] || r[8] || '').trim(),
        });
      }
    }
    return shipments;
  }

  function parseFile2OnDeck(workbook, sheetName, cwLabel) {
    const allRows = rows(workbook, sheetName);
    if (!allRows) return [];
    const records = [];
    let headerIdx = -1;

    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      const c0 = String(r[0] || '').trim().toLowerCase();
      const c1 = String(r[1] || '').trim().toLowerCase();
      if (c0 === 'date' || c1 === 'shipment type') { headerIdx = i; break; }
    }
    if (headerIdx === -1) return [];

    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const r = allRows[i];
      if (!r[0] && !r[1]) continue;
      const date = excelDateToStr(r[0]);
      const shipmentType = String(r[1] || '').trim().toUpperCase();
      if (!date && !shipmentType) continue;

      const statusRaw = String(r[6] || '').trim().toUpperCase();
      records.push({
        cw: cwLabel,
        date,
        shipmentType,
        truckNumber: String(r[2] || '').trim(),
        driverName: String(r[3] || '').trim(),
        scheduledOnDeck: excelTimeToStr(r[4]),
        actualOnDeck: excelTimeToStr(r[5]),
        onTime: isPassFail(statusRaw, ['ON TIME', 'ONTIME', 'YES', 'Y', '✓']),
        remarks: String(r[7] || '').trim(),
      });
    }
    return records;
  }

  function parseFile2(workbook) {
    const allShipments = [];
    const allOnDeck = [];
    const hubSummaries = parseFile2KpiReport(workbook);

    workbook.SheetNames.forEach(name => {
      const cwMatch = name.match(/CW\s*(\d+)/i);
      if (cwMatch && !name.toLowerCase().includes('deck') && !name.toLowerCase().includes('timing')) {
        const cw = `CW${cwMatch[1]}`;
        allShipments.push(...parseFile2CwSheet(workbook, name, cw));
      }
      if (name.toLowerCase().includes('deck') || name.toLowerCase().includes('timing')) {
        const cwM = name.match(/CW\s*(\d+)/i);
        const cw = cwM ? `CW${cwM[1]}` : 'Unknown';
        allOnDeck.push(...parseFile2OnDeck(workbook, name, cw));
      }
    });

    return { shipments: allShipments, onDeck: allOnDeck, hubSummaries };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  function parseWorkbook(file, fileIndex) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
          if (fileIndex === 1) {
            // File 1: require at least 2 of the 4 region sheets (not the summary)
            const required = ['CZ', 'SG', 'MY', 'THAI'];
            const found = required.filter(s => wb.SheetNames.includes(s));
            if (found.length < 2) {
              reject({ error: `Expected sheets not found. Found: ${wb.SheetNames.join(', ')}` });
              return;
            }
            const shipments = parseFile1(wb);
            resolve({ fileIndex, shipments, onDeck: [], hubSummaries: [] });
          } else {
            // File 2: check required sheets
            const hasKpi = wb.SheetNames.some(s => s.toLowerCase().includes('kpi report'));
            if (!hasKpi) {
              reject({ error: `"KPI Report" sheet not found. Found: ${wb.SheetNames.join(', ')}` });
              return;
            }
            const result = parseFile2(wb);
            resolve({ fileIndex, ...result });
          }
        } catch(err) {
          reject({ error: String(err) });
        }
      };
      reader.onerror = () => reject({ error: 'File read error' });
      reader.readAsArrayBuffer(file);
    });
  }

  return { parseWorkbook, KPI_TARGET };
})();
