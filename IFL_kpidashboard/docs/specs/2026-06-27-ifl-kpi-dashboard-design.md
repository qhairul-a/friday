# IFL KPI Dashboard — Design Spec
**Date:** 2026-06-27
**Status:** Approved for implementation

---

## Context

IFL's business management team currently reviews BMW vehicle delivery KPI performance from raw Excel files. The goal is a clean, browser-based dashboard that lets the team load those files and immediately see performance metrics, trends, and drill-downs — without needing a server, an install, or technical knowledge. The dashboard is designed as an extensible foundation: current data is BMW delivery KPIs, but the architecture must accommodate additional data types (freight/cargo, DG, duty payment) in future iterations.

---

## Architecture

**Type:** Static single-page app. No server. No build step. Open `index.html` in any modern browser.

**Tech stack:**
- `SheetJS (xlsx.min.js)` — parse Excel files client-side
- `Chart.js (chart.min.js)` — all charts and gauges
- Vanilla HTML/CSS/JS — no React, no framework, no bundler

**File layout (all inside `IFL_kpidashboard/`):**
```
index.html
assets/
  xlsx.min.js       ← vendored (no CDN dependency)
  chart.min.js      ← vendored
  style.css
  app.js
docs/
  specs/
    2026-06-27-ifl-kpi-dashboard-design.md
raw/
  05 - IFL BMW KPI REPORT May 2026.xlsx
  IFL BMW Delivery Performance Report 2026 - INTERNAL.xlsx
```

**Data persistence:** After upload, parsed data is stored in `localStorage` so it survives page refresh. A "Clear Data" option in the Upload page resets the session.

---

## Data Model

### Source Files

**File 1 — `05 - IFL BMW KPI REPORT May 2026.xlsx`**

| Sheet | Extracted Fields |
|-------|-----------------|
| KPI Summary Report | CW, date range, region (CZ/KD, SG, MY, THAI), shipments total, achieved (before inv.), not achieved (before inv.), KPI% (before inv.), achieved (after inv.), not achieved (after inv.), KPI% (after inv.) |
| CZ / SG / MY / THAI | Row per shipment: CW, date, shipment type, truck number, KPI deadline, delivered on, pass/fail, remarks, after-investigation result |

**File 2 — `IFL BMW Delivery Performance Report 2026 - INTERNAL.xlsx`**

| Sheet | Extracted Fields |
|-------|-----------------|
| KPI Report (summary) | CW, hub name, shipments, achieved, not achieved, KPI% — covering CW14–CW26 |
| CW14–CW26 sheets | Dealer name, collection date, VIN, KPI deadline time, actual delivery time, pass/fail, remarks |
| On Deck Timings (CW X) | Date, shipment type, truck number, driver name, scheduled on-deck time, actual on-deck time, on-time/late, remarks |

### Unified In-Memory Data Model

After parsing, app.js normalises both files into three arrays:

```js
shipments[]     // one record per shipment row
onDeck[]        // one record per truck on-deck event
kpiSummary[]    // weekly aggregates by region/hub
```

All filter operations run against these arrays in memory — no re-parsing required after initial upload.

---

## Filters

Global filter bar sits at the top of every page (except Upload).

| Filter | Values | Notes |
|--------|--------|-------|
| Calendar Week range | CW14 – CW26 (dual-handle slider + label) | Both ends adjustable |
| Region | All / SG / MY / CZ / THAI | Multi-select chips |
| Hub | All / JB Hub SG / JB Hub CZ / JB Hub South / KL Hub Central | Multi-select chips |
| Shipment Type | All / SGAM / SGPM / CZAM / CZPM / MY | Multi-select chips |
| Investigation | Before / After (pill toggle) | Switches which KPI% column is active across all charts and cards |
| DG | — | Rendered greyed-out with "Coming soon" tooltip; wired to no data |
| Duty Payment | — | Same as DG |

Filters are sticky per session (saved to `sessionStorage`). Changing any filter re-renders all visible charts immediately without page reload.

---

## Page Structure

### Sidebar

Left sidebar, fixed width (220px), collapsible to icon-only (56px) on narrow screens.

- **IFL logo / wordmark** at top
- Nav items: Overview · By Region · By Hub · Dealers · Trucks & On-Deck · Upload
- Active page highlighted in navy
- Upload icon shows a green dot when data is loaded

---

### Page 1 — Overview *(default)*

