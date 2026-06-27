window.IFL = window.IFL || {};

window.IFL.filters = (function () {
  const SS_KEY = 'ifl_filters_v1';

  const state = {
    cwMin: 0,
    cwMax: 0,
    regions: [],   // empty = all
    hubs: [],
    types: [],
    useAfter: false,
  };

  const listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function _notify() { listeners.forEach(fn => fn(getActive())); }

  function getActive() {
    const allCws = IFL.store.allCws();
    const selectedCws = allCws.filter((_, i) => i >= state.cwMin && i <= state.cwMax);
    return {
      cws: selectedCws,
      regions: state.regions,
      hubs: state.hubs,
      types: state.types,
      useAfter: state.useAfter,
    };
  }

  function init() {
    // Restore from sessionStorage
    try {
      const saved = sessionStorage.getItem(SS_KEY);
      if (saved) Object.assign(state, JSON.parse(saved));
    } catch(e) {}
  }

  function _persist() {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function buildUI() {
    const allCws = IFL.store.allCws();
    const maxIdx = Math.max(0, allCws.length - 1);

    // Clamp stored indices to new range; always expand max to cover new data
    state.cwMin = Math.min(state.cwMin, maxIdx);
    if (state.cwMax === 0 || state.cwMax > maxIdx) state.cwMax = maxIdx;

    // CW sliders
    const slMin = document.getElementById('cw-min');
    const slMax = document.getElementById('cw-max');
    slMin.max = maxIdx; slMin.value = state.cwMin;
    slMax.max = maxIdx; slMax.value = state.cwMax;
    document.getElementById('cw-min-label').textContent = allCws[state.cwMin] || '—';
    document.getElementById('cw-max-label').textContent = allCws[state.cwMax] || '—';

    // Assign directly (replaces previous handler — no listener accumulation)
    slMin.oninput = () => {
      state.cwMin = Math.min(parseInt(slMin.value), state.cwMax);
      slMin.value = state.cwMin;
      document.getElementById('cw-min-label').textContent = allCws[state.cwMin] || '—';
      _persist(); _notify();
    };
    slMax.oninput = () => {
      state.cwMax = Math.max(parseInt(slMax.value), state.cwMin);
      slMax.value = state.cwMax;
      document.getElementById('cw-max-label').textContent = allCws[state.cwMax] || '—';
      _persist(); _notify();
    };

    // Region chips
    _buildChips('region-chips', IFL.store.allRegions(), state.regions,
      (v, active) => { _toggleArr(state.regions, v, active); _persist(); _notify(); });

    // Hub chips
    _buildChips('hub-chips', IFL.store.allHubs(), state.hubs,
      (v, active) => { _toggleArr(state.hubs, v, active); _persist(); _notify(); });

    // Type chips
    _buildChips('type-chips', IFL.store.allTypes(), state.types,
      (v, active) => { _toggleArr(state.types, v, active); _persist(); _notify(); });

    // Before/After toggle
    document.getElementById('inv-before').onclick = () => {
      state.useAfter = false; _setInvToggle(); _persist(); _notify();
    };
    document.getElementById('inv-after').onclick = () => {
      state.useAfter = true; _setInvToggle(); _persist(); _notify();
    };
    _setInvToggle();
  }

  function _setInvToggle() {
    document.getElementById('inv-before').classList.toggle('active', !state.useAfter);
    document.getElementById('inv-after').classList.toggle('active', state.useAfter);
  }

  function _buildChips(containerId, values, selected, onToggle) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (values.length === 0) {
      el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">—</span>';
      return;
    }
    values.forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (selected.includes(v) ? ' active' : '');
      chip.textContent = v;
      chip.style.marginRight = '4px';
      chip.onclick = () => {
        chip.classList.toggle('active');
        onToggle(v, chip.classList.contains('active'));
      };
      el.appendChild(chip);
    });
  }

  function _toggleArr(arr, v, add) {
    const idx = arr.indexOf(v);
    if (add && idx === -1) arr.push(v);
    if (!add && idx > -1) arr.splice(idx, 1);
  }

  return { init, buildUI, getActive, onChange };
})();
