import { CONFIG } from './config.js';
import { parseByFilename } from './parsers.js';
import { computeMetrics } from './metrics.js';
import {
  renderKPICards, renderWeekLabel, renderStatusBar, renderWarnings,
  renderTenantTable, renderCohortGrid, renderDonutPanel, showDailyChartWrap,
  initCollapsibles, showDashboard, showUploadIndicator, renderFooter,
} from './ui.js';
import {
  buildConversionChart, buildAdoptionChart, buildActiveUsersChart,
  buildIdleQuotesChart, buildTTQChart, buildDeficiencyChart,
  buildDonutChart, buildDailyChart, destroyChart,
} from './charts.js';

// ── State ────────────────────────────────────────────────────────────────────
let chartInstances = {};
let isUploadedData = false;
let currentTimeSeries = null;

// ── Entry point ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initCollapsibles();
  initUploadPanel();
  renderFooter();

  if (location.protocol === 'file:') {
    showDashboard(false);
    renderStatusBar('⚠️  Run via npx serve . — file:// protocol blocks data loading');
    document.getElementById('empty-state').innerHTML = `
      <h2>Run via Local Server</h2>
      <p>Open your terminal in this folder and run:</p>
      <p style="margin-top:12px; font-family:monospace; font-size:1rem; background:#f3f4f6; display:inline-block; padding:8px 16px; border-radius:6px;">npx serve .</p>
      <p style="margin-top:12px; font-size:0.82rem; color:#9ca3af;">Then open <strong>http://localhost:3000</strong> in your browser.</p>`;
    document.getElementById('empty-state').classList.add('visible');
    return;
  }

  renderStatusBar('Loading data…');
  const appData = await loadDataFiles();
  renderDashboard(appData);
});

// ── Load CSV files from /data/ ────────────────────────────────────────────────
async function loadDataFiles() {
  const filePrefixes = [
    'Conversion_Rate',
    'Idle_Quotes',
    'Quotes_per_User',
    'Time_to_Quote',
  ];

  // Discover files by trying to fetch a manifest or by naming convention.
  // We fetch data/files.json first (optional manifest), falling back to
  // trying each expected prefix with a known date.
  let fileList = [];

  try {
    const manifestRes = await fetch(`${CONFIG.DATA_FOLDER}files.json`);
    if (manifestRes.ok) {
      fileList = await manifestRes.json();
    }
  } catch { /* no manifest — use discovery */ }

  if (fileList.length === 0) {
    // Try to discover files by fetching a directory listing isn't possible in static serving.
    // Instead, try sample/ folder and then data/ using a fixed naming approach.
    fileList = await discoverFiles(filePrefixes);
  }

  return await fetchAndParse(fileList);
}

async function discoverFiles(prefixes) {
  // Try data/ first, then data/sample/ as fallback
  const folders = [CONFIG.DATA_FOLDER, `${CONFIG.DATA_FOLDER}sample/`];
  const found = [];

  for (const folder of folders) {
    for (const prefix of prefixes) {
      // Try fetching a listing — not possible; instead check for a sentinel index file
      // We rely on files.json or direct filename knowledge.
      // Attempt the most recent known filenames from the real exports
      const candidates = [
        `${prefix}_2026-06-08.csv`,
        `${prefix.replace(/_/g, ' ')}_2026-06-08.csv`,
      ];
      for (const name of candidates) {
        try {
          const res = await fetch(folder + name, { method: 'HEAD' });
          if (res.ok) {
            found.push({ folder, name });
            break;
          }
        } catch { /* not found */ }
      }
    }
    if (found.length > 0) break; // stop at first folder that has files
  }

  return found;
}

async function fetchAndParse(fileList) {
  const appData = { conversionRate: null, idleQuotes: null, quotesPerUser: null, timeToQuote: null, cloudWatch: null };
  const allMissing = [];
  const loadedNames = [];

  for (const file of fileList) {
    const folder = file.folder || CONFIG.DATA_FOLDER;
    const url = folder + file.name;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const result = parseByFilename(file.name, text);
      if (!result) continue;
      if (result.type === 'cloudWatch') {
        appData.cloudWatch = (appData.cloudWatch || []).concat(result.rows);
      } else {
        appData[result.type] = (appData[result.type] || []).concat(result.rows);
      }
      allMissing.push(...result.missingFields);
      loadedNames.push(file.name);
    } catch { /* skip */ }
  }

  appData._loadedNames = loadedNames;
  appData._missingColumns = [...new Set(allMissing)];
  return appData;
}

