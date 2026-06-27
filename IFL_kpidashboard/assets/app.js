// IFL_kpidashboard/assets/app.js
(function () {
  window.IFL = window.IFL || {};
  window.IFL.pages = window.IFL.pages || {};

  // Shared empty state helper used by all page modules
  window.IFL.pages._emptyState = function(msg) {
    return `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">${msg}</div></div>`;
  };

  const PAGE_MAP = {
    overview: { el: 'page-overview', render: () => IFL.pages.overview },
    regions:  { el: 'page-regions',  render: () => IFL.pages.regions },
    hubs:     { el: 'page-hubs',     render: () => IFL.pages.hubs },
    dealers:  { el: 'page-dealers',  render: () => IFL.pages.dealers },
    trucks:   { el: 'page-trucks',   render: () => IFL.pages.trucks },
    upload:   { el: 'page-upload',   render: () => IFL.pages.upload },
  };

  let currentPage = 'overview';

  function navigateTo(page) {
    if (!PAGE_MAP[page]) return;
    IFL.charts.destroyAll();

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Show/hide page divs
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById(PAGE_MAP[page].el).classList.add('active');

    // Hide filter bar on upload page
    document.getElementById('filter-bar').classList.toggle('hidden', page === 'upload');

    currentPage = page;
    renderCurrentPage();
  }

  function renderCurrentPage() {
    const page = PAGE_MAP[currentPage];
    if (!page) return;
    const container = document.getElementById(page.el);
    const module = page.render();
    if (!module) return;

    if (currentPage === 'upload') {
      module.render(container);
    } else {
      const filters = IFL.filters.getActive();
      module.render(container, filters);
    }
  }

  function init() {
    // Load persisted data from localStorage
    const hadData = IFL.store.load();

    // Init filter state from sessionStorage
    IFL.filters.init();
    if (hadData) {
      IFL.filters.buildUI();
      document.getElementById('data-dot').classList.add('visible');
    } else {
      document.getElementById('filter-bar').classList.add('hidden');
    }

    // Wire sidebar nav clicks
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    // Wire filter changes → re-render current page
    IFL.filters.onChange(() => renderCurrentPage());

    // Expose renderCurrentPage for upload.js to call after parse
    IFL._app = { renderCurrentPage };

    // Initial page: go to Overview if data loaded, else Upload
    if (hadData) {
      navigateTo('overview');
    } else {
      navigateTo('upload');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
