// IFL_kpidashboard/assets/charts.js
window.IFL = window.IFL || {};

window.IFL.charts = (function () {
  const instances = {};
  const NAVY = '#1e40af';
  const GREEN = '#10b981';
  const RED = '#ef4444';
  const AMBER = '#f59e0b';
  const REGION_COLORS = { SG: '#1e40af', MY: '#10b981', CZ: '#f59e0b', THAI: '#ef4444', Unknown: '#94a3b8' };

  function _destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  // Half-doughnut gauge: 0–90% red, 90–98.5% amber, 98.5–100% green
  function gauge(canvasId, pct, target) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const val = Math.max(0, Math.min(100, (pct || 0) * 100));
    const tgt = (target || 0.985) * 100;
    const zoneRed   = Math.min(val, 90);
    const zoneAmber = val > 90 ? Math.min(val, tgt) - 90 : 0;
    const zoneGreen = val > tgt ? val - tgt : 0;
    const empty = 100 - val;

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [zoneRed, zoneAmber, zoneGreen, empty],
          backgroundColor: [RED, AMBER, GREEN, '#e5e7eb'],
          borderWidth: 0,
        }]
      },
      options: {
        rotation: -90, circumference: 180, cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 600 }
      }
    });
  }

  // Line chart: Before/After Investigation lines + amber dashed target
  function kpiTrend(canvasId, cwLabels, beforeData, afterData) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const target = IFL.parser.KPI_TARGET * 100;
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: cwLabels,
        datasets: [
          { label: 'Before Investigation', data: beforeData.map(v => v !== null ? +(v*100).toFixed(1) : null),
            borderColor: NAVY, backgroundColor: NAVY+'22', tension: 0.3, fill: false, pointRadius: 4 },
          { label: 'After Investigation', data: afterData.map(v => v !== null ? +(v*100).toFixed(1) : null),
            borderColor: GREEN, backgroundColor: GREEN+'22', tension: 0.3, fill: false, pointRadius: 4, borderDash: [4,3] },
          { label: 'Target (98.5%)', data: cwLabels.map(() => target),
            borderColor: AMBER, borderDash: [6, 4], borderWidth: 1.5,
            pointRadius: 0, fill: false },
        ]
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
        animation: { duration: 400 }
      }
    });
  }

  // Donut: region distribution
  function regionDonut(canvasId, labels, counts) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: counts, backgroundColor: labels.map(l => REGION_COLORS[l] || '#94a3b8'), borderWidth: 2 }]
      },
      options: {
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
        animation: { duration: 400 }
      }
    });
  }

  // Stacked bar: achieved (green) + not achieved (red) per CW
  function stackedBar(canvasId, labels, achievedData, failedData) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Achieved', data: achievedData, backgroundColor: GREEN + 'cc', stack: 'a' },
          { label: 'Not Achieved', data: failedData, backgroundColor: RED + 'cc', stack: 'a' },
        ]
      },
      options: {
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: '#f1f5f9' } }
        },
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
        animation: { duration: 400 }
      }
    });
  }

  // Grouped bar (Before + After) with amber dashed target line as mixed line dataset
  function regionBar(canvasId, labels, beforePct, afterPct) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const target = IFL.parser.KPI_TARGET * 100;
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Before Investigation', data: beforePct.map(v => +(v*100).toFixed(1)), backgroundColor: NAVY + 'bb', order: 2 },
          { label: 'After Investigation',  data: afterPct.map(v => +(v*100).toFixed(1)),  backgroundColor: GREEN + 'bb', order: 2 },
          { label: 'Target (98.5%)', type: 'line',
            data: labels.map(() => target),
            borderColor: AMBER, borderDash: [6, 4], borderWidth: 2,
            pointRadius: 0, fill: false, order: 1 },
        ]
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
        animation: { duration: 400 }
      }
    });
  }

  // Minimal sparkline for region/hub cards
  function sparkline(canvasId, data, color) {
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{ data: data.map(v => +(v*100).toFixed(1)), borderColor: color || NAVY,
          borderWidth: 2, pointRadius: 0, fill: false, tension: 0.4 }]
      },
      options: {
        scales: { x: { display: false }, y: { display: false } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 300 }
      }
    });
  }

  function destroyAll() {
    Object.keys(instances).forEach(_destroy);
  }

  return { gauge, kpiTrend, regionDonut, stackedBar, regionBar, sparkline, destroyAll };
})();
