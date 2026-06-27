// IFL_kpidashboard/assets/pages/regions.js
window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.regions = (function () {
  function render(container, filters) {
    const filtered = IFL.store.filter(filters);
    if (!filtered.length) {
      container.innerHTML = IFL.pages._emptyState('No shipment data for selected filters.');
      return;
    }

    const useAfter = filters.useAfter;
    const byRegion = IFL.store.groupBy(filtered, 'region');
    const regions = Object.keys(byRegion).sort();
    const allCws = filters.cws.length ? filters.cws : IFL.store.allCws();

    // Region summary cards
    const cards = regions.map((r, i) => {
      const agg = IFL.store.aggregate(byRegion[r], useAfter);
      const below = agg.kpi !== null && agg.kpi < IFL.parser.KPI_TARGET;
      return `
        <div class="region-card">
          <div class="region-name">${r}</div>
          <div class="region-kpi${below ? ' below' : ''}">${agg.kpi !== null ? (agg.kpi*100).toFixed(1)+'%' : '—'}</div>
          <div class="region-ships">${agg.total} shipments</div>
          <canvas id="spark-region-${i}" height="40" style="margin-top:8px"></canvas>
        </div>`;
    }).join('');

    // Summary table rows: one row per region per CW
    const tableRows = regions.flatMap(r =>
      allCws.map(cw => {
        const s = byRegion[r] ? byRegion[r].filter(x => x.cw === cw) : [];
        if (!s.length) return '';
        const agg = IFL.store.aggregate(s, useAfter);
        const below = agg.kpi !== null && agg.kpi < IFL.parser.KPI_TARGET;
        return `<tr>
          <td>${r}</td><td>${cw}</td><td>${agg.total}</td>
          <td style="color:var(--green)">${agg.achieved}</td>
          <td style="color:var(--red)">${agg.notAchieved}</td>
          <td><span class="status-badge ${below ? 'badge-red' : 'badge-green'}">${agg.kpi !== null ? (agg.kpi*100).toFixed(1)+'%' : '—'}</span></td>
        </tr>`;
      }).join('')
    );

    const beforePct = regions.map(r => IFL.store.aggregate(byRegion[r], false).kpi || 0);
    const afterPct  = regions.map(r => IFL.store.aggregate(byRegion[r], true).kpi || 0);

    container.innerHTML = `
      <div class="page-header"><h2>By Region</h2></div>
      <div class="region-grid">${cards}</div>
      <div class="chart-card" style="margin-bottom:16px">
        <div class="chart-title">KPI % by Region (Before vs After Investigation)</div>
        <canvas id="chart-region-bar" height="80"></canvas>
      </div>
      <div class="section-card">
        <table class="data-table">
          <thead><tr><th>Region</th><th>CW</th><th>Shipments</th><th>Achieved</th><th>Failed</th><th>KPI %</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    requestAnimationFrame(() => {
      IFL.charts.regionBar('chart-region-bar', regions, beforePct, afterPct);
      regions.forEach((r, i) => {
        const sparkData = allCws.map(cw => {
          const s = byRegion[r] ? byRegion[r].filter(x => x.cw === cw) : [];
          return s.length ? IFL.store.aggregate(s, useAfter).kpi || 0 : null;
        }).filter(v => v !== null);
        if (sparkData.length) IFL.charts.sparkline(`spark-region-${i}`, sparkData);
      });
    });
  }

  return { render };
})();
