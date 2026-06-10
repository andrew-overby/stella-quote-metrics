import { CONFIG } from './config.js';

// ── Formatting helpers ───────────────────────────────────────────────────────
function fmt(value, format) {
  if (value === null || value === undefined) return 'N/A';
  switch (format) {
    case 'pct':  return value.toFixed(1) + '%';
    case 'days': return value.toFixed(1) + 'd';
    case 'int':  return Math.round(value).toLocaleString();
    default:     return String(value);
  }
}

function fmtDelta(delta) {
  if (delta === null) return '';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

// ── KPI Cards ────────────────────────────────────────────────────────────────
export function renderKPICards(kpis) {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  grid.innerHTML = CONFIG.KPIS.map(({ key, label, format }) => {
    const kpi = kpis[key] || { value: null, delta: null, sentiment: 'neutral' };
    const valueStr = fmt(kpi.value, format);
    const deltaStr = fmtDelta(kpi.delta);
    // Arrow shows actual direction of change; color shows if that's good or bad
    const arrow = (kpi.delta !== null && kpi.delta !== 0)
      ? (kpi.delta > 0 ? '↑' : '↓')
      : '';
    const deltaHTML = deltaStr
      ? `<span class="kpi-delta ${kpi.sentiment}">${arrow}${deltaStr} WoW</span>`
      : '';
    return `
      <div class="kpi-card">
        <span class="kpi-label">${label}</span>
        <span class="kpi-value">${valueStr}</span>
        ${deltaHTML}
      </div>`;
  }).join('');
}

// ── Week / status labels ─────────────────────────────────────────────────────
export function renderWeekLabel(latestWeek, isPartialWeek) {
  const el = document.getElementById('week-label');
  if (!el || !latestWeek) return;
  const [y, m, d] = latestWeek.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  el.textContent = `Week of ${label}`;

  const badge = document.getElementById('partial-week-badge');
  if (badge) {
    badge.innerHTML = isPartialWeek
      ? '<span class="partial-week-badge">Partial Week</span>'
      : '';
  }
}

// ── Status bar ───────────────────────────────────────────────────────────────
export function renderStatusBar(sourceText) {
  const el = document.getElementById('status-source');
  if (el) el.textContent = sourceText;
}

// ── Warning banner ───────────────────────────────────────────────────────────
export function renderWarnings(missingColumns) {
  const banner = document.getElementById('warning-banner');
  const text   = document.getElementById('warning-text');
  if (!banner || !text) return;
  if (missingColumns.length === 0) {
    banner.classList.remove('visible');
  } else {
    text.textContent = `Missing columns in uploaded files: ${missingColumns.join(', ')}`;
    banner.classList.add('visible');
  }
}

// ── Tenant Table ─────────────────────────────────────────────────────────────
let _tenantData = [];
let _sortKey = 'quotesSent';
let _sortDir = -1; // -1 = desc, 1 = asc
let _filterText = '';

export function renderTenantTable(tenantBreakdown) {
  _tenantData = tenantBreakdown;
  _applyTenantTable();

  // Sort headers
  document.querySelectorAll('#tenant-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (_sortKey === key) {
        _sortDir *= -1;
      } else {
        _sortKey = key;
        _sortDir = -1;
      }
      _applyTenantTable();
      _updateSortHeaders();
    });
  });

  // Filter input
  const filterInput = document.getElementById('tenant-filter');
  if (filterInput) {
    filterInput.addEventListener('input', e => {
      _filterText = e.target.value.toLowerCase();
      _applyTenantTable();
    });
  }
}

function _applyTenantTable() {
  const tbody = document.getElementById('tenant-table-body');
  if (!tbody) return;

  let data = _tenantData.filter(row =>
    !_filterText || row.company.toLowerCase().includes(_filterText)
  );

  data.sort((a, b) => {
    const av = a[_sortKey], bv = b[_sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * _sortDir;
    return (av - bv) * _sortDir;
  });

  tbody.innerHTML = data.map(row => {
    const cohortClass = row.cohort === 'May' ? 'badge-may' : 'badge-premay';
    const statusClass = row.status === 'active' ? 'badge-active' : 'badge-inactive';
    const crVal  = row.conversionRate !== null ? row.conversionRate.toFixed(1) + '%' : 'N/A';
    const adpVal = row.stellaAdoption !== null ? row.stellaAdoption.toFixed(1) + '%' : 'N/A';
    const crPct  = row.conversionRate !== null ? row.conversionRate : 0;

    return `<tr>
      <td><strong>${escHtml(row.company)}</strong></td>
      <td><span class="badge ${cohortClass}">${escHtml(row.cohort)}</span></td>
      <td><span class="badge ${statusClass}">${escHtml(row.status)}</span></td>
      <td>${row.quotesSent.toLocaleString()}</td>
      <td>
        <div class="mini-bar-wrap">
          <span style="min-width:42px">${crVal}</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(crPct,100)}%"></div></div>
        </div>
      </td>
      <td>${adpVal}</td>
      <td>${row.idleQuotes.toLocaleString()}</td>
    </tr>`;
  }).join('');
}

function _updateSortHeaders() {
  document.querySelectorAll('#tenant-table th[data-sort]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.sort === _sortKey) {
      th.classList.add(_sortDir === 1 ? 'sort-asc' : 'sort-desc');
      if (icon) icon.textContent = _sortDir === 1 ? '↑' : '↓';
    } else {
      if (icon) icon.textContent = '↕';
    }
  });
}

