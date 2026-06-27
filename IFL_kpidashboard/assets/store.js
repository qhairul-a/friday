window.IFL = window.IFL || {};
window.IFL.store = (function () {
  const LS_KEY = 'ifl_kpi_data_v1';

  const state = {
    shipments: [],    // combined from file1 + file2
    onDeck: [],
    hubSummaries: [],
    file1Loaded: false,
    file2Loaded: false,
  };

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        shipments: state.shipments,
        onDeck: state.onDeck,
        hubSummaries: state.hubSummaries,
        file1Loaded: state.file1Loaded,
        file2Loaded: state.file2Loaded,
      }));
    } catch(e) { console.warn('localStorage save failed', e); }
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      Object.assign(state, d);
      return true;
    } catch(e) { return false; }
  }

  function clear() {
    Object.assign(state, { shipments: [], onDeck: [], hubSummaries: [], file1Loaded: false, file2Loaded: false });
    localStorage.removeItem(LS_KEY);
  }

  function mergeFile(parsed) {
    if (parsed.fileIndex === 1) {
      // File 1 shipments have hub === null; remove old ones before re-adding
      state.shipments = state.shipments.filter(s => s.hub !== null);
      state.shipments.push(...parsed.shipments);
      state.file1Loaded = true;
    } else {
      // File 2 shipments have hub set; remove old ones before re-adding
      state.shipments = state.shipments.filter(s => s.hub === null);
      state.shipments.push(...parsed.shipments);
      state.onDeck = parsed.onDeck;
      state.hubSummaries = parsed.hubSummaries;
      state.file2Loaded = true;
    }
    save();
  }

  // ── Computed getters ─────────────────────────────────────────────────────────

  function allCws() {
    const set = new Set(state.shipments.map(s => s.cw).filter(Boolean));
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a.replace('CW',''));
      const nb = parseInt(b.replace('CW',''));
      return na - nb;
    });
  }

  function allRegions() {
    return Array.from(new Set(state.shipments.map(s => s.region).filter(Boolean))).sort();
  }

  function allHubs() {
    return Array.from(new Set(state.shipments.map(s => s.hub).filter(Boolean))).sort();
  }

  function allTypes() {
    return Array.from(new Set(state.shipments.map(s => s.shipmentType).filter(Boolean))).sort();
  }

  function filter(filters) {
    let s = state.shipments;
    if (filters.cws && filters.cws.length) s = s.filter(x => filters.cws.includes(x.cw));
    if (filters.regions && filters.regions.length) s = s.filter(x => filters.regions.includes(x.region));
    if (filters.hubs && filters.hubs.length) s = s.filter(x => filters.hubs.includes(x.hub));
    if (filters.types && filters.types.length) s = s.filter(x => filters.types.includes(x.shipmentType));
    return s;
  }

  function aggregate(shipments, useAfter) {
    const total = shipments.length;
    const achieved = shipments.filter(s => useAfter ? s.achievedAfter : s.achievedBefore).length;
    const notAchieved = total - achieved;
    const kpi = total > 0 ? achieved / total : null;
    return { total, achieved, notAchieved, kpi };
  }

  function groupBy(shipments, key) {
    const map = {};
    shipments.forEach(s => {
      const k = s[key] || 'Unknown';
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return map;
  }

  function filterOnDeck(filters) {
    let s = state.onDeck;
    if (filters.cws && filters.cws.length) s = s.filter(x => filters.cws.includes(x.cw));
    if (filters.types && filters.types.length) s = s.filter(x => filters.types.includes(x.shipmentType));
    return s;
  }

  return { state, load, clear, mergeFile, allCws, allRegions, allHubs, allTypes, filter, aggregate, groupBy, filterOnDeck };
})();