**KPI Cards (row of 4):**
| Card | Metric | Colour |
|------|--------|--------|
| Total Shipments | Count | Navy |
| Achieved | Count | Green |
| Not Achieved | Count | Red |
| KPI Achievement | % with 98.5% target indicator | Navy (red if below target) |

**OTP Gauge:** Semicircle gauge (0–100%) with needle at current KPI%, colour zones: red 0–90%, amber 90–98.5%, green 98.5–100%. Target marker at 98.5%.

**Charts (2-column grid below cards):**
- **Left — Weekly KPI Trend (line chart):** X-axis = CW, Y-axis = KPI%. Shows Before and After Investigation as two lines. 98.5% target shown as a dashed horizontal reference line.
- **Right — Shipments by Region (donut chart):** Segments for SG, MY, CZ, THAI. Clicking a segment filters the page to that region.

**Bottom — Achieved vs Not Achieved by Week (stacked bar chart):** Full width. Each bar = one CW, stacked: green (achieved) + red (not achieved). Useful for spotting problem weeks.

---

### Page 2 — By Region

**Cards:** One card per region (SG, MY, CZ, THAI). Each shows: total shipments, KPI%, small sparkline trend (last 4 CW).

**Bar chart:** KPI% by region, side-by-side for Before/After Investigation. Dashed 98.5% target line across the chart.

**Table:** Region | CW | Shipments | Achieved | Not Achieved | KPI% — sortable, filterable.

---

### Page 3 — By Hub

Same layout as By Region, scoped to hub level (JB Hub SG, JB Hub CZ/KD, JB Hub South, KL Hub Central).

---

### Page 4 — Dealers

**Summary bar:** Total dealers | Average KPI% | Dealers below target (count, highlighted red).

**Sortable table columns:** Dealer Name | Shipments | Achieved | Failed | KPI% | Status (✓ / ✗ vs 98.5% target)

Clicking a dealer row expands an inline detail panel: list of individual shipments with date, VIN, scheduled time, actual time, pass/fail, remarks.

---

### Page 5 — Trucks & On-Deck

**Summary card:** % of trucks arriving on-deck on time.

**Sortable table columns:** Date | CW | Truck No. | Driver | Shipment Type | Scheduled | Actual | Status | Remarks

Rows colour-coded: green = on time, red = late.

---

### Page 6 — Upload

**Two upload zones** (one per file), each supporting:
- Drag & drop
- Click-to-browse
- Visual feedback: file name shown, row count parsed, any unrecognised sheets listed as warnings

**Validation rules:**
- Checks that expected sheet names exist (KPI Summary Report, CZ, SG, MY, THAI for File 1; KPI Report, On Deck Timings for File 2)
- Shows a green "Loaded" badge when valid, red "Error" badge with description if invalid

**"Clear & Re-upload" button** — wipes localStorage and resets dashboard to empty state.

---

## Visual Design

- **Theme:** Light background (#f0f4ff), navy accent (#1e40af)
- **Typography:** System font stack (no Google Fonts dependency — works offline)
- **KPI target line colour:** Amber (#f59e0b) on charts, ensuring it's distinct from data lines
- **Status colours:** Green (#10b981) = achieved/on-time, Red (#ef4444) = failed/late, Amber (#f59e0b) = warning/approaching target
- **Responsive breakpoints:** 1280px+ (full sidebar), 768–1280px (icon sidebar), <768px (hamburger menu)

---

## Extensibility

To add a new data source in future:
1. Add a new upload zone in the Upload page for the new file
2. Add a parser function in `app.js` that maps columns to the unified data model
3. Add new filter chips (DG, Duty Payment) which are already rendered as placeholders

No changes required to existing pages or charts.

---

## Verification

End-to-end test plan:
1. Open `index.html` in Chrome/Edge — Upload page should show with empty state
2. Upload File 1 only — Overview should populate with May 2026 data; File 2 sections (hub breakdown, dealers, trucks) should show "No data loaded" placeholders
3. Upload File 2 — All pages should populate; hub and dealer pages should have data
4. Test each filter: change CW range, toggle region, switch Before/After Investigation — all charts must update immediately
5. Verify 98.5% target line appears on all KPI% charts
6. Refresh page — data should persist from localStorage
7. Use "Clear & Re-upload" — dashboard should return to empty state
8. Test in Edge and Chrome (primary browsers for Windows business users)
