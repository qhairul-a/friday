window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.upload = (function () {
  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h2>Upload Data</h2>
        <p>Upload both Excel files to populate the dashboard. Data persists in your browser after upload.</p>
      </div>
      <div class="upload-grid">
        ${dropZone(1, 'File 1 — BMW KPI Report (Monthly)', 'e.g. 05 - IFL BMW KPI REPORT May 2026.xlsx')}
        ${dropZone(2, 'File 2 — Internal Delivery Performance', 'e.g. IFL BMW Delivery Performance Report 2026 - INTERNAL.xlsx')}
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;align-items:center">
        <button class="btn btn-danger" id="btn-clear">Clear All Data & Reset</button>
        <span id="upload-status" style="font-size:13px;color:var(--text-muted)"></span>
      </div>`;

    setupZone(container, 1);
    setupZone(container, 2);

    // Show loaded state if data already in store
    if (IFL.store.state.file1Loaded) markLoaded(container, 1, 'Previously loaded');
    if (IFL.store.state.file2Loaded) markLoaded(container, 2, 'Previously loaded');

    document.getElementById('btn-clear').onclick = () => {
      if (!confirm('Clear all loaded data and reset the dashboard?')) return;
      IFL.store.clear();
      IFL.charts.destroyAll();
      IFL.pages.upload.render(container);
      document.getElementById('data-dot').classList.remove('visible');
      document.getElementById('filter-bar').classList.add('hidden');
    };
  }

  function dropZone(idx, title, hint) {
    return `
      <div class="drop-zone" id="drop-zone-${idx}" data-file-idx="${idx}">
        <div class="drop-icon">📂</div>
        <div class="drop-title">${title}</div>
        <div class="drop-sub">${hint}</div>
        <input type="file" id="file-input-${idx}" accept=".xlsx,.xls" style="display:none">
        <div id="drop-status-${idx}"></div>
      </div>`;
  }

  function setupZone(container, idx) {
    const zone = container.querySelector(`#drop-zone-${idx}`);
    const input = container.querySelector(`#file-input-${idx}`);

    zone.onclick = () => input.click();
    input.onchange = () => { if (input.files[0]) handleFile(container, input.files[0], idx); };

    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = (e) => {
      e.preventDefault(); zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(container, file, idx);
    };
  }

  async function handleFile(container, file, idx) {
    const statusEl = container.querySelector(`#drop-status-${idx}`);
    const zone = container.querySelector(`#drop-zone-${idx}`);
    zone.classList.remove('loaded', 'error');
    statusEl.innerHTML = '<span class="upload-badge" style="background:#fef3c7;color:#92400e">⏳ Parsing…</span>';

    try {
      const result = await IFL.parser.parseWorkbook(file, idx);
      IFL.store.mergeFile(result);

      const count = result.shipments.length;
      const onDeckCount = result.onDeck ? result.onDeck.length : 0;
      const msg = idx === 1
        ? `✓ ${count} shipment rows loaded`
        : `✓ ${count} shipments + ${onDeckCount} on-deck records`;

      markLoaded(container, idx, msg);

      // Update filter bar + data dot
      IFL.filters.buildUI();
      document.getElementById('data-dot').classList.add('visible');
      document.getElementById('filter-bar').classList.remove('hidden');

      // Trigger re-render of current page
      if (window.IFL._app) IFL._app.renderCurrentPage();

      document.getElementById('upload-status').textContent = 'Data loaded successfully.';
    } catch(err) {
      zone.classList.add('error');
      statusEl.innerHTML = `<span class="upload-badge badge-error">✗ ${err.error || 'Parse error'}</span>`;
    }
  }

  function markLoaded(container, idx, msg) {
    const zone = container.querySelector(`#drop-zone-${idx}`);
    const statusEl = container.querySelector(`#drop-status-${idx}`);
    if (zone) zone.classList.add('loaded');
    if (statusEl) statusEl.innerHTML = `<span class="upload-badge badge-loaded">${msg}</span>`;
  }

  return { render };
})();
