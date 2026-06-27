// IFL_kpidashboard/assets/pages/hubs.js
window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.hubs = (function () {
  function render(container, filters) {
    const filtered = IFL.store.filter(filters);
    const withHub = filtered.filter(s => s.hub);
    if (!withHub.length) {
      container.innerHTML = IFL.pages._emptyState('No hub data — upload File 2 (Internal Report) to see hub breakdown.');
      return;
    }

    const useAfter = filters.useAfter;
    const byHub = IFL.store.groupBy(withHub, 'hub');
    const hubs = Object.keys(byHub).sort();
    const allCws = filters.cws.length ? filters.cws : IFL.store.allCws();

    const cards = hubs.map((h, i) => {
      const agg = IFL.store.aggregate(byHub[h], useAfter);
      const below = agg.kpi !== null && agg.kpi < IFL.parser.KPI_TARGET;
      return `
        <div class="region-card">
          <div class="region-name" style="font-size:10px">${h}</div>
          <div class="region-kpi${below ? ' below' : ''}">${agg.kpi !== null ? (agg.kpi*100).toFixed(1)+'%' : '—'}</div>
          <div class="region-ships">${agg.total} shipments</div>
          <canvas id="spark-hub-${i}" height="40" style="margin-top:8px"></canvas>
        </div>`;
    }).join('');

    const tableRows = hubs.flatMap(h =>
      allCws.map(cw => {
        const s = byHub[h] ? byHub[h].filter(x => x.cw === cw) : [];
        if (!s.length) return '';
        const agg = IFL.store.aggregate(s, useAfter);
        const below = agg.kpi !== null && agg.kpi < IFL.parser.KPI_TARGET;
        return `<tr>
          <td>${h}</td><td>${cw}</td><td>${agg.total}</td>
          <td style="color:var(--green)">${agg.achieved}</td>
          <td style="color:var(--red)">${agg.notAchieved}</td>
          <td><span class="status-badge ${below ? 'badge-red' : 'badge-green'}">${agg.kpi !== null ? (agg.kpi*100).toFixed(1)+'%' : '—'}</span></td>
        </tr>`;
      }).join('')
    );

    const beforePct = hubs.map(h => IFL.store.aggregate(byHub[h], false).kpi || 0);
    const afterPct  = hubs.map(h => IFL.store.aggregate(byHub[h], true).kpi || 0);

    container.innerHTML = `
      <div class="page-header"><h2>By Hub</h2></div>
      <div class="region-grid">${cards}</div>
      <div class="chart-card" style="margin-bottom:16px">
        <div class="chart-title">KPI % by Hub (Before vs After Investigation)</div>
        <canvas id="chart-hub-bar" height="80"></canvas>
      </div>
      <div class="section-card">
        <table class="data-table">
          <thead><tr><th>Hub</th><th>CW</th><th>Shipments</th><th>Achieved</th><th>Failed</th><th>KPI %</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    requestAnimationFrame(() => {
      IFL.charts.regionBar('chart-hub-bar', hubs, beforePct, afterPct);
      hubs.forEach((h, i) => {
        const sparkData = allCws.map(cw => {
          const s = byHub[h] ? byHub[h].filter(x => x.cw === cw) : [];
          return s.length ? IFL.store.aggregate(s, useAfter).kpi || 0 : null;
        }).filter(v => v !== null);
        if (sparkData.length) IFL.charts.sparkline(`spark-hub-${i}`, sparkData);
      });
    });
  }

  return { render };
})();
