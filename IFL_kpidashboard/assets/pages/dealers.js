// IFL_kpidashboard/assets/pages/dealers.js
window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.dealers = (function () {
  let _sortCol = 'kpi';
  let _sortDir = 1; // 1=asc, -1=desc

  function esc(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(container, filters) {
    const filtered = IFL.store.filter(filters).filter(s => s.dealer);
    if (!filtered.length) {
      container.innerHTML = IFL.pages._emptyState('No dealer data — upload File 2 (Internal Report) to see dealer breakdown.');
      return;
    }

    const useAfter = filters.useAfter;
    const byDealer = IFL.store.groupBy(filtered, 'dealer');
    const dealers = Object.keys(byDealer);

    const rows = dealers.map(d => {
      const agg = IFL.store.aggregate(byDealer[d], useAfter);
      const below = agg.kpi !== null && agg.kpi < IFL.parser.KPI_TARGET;
      return { name: d, ...agg, below };
    });

    rows.sort((a, b) => {
      const va = a[_sortCol] ?? -1, vb = b[_sortCol] ?? -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * _sortDir;
    });

    const belowCount = rows.filter(r => r.below).length;
    const avgKpi = rows.reduce((s, r) => s + (r.kpi || 0), 0) / rows.length;

    function thBtn(col, label) {
      const active = _sortCol === col;
      const arrow = active ? (_sortDir === 1 ? ' ↑' : ' ↓') : '';
      return `<th data-col="${col}">${label}${arrow}</th>`;
    }

    const tableRows = rows.map(r => `
      <tr class="dealer-row" data-dealer="${encodeURIComponent(r.name)}">
        <td>${esc(r.name)}</td>
        <td>${r.total}</td>
        <td style="color:var(--green)">${r.achieved}</td>
        <td style="color:var(--red)">${r.notAchieved}</td>
        <td><span class="status-badge ${r.below ? 'badge-red' : 'badge-green'}">${r.kpi !== null ? (r.kpi*100).toFixed(1)+'%' : '—'}</span></td>
        <td>${r.below ? '✗' : '✓'}</td>
      </tr>
      <tr class="expand-row" id="expand-${encodeURIComponent(r.name)}" style="display:none">
        <td colspan="6"><div class="expand-inner" id="expand-inner-${encodeURIComponent(r.name)}"></div></td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="page-header"><h2>Dealers</h2></div>
      <div class="summary-bar">
        <div class="summary-stat">Total Dealers: <strong>${rows.length}</strong></div>
        <div class="summary-stat">Avg KPI: <strong>${(avgKpi*100).toFixed(1)}%</strong></div>
        <div class="summary-stat danger">Below Target (98.5%): <strong>${belowCount}</strong></div>
      </div>
      <div class="section-card">
        <table class="data-table" id="dealer-table">
          <thead><tr>
            ${thBtn('name','Dealer')}${thBtn('total','Shipments')}
            ${thBtn('achieved','Achieved')}${thBtn('notAchieved','Failed')}
            ${thBtn('kpi','KPI %')}<th>Status</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    // Sort on header click
    container.querySelectorAll('#dealer-table th[data-col]').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const col = th.dataset.col;
        if (_sortCol === col) _sortDir *= -1; else { _sortCol = col; _sortDir = 1; }
        render(container, filters);
      };
    });

    // Expand/collapse dealer detail row on click
    container.querySelectorAll('.dealer-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.onclick = () => {
        const key = row.dataset.dealer;
        const expandRow = document.getElementById(`expand-${key}`);
        const inner = document.getElementById(`expand-inner-${key}`);
        if (expandRow.style.display === 'none') {
          expandRow.style.display = '';
          const dealerName = decodeURIComponent(key);
          inner.innerHTML = dealerDetail(byDealer[dealerName], useAfter);
        } else {
          expandRow.style.display = 'none';
        }
      };
    });
  }

  function dealerDetail(shipments, useAfter) {
    const rows = shipments.map(s => {
      const ok = useAfter ? s.achievedAfter : s.achievedBefore;
      return `<tr>
        <td>${esc(s.date) || '—'}</td>
        <td>${esc(s.cw)}</td>
        <td>${esc(s.vin) || '—'}</td>
        <td>${esc(s.kpiDeadline) || '—'}</td>
        <td>${esc(s.deliveredOn) || '—'}</td>
        <td><span class="status-badge ${ok ? 'badge-green' : 'badge-red'}">${ok ? 'Achieved' : 'Failed'}</span></td>
        <td style="font-size:11px;color:var(--text-muted)">${esc(s.remarks)}</td>
      </tr>`;
    }).join('');
    return `<table class="data-table" style="font-size:12px">
      <thead><tr><th>Date</th><th>CW</th><th>VIN</th><th>KPI Deadline</th><th>Delivered</th><th>Status</th><th>Remarks</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return { render };
})();
