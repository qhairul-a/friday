// IFL_kpidashboard/assets/pages/trucks.js
window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.trucks = (function () {
  let _sortCol = 'date';
  let _sortDir = 1;

  function esc(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(container, filters) {
    const records = IFL.store.filterOnDeck(filters);
    if (!records.length) {
      container.innerHTML = IFL.pages._emptyState('No on-deck data — upload File 2 (Internal Report) to see truck performance.');
      return;
    }

    const onTimeCount = records.filter(r => r.onTime).length;
    const onTimePct = records.length ? (onTimeCount / records.length * 100).toFixed(1) : '—';

    let sorted = [...records];
    sorted.sort((a, b) => {
      const va = a[_sortCol] ?? '', vb = b[_sortCol] ?? '';
      return (va < vb ? -1 : va > vb ? 1 : 0) * _sortDir;
    });

    function thBtn(col, label) {
      const active = _sortCol === col;
      const arrow = active ? (_sortDir === 1 ? ' ↑' : ' ↓') : '';
      return `<th data-col="${col}">${label}${arrow}</th>`;
    }

    const tableRows = sorted.map(r => `
      <tr class="${r.onTime ? 'row-green' : 'row-red'}">
        <td>${esc(r.date) || '—'}</td>
        <td>${esc(r.cw)}</td>
        <td>${esc(r.truckNumber) || '—'}</td>
        <td>${esc(r.driverName) || '—'}</td>
        <td>${esc(r.shipmentType) || '—'}</td>
        <td>${esc(r.scheduledOnDeck) || '—'}</td>
        <td>${esc(r.actualOnDeck) || '—'}</td>
        <td><span class="status-badge ${r.onTime ? 'badge-green' : 'badge-red'}">${r.onTime ? 'On Time' : 'Late'}</span></td>
        <td style="font-size:11px;color:var(--text-muted)">${esc(r.remarks)}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="page-header"><h2>Trucks & On-Deck Performance</h2></div>
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);max-width:600px;margin-bottom:16px">
        <div class="kpi-card"><div class="kpi-label">Total Events</div><div class="kpi-value">${records.length}</div></div>
        <div class="kpi-card green"><div class="kpi-label">On Time</div><div class="kpi-value" style="color:var(--green)">${onTimeCount}</div></div>
        <div class="kpi-card highlight"><div class="kpi-label">On-Time %</div><div class="kpi-value">${onTimePct}%</div></div>
      </div>
      <div class="section-card">
        <table class="data-table" id="trucks-table">
          <thead><tr>
            ${thBtn('date','Date')}${thBtn('cw','CW')}
            ${thBtn('truckNumber','Truck')}${thBtn('driverName','Driver')}
            ${thBtn('shipmentType','Type')}${thBtn('scheduledOnDeck','Scheduled')}
            ${thBtn('actualOnDeck','Actual')}<th>Status</th><th>Remarks</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    container.querySelectorAll('#trucks-table th[data-col]').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const col = th.dataset.col;
        if (_sortCol === col) _sortDir *= -1; else { _sortCol = col; _sortDir = 1; }
        render(container, filters);
      };
    });
  }

  return { render };
})();
