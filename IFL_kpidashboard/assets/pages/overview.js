window.IFL = window.IFL || {};
window.IFL.pages = window.IFL.pages || {};

window.IFL.pages.overview = (function () {
  function render(container, filters) {
    if (!IFL.store.state.file1Loaded && !IFL.store.state.file2Loaded) {
      container.innerHTML = emptyState();
      return;
    }

    const useAfter = filters.useAfter;
    const allCws = IFL.store.allCws();
    const filtered = IFL.store.filter(filters);
    const agg = IFL.store.aggregate(filtered, useAfter);
    const kpiPct = agg.kpi !== null ? agg.kpi : 0;
    const belowTarget = kpiPct < IFL.parser.KPI_TARGET;

    // Build weekly trend data
    const selectedCws = filters.cws.length ? filters.cws : allCws;
    const trendBefore = selectedCws.map(cw => {
      const s = filtered.filter(x => x.cw === cw);
      return s.length ? IFL.store.aggregate(s, false).kpi : null;
    });
    const trendAfter = selectedCws.map(cw => {
      const s = filtered.filter(x => x.cw === cw);
      return s.length ? IFL.store.aggregate(s, true).kpi : null;
    });

    // Region donut
    const byRegion = IFL.store.groupBy(filtered, 'region');
    const regionLabels = Object.keys(byRegion).sort();
    const regionCounts = regionLabels.map(r => byRegion[r].length);

    // Stacked bar
    const stackAchieved = selectedCws.map(cw => {
      const s = filtered.filter(x => x.cw === cw);
      return IFL.store.aggregate(s, useAfter).achieved;
    });
    const stackFailed = selectedCws.map(cw => {
      const s = filtered.filter(x => x.cw === cw);
      return IFL.store.aggregate(s, useAfter).notAchieved;
    });

    container.innerHTML = `
      <div class="page-header">
        <h2>Overview</h2>
        <p>${useAfter ? 'After Investigation' : 'Before Investigation'} — ${filtered.length} shipments across ${selectedCws.length} week(s)</p>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Shipments</div>
          <div class="kpi-value">${agg.total.toLocaleString()}</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Achieved</div>
          <div class="kpi-value" style="color:var(--green)">${agg.achieved.toLocaleString()}</div>
        </div>
        <div class="kpi-card red">
          <div class="kpi-label">Not Achieved</div>
          <div class="kpi-value" style="color:var(--red)">${agg.notAchieved.toLocaleString()}</div>
        </div>
        <div class="kpi-card highlight${belowTarget ? ' below-target' : ''}">
          <div class="kpi-label">KPI Achievement</div>
          <div class="kpi-value">${agg.kpi !== null ? (agg.kpi * 100).toFixed(1) + '%' : '—'}</div>
          <div class="kpi-sub">Target: 98.5% ${belowTarget ? '⚠ Below target' : '✓ On target'}</div>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-title">On-Time Performance</div>
          <div class="gauge-wrap">
            <canvas id="chart-gauge" height="130"></canvas>
            <div class="gauge-center">
              <div class="gauge-pct">${agg.kpi !== null ? (agg.kpi * 100).toFixed(1) + '%' : '—'}</div>
              <div class="gauge-tgt">Target 98.5%</div>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Shipments by Region</div>
          <div class="chart-wrap"><canvas id="chart-donut"></canvas></div>
        </div>
      </div>
      <div class="chart-card" style="margin-bottom:16px">
        <div class="chart-title">Weekly KPI Trend</div>
        <div class="chart-wrap"><canvas id="chart-trend" height="90"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Achieved vs Not Achieved by Week</div>
        <div class="chart-wrap"><canvas id="chart-stacked" height="90"></canvas></div>
      </div>`;

    // Render charts after DOM is painted
    requestAnimationFrame(() => {
      IFL.charts.gauge('chart-gauge', kpiPct, IFL.parser.KPI_TARGET);
      IFL.charts.regionDonut('chart-donut', regionLabels, regionCounts);
      IFL.charts.kpiTrend('chart-trend', selectedCws, trendBefore, trendAfter);
      IFL.charts.stackedBar('chart-stacked', selectedCws, stackAchieved, stackFailed);
    });
  }

  function emptyState() {
    return `<div class="empty-state">
      <div class="empty-icon">📂</div>
      <div class="empty-text">No data loaded yet.<br>Go to <strong>Upload Data</strong> to load your Excel files.</div>
    </div>`;
  }

  return { render };
})();