// ── Render pipeline ───────────────────────────────────────────────────────────
function renderDashboard(appData) {
  const hasAnyData = appData.conversionRate || appData.idleQuotes ||
                     appData.quotesPerUser  || appData.timeToQuote;

  if (!hasAnyData) {
    showDashboard(false);
    renderStatusBar('No data files found — upload files to get started');
    return;
  }

  showDashboard(true);
  renderWarnings(appData._missingColumns || []);

  const computed = computeMetrics(appData);
  currentTimeSeries = computed.timeSeries;

  renderKPICards(computed.kpis);
  renderWeekLabel(computed.latestWeek, computed.warnings.isPartialWeek);
  renderTenantTable(computed.tenantBreakdown);
  renderCohortGrid(computed.tenantBreakdown);

  const weeksToShow = document.getElementById('week-range-select')?.value || '8';
  buildAllCharts(computed.timeSeries, weeksToShow);

  if (computed.cloudWatchStats) {
    renderDonutPanel(computed.cloudWatchStats);
    showDailyChartWrap(true);
    destroyChart(chartInstances.donut);
    destroyChart(chartInstances.daily);
    chartInstances.donut = buildDonutChart(computed.cloudWatchStats);
    chartInstances.daily = buildDailyChart(computed.cloudWatchStats);
  }

  // Status bar
  const names = appData._loadedNames || [];
  const sourceLabel = isUploadedData
    ? `Uploaded: ${names.join(', ')}`
    : `Data: ${names.length} file(s) loaded · ${names.join(', ')}`;
  renderStatusBar(sourceLabel);

  showUploadIndicator(isUploadedData);
}

function buildAllCharts(timeSeries, weeksToShow) {
  // Destroy before rebuild to avoid canvas orphan warnings
  ['conversion','adoption','activeUsers','idleQuotes','ttq','deficiency'].forEach(k => {
    destroyChart(chartInstances[k]);
  });

  chartInstances.conversion  = buildConversionChart(timeSeries, weeksToShow);
  chartInstances.adoption    = buildAdoptionChart(timeSeries, weeksToShow);
  chartInstances.activeUsers = buildActiveUsersChart(timeSeries, weeksToShow);
  chartInstances.idleQuotes  = buildIdleQuotesChart(timeSeries, weeksToShow);
  chartInstances.ttq         = buildTTQChart(timeSeries, weeksToShow);
  chartInstances.deficiency  = buildDeficiencyChart(timeSeries, weeksToShow);
}

// ── Week range toggle ─────────────────────────────────────────────────────────
document.addEventListener('change', e => {
  if (e.target.id === 'week-range-select' && currentTimeSeries) {
    buildAllCharts(currentTimeSeries, e.target.value);
  }
});

// ── Upload panel ──────────────────────────────────────────────────────────────
function initUploadPanel() {
  const toggleBtn = document.getElementById('upload-toggle-btn');
  const panel     = document.getElementById('upload-panel');
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const clearBtn  = document.getElementById('clear-upload-btn');

  toggleBtn?.addEventListener('click', () => {
    panel?.classList.toggle('open');
  });

  clearBtn?.addEventListener('click', () => {
    location.reload();
  });

  // Drag-and-drop
  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  fileInput?.addEventListener('change', e => {
    handleFiles(Array.from(e.target.files));
    e.target.value = ''; // reset so same file can be re-uploaded
  });
}

async function handleFiles(files) {
  const appData = { conversionRate: null, idleQuotes: null, quotesPerUser: null, timeToQuote: null, cloudWatch: null };
  const allMissing = [];
  const loadedNames = [];

  for (const file of files) {
    const text = await file.text();
    const result = parseByFilename(file.name, text);
    if (!result) {
      console.warn('Unrecognized file:', file.name);
      continue;
    }
    if (result.type === 'cloudWatch') {
      appData.cloudWatch = (appData.cloudWatch || []).concat(result.rows);
    } else {
      appData[result.type] = (appData[result.type] || []).concat(result.rows);
    }
    allMissing.push(...result.missingFields);
    loadedNames.push(file.name);
  }

  if (loadedNames.length === 0) return;

  appData._loadedNames    = loadedNames;
  appData._missingColumns = [...new Set(allMissing)];
  isUploadedData = true;

  // Close panel
  document.getElementById('upload-panel')?.classList.remove('open');

  renderDashboard(appData);
}
