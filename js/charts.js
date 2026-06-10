import { CONFIG } from './config.js';

const [C1, C2, C3, C4] = CONFIG.CHART_COLORS; // #0A3047, #286382, #87BFD9, #F26417

// Shared Chart.js defaults applied to every chart
const BASE_FONT = "'Montserrat', Arial, sans-serif";

function weekTooltipTitle(items) {
  const label = items[0]?.label;
  if (!label) return '';
  // label is already "Jun 2" style from metrics.weekLabel — prefix "Week of"
  return `Week of ${label}`;
}

function pctTooltipLabel(ctx) {
  return ` ${ctx.dataset.label || ctx.label}: ${ctx.parsed.y !== undefined ? ctx.parsed.y.toFixed(1) + '%' : ctx.formattedValue}`;
}

function numTooltipLabel(ctx) {
  return ` ${ctx.dataset.label || ctx.label}: ${ctx.parsed.y !== undefined ? ctx.parsed.y.toFixed(1) : ctx.formattedValue}`;
}

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0A3047',
      titleFont: { family: BASE_FONT, size: 11, weight: '600' },
      bodyFont:  { family: BASE_FONT, size: 12 },
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: BASE_FONT, size: 10 }, color: '#9ca3af' },
    },
    y: {
      grid: { color: '#f3f4f6' },
      ticks: { font: { family: BASE_FONT, size: 10 }, color: '#9ca3af' },
    },
  },
};

function sliceSeries(series, weeksToShow) {
  if (weeksToShow === 'all') return series;
  const n = parseInt(weeksToShow, 10);
  return series.slice(-n);
}

function getCtx(canvasId) {
  const el = document.getElementById(canvasId);
  return el ? el.getContext('2d') : null;
}

// ── Line chart (pct) ─────────────────────────────────────────────────────────
function buildLineChart(canvasId, series, color, labelFn, titleFn) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: series.map(p => p.label),
      datasets: [{
        data: series.map(p => p.value),
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: { title: titleFn || weekTooltipTitle, label: labelFn || numTooltipLabel },
        },
      },
    },
  });
}

// ── Bar chart ────────────────────────────────────────────────────────────────
function buildBarChart(canvasId, series, color, labelFn) {
  const ctx = getCtx(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: series.map(p => p.label),
      datasets: [{
        data: series.map(p => p.value),
        backgroundColor: color + 'cc',
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: { title: weekTooltipTitle, label: labelFn || numTooltipLabel },
        },
      },
    },
  });
}

// ── Public chart builders ────────────────────────────────────────────────────

export function buildConversionChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.conversionRate || [], weeksToShow);
  return buildLineChart('chart-conversion', s, C1, pctTooltipLabel);
}

export function buildAdoptionChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.stellaAdoption || [], weeksToShow);
  return buildLineChart('chart-adoption', s, C2, pctTooltipLabel);
}

export function buildActiveUsersChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.activeUsers || [], weeksToShow);
  return buildBarChart('chart-active-users', s, C2);
}

export function buildIdleQuotesChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.idleQuotes || [], weeksToShow);
  return buildBarChart('chart-idle-quotes', s, C4);
}

export function buildTTQChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.timeToQuote || [], weeksToShow);
  return buildLineChart('chart-ttq', s, C3, ctx => ` ${ctx.parsed.y.toFixed(1)} days`);
}

export function buildDeficiencyChart(timeSeries, weeksToShow) {
  const s = sliceSeries(timeSeries.deficiencyCapture || [], weeksToShow);
  return buildLineChart('chart-deficiency', s, C4, pctTooltipLabel);
}

// ── Donut: Continued vs Abandoned ───────────────────────────────────────────
export function buildDonutChart(cloudWatchStats) {
  const ctx = getCtx('chart-donut');
  if (!ctx || !cloudWatchStats) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Continued', 'Abandoned'],
      datasets: [{
        data: [cloudWatchStats.continued, cloudWatchStats.abandoned],
        backgroundColor: ['#16a34a', '#dc2626'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0A3047',
          callbacks: {
            label: ctx => {
              const pct = ((ctx.raw / cloudWatchStats.total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ── Daily Activity bar chart ─────────────────────────────────────────────────
export function buildDailyChart(cloudWatchStats) {
  const ctx = getCtx('chart-daily');
  if (!ctx || !cloudWatchStats) return null;

  const labels = cloudWatchStats.dailyLabels.map(d => {
    const [, m, day] = d.split('-').map(Number);
    return new Date(2026, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Continued',
          data: cloudWatchStats.dailyCont,
          backgroundColor: '#16a34acc',
          borderRadius: 4,
          stack: 'events',
        },
        {
          label: 'Abandoned',
          data: cloudWatchStats.dailyAband,
          backgroundColor: '#dc2626cc',
          borderRadius: 4,
          stack: 'events',
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        legend: {
          display: true,
          labels: { font: { family: BASE_FONT, size: 11 }, boxWidth: 12 },
        },
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}`,
          },
        },
      },
      scales: {
        ...BASE_OPTIONS.scales,
        x: { ...BASE_OPTIONS.scales.x, stacked: true },
        y: { ...BASE_OPTIONS.scales.y, stacked: true },
      },
    },
  });
}

// ── Destroy helper ───────────────────────────────────────────────────────────
export function destroyChart(instance) {
  if (instance) instance.destroy();
}