// ── Cohort Activity ──────────────────────────────────────────────────────────
export function renderCohortGrid(tenantBreakdown) {
  const grid = document.getElementById('cohort-grid');
  if (!grid) return;

  const cohorts = { 'May': [], 'Pre-May': [] };
  tenantBreakdown.forEach(row => {
    const key = row.cohort === 'May' ? 'May' : 'Pre-May';
    cohorts[key].push(row);
  });

  grid.innerHTML = Object.entries(cohorts).map(([cohortName, rows]) => {
    const sorted = [...rows].sort((a, b) => a.company.localeCompare(b.company));
    const rowsHTML = sorted.map(row => {
      const statusClass = row.status === 'active' ? 'badge-active' : 'badge-inactive';
      const qStr = row.quotesSent > 0 ? `${row.quotesSent.toLocaleString()} quotes this week` : 'No activity';
      return `<div class="cohort-row">
        <span class="cohort-company">${escHtml(row.company)}</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="cohort-stats">${qStr}</span>
          <span class="badge ${statusClass}">${row.status}</span>
        </div>
      </div>`;
    }).join('');

    return `<div class="cohort-card">
      <h3>${cohortName === 'May' ? 'May Cohort' : 'Pre-May Cohort'}</h3>
      ${rowsHTML}
    </div>`;
  }).join('');
}

// ── Collapsible sections ─────────────────────────────────────────────────────
export function initCollapsibles() {
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const body = document.getElementById(targetId);
      const toggle = header.querySelector('.section-toggle');
      if (!body) return;
      body.classList.toggle('collapsed');
      if (toggle) toggle.classList.toggle('collapsed');
    });
  });
}

// ── Empty/content state ──────────────────────────────────────────────────────
export function showDashboard(show) {
  const content = document.getElementById('dashboard-content');
  const empty   = document.getElementById('empty-state');
  if (content) content.style.display = show ? '' : 'none';
  if (empty)   empty.classList.toggle('visible', !show);
}

// ── Upload indicator ─────────────────────────────────────────────────────────
export function showUploadIndicator(show) {
  const el = document.getElementById('upload-indicator');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ── CloudWatch breakdown panels ──────────────────────────────────────────────
export function renderDonutPanel(cloudWatchStats) {
  if (!cloudWatchStats || cloudWatchStats.total === 0) return;

  const empty = document.getElementById('donut-empty');
  const hero  = document.getElementById('donut-hero');
  if (empty) empty.style.display = 'none';
  if (hero)  hero.style.display  = 'flex';

  const pct = cloudWatchStats.total > 0
    ? ((cloudWatchStats.continued / cloudWatchStats.total) * 100).toFixed(0)
    : 0;

  const pctEl = document.getElementById('donut-pct');
  if (pctEl) pctEl.textContent = pct + '%';

  const legend = document.getElementById('donut-legend');
  if (legend) {
    legend.innerHTML = `
      <div class="donut-legend-row">
        <div class="legend-dot" style="background:#16a34a"></div>
        <span class="legend-name">Continued</span>
        <span class="legend-count cont-count">${cloudWatchStats.continued}</span>
        <span class="legend-pct">${pct}%</span>
      </div>
      <div class="donut-legend-row">
        <div class="legend-dot" style="background:#dc2626"></div>
        <span class="legend-name">Abandoned</span>
        <span class="legend-count aband-count">${cloudWatchStats.abandoned}</span>
        <span class="legend-pct">${(100 - parseFloat(pct)).toFixed(0)}%</span>
      </div>
      <p style="margin-top:12px; font-size:0.78rem; color:var(--gray-600);">
        ${cloudWatchStats.total} total sessions recorded
      </p>`;
  }
}

export function showDailyChartWrap(show) {
  const empty = document.getElementById('daily-empty');
  const wrap  = document.getElementById('daily-chart-wrap');
  if (empty) empty.style.display = show ? 'none' : 'flex';
  if (wrap)  wrap.style.display  = show ? '' : 'none';
}

// ── Footer ───────────────────────────────────────────────────────────────────
export function renderFooter() {
  const el = document.getElementById('footer-updated');
  if (el) {
    el.textContent = 'Updated ' + new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
