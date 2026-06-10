import { CONFIG } from './config.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function weekKey(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Returns unique sorted week keys (ascending) from an array of rows with .week
function sortedWeeks(rows) {
  const seen = new Set();
  rows.forEach(r => { if (r.week) seen.add(weekKey(r.week)); });
  return Array.from(seen).sort();
}

// Format a week key as "MMM D" label for charts
export function weekLabel(isoKey) {
  if (!isoKey) return '';
  const [y, m, d] = isoKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Weighted average: Σ(value × weight) / Σ(weight); returns null if total weight = 0
function weightedAvg(rows, valueKey, weightKey) {
  let sumVal = 0, sumWeight = 0;
  rows.forEach(r => {
    const w = r[weightKey] || 0;
    sumVal += (r[valueKey] || 0) * w;
    sumWeight += w;
  });
  return sumWeight === 0 ? null : sumVal / sumWeight;
}

// Count business days from a Monday to today (both UTC dates)
function businessDaysSince(mondayDate) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = today - mondayDate;
  if (diffMs < 0) return 0;
  const diffDays = Math.floor(diffMs / 86400000);
  let bizDays = 0;
  for (let i = 0; i < diffDays; i++) {
    const dow = new Date(mondayDate.getTime() + i * 86400000).getUTCDay();
    if (dow !== 0 && dow !== 6) bizDays++;
  }
  return bizDays;
}

// ── Core computation ─────────────────────────────────────────────────────────

export function computeMetrics(appData) {
  const { conversionRate, idleQuotes, quotesPerUser, timeToQuote, cloudWatch } = appData;

  const warnings = { missingColumns: [], isPartialWeek: false };

  // ── Latest week detection ────────────────────────────────
  const crWeeks  = conversionRate ? sortedWeeks(conversionRate) : [];
  const qpuWeeks = quotesPerUser  ? sortedWeeks(quotesPerUser)  : [];
  const ttqWeeks = timeToQuote    ? sortedWeeks(timeToQuote)    : [];

  const allWeekKeys = Array.from(new Set([...crWeeks, ...qpuWeeks, ...ttqWeeks])).sort();
  const latestWeek  = allWeekKeys.length > 0 ? allWeekKeys[allWeekKeys.length - 1] : null;
  const prevWeek    = allWeekKeys.length > 1 ? allWeekKeys[allWeekKeys.length - 2] : null;

  // Partial week: latest week started < 5 business days ago
  if (latestWeek) {
    const [y, m, d] = latestWeek.split('-').map(Number);
    const weekStart = new Date(Date.UTC(y, m - 1, d));
    if (businessDaysSince(weekStart) < 5) warnings.isPartialWeek = true;
  }

  // ── KPI helpers ──────────────────────────────────────────
  function rowsForWeek(rows, wk) {
    if (!rows || !wk) return [];
    return rows.filter(r => weekKey(r.week) === wk);
  }

  function computeKPI(current, prior, higherIsBetter) {
    const delta = (current !== null && prior !== null && prior !== 0)
      ? ((current - prior) / prior) * 100
      : null;
    const direction = delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
    // Flip color meaning for metrics where higher is bad
    const sentiment = direction === 'neutral' ? 'neutral'
      : higherIsBetter
        ? direction
        : (direction === 'up' ? 'down' : 'up');
    return { value: current, delta, sentiment };
  }

  // ── KPI: Active Users ────────────────────────────────────
  function activeUsers(wk) {
    const rows = rowsForWeek(quotesPerUser, wk);
    return rows.length === 0 ? null : new Set(rows.map(r => r.userName)).size;
  }

  // ── KPI: Active Tenants ──────────────────────────────────
  function activeTenants(wk) {
    const rows = rowsForWeek(quotesPerUser, wk);
    return rows.length === 0 ? null : new Set(rows.map(r => r.accountId)).size;
  }

  // ── KPI: Quote Conversion Rate ───────────────────────────
  function conversionRateKPI(wk) {
    const rows = rowsForWeek(conversionRate, wk);
    if (rows.length === 0) return null;
    const total = rows.reduce((s, r) => s + r.totalDeficiencyQuotes, 0);
    const submitted = rows.reduce((s, r) => s + r.submittedQuotes, 0);
    return total === 0 ? null : (submitted / total) * 100;
  }

  // ── KPI: Stella Adoption Rate ────────────────────────────
  function stellaAdoptionKPI(wk) {
    const rows = rowsForWeek(quotesPerUser, wk);
    if (rows.length === 0) return null;
    const total = rows.reduce((s, r) => s + r.totalQuotes, 0);
    const stella = rows.reduce((s, r) => s + r.stellaQuotes, 0);
    return total === 0 ? null : (stella / total) * 100;
  }

  // ── KPI: Total Idle Quotes (snapshot) ───────────────────
  const totalIdleQuotesCurrent = idleQuotes
    ? idleQuotes.reduce((s, r) => s + r.idleQuotes, 0)
    : null;

  // ── KPI: Avg Idle Age ────────────────────────────────────
  const avgIdleAgeCurrent = idleQuotes
    ? weightedAvg(idleQuotes, 'avgIdleAgeDays', 'idleQuotes')
    : null;

  // ── KPI: Avg Time to Quote ───────────────────────────────
  function avgTTQKPI(wk) {
    const rows = rowsForWeek(timeToQuote, wk);
    return rows.length === 0 ? null : weightedAvg(rows, 'avgDaysToQuote', 'deficienciesQuoted');
  }

  // ── KPI: Total Stella Quotes ─────────────────────────────
  function totalStellaKPI(wk) {
    const rows = rowsForWeek(quotesPerUser, wk);
    return rows.length === 0 ? null : rows.reduce((s, r) => s + r.stellaQuotes, 0);
  }

  const kpis = {
    activeUsers:      computeKPI(activeUsers(latestWeek),      activeUsers(prevWeek),      true),
    activeTenants:    computeKPI(activeTenants(latestWeek),    activeTenants(prevWeek),    true),
    conversionRate:   computeKPI(conversionRateKPI(latestWeek), conversionRateKPI(prevWeek), true),
    stellaAdoption:   computeKPI(stellaAdoptionKPI(latestWeek), stellaAdoptionKPI(prevWeek), true),
    totalIdleQuotes:  computeKPI(totalIdleQuotesCurrent,       null,                        false),
    avgIdleAge:       computeKPI(avgIdleAgeCurrent,            null,                        false),
    avgTimeToQuote:   computeKPI(avgTTQKPI(latestWeek),        avgTTQKPI(prevWeek),         false),
    totalStellaQuotes: computeKPI(totalStellaKPI(latestWeek),  totalStellaKPI(prevWeek),    true),
  };

  // ── Time Series ──────────────────────────────────────────
  const timeSeries = {
    conversionRate:  buildWeeklySeries(allWeekKeys, wk => conversionRateKPI(wk)),
    stellaAdoption:  buildWeeklySeries(allWeekKeys, wk => stellaAdoptionKPI(wk)),
    activeUsers:     buildWeeklySeries(allWeekKeys, wk => activeUsers(wk)),
    idleQuotes:      buildIdleSeries(conversionRate, quotesPerUser, timeToQuote, idleQuotes),
    timeToQuote:     buildWeeklySeries(allWeekKeys, wk => avgTTQKPI(wk)),
    deficiencyCapture: buildWeeklySeries(allWeekKeys, wk => deficiencyCaptureKPI(wk)),
  };

  function buildWeeklySeries(weeks, valueFn) {
    return weeks.map(wk => ({ week: wk, label: weekLabel(wk), value: valueFn(wk) }));
  }

  // Deficiency capture: unique deficiencies quoted / total deficiencies
  function deficiencyCaptureKPI(wk) {
    const rows = rowsForWeek(conversionRate, wk);
    if (rows.length === 0) return null;
    const total = rows.reduce((s, r) => s + r.totalDeficiencyQuotes, 0);
    const quoted = rows.reduce((s, r) => s + r.submittedQuotes, 0);
    return total === 0 ? null : (quoted / total) * 100;
  }

  // Idle quotes time series: uses all weekly data, falling back to snapshot per-week if needed
  function buildIdleSeries(cr, qpu, ttq, idle) {
    // We only have a snapshot for idle — return it as a single point tagged to latestWeek
    if (!idle || !latestWeek) return [];
    const total = idle.reduce((s, r) => s + r.idleQuotes, 0);
    return [{ week: latestWeek, label: weekLabel(latestWeek), value: total }];
  }

  // ── Tenant Breakdown ─────────────────────────────────────
  const tenantBreakdown = buildTenantBreakdown(conversionRate, quotesPerUser, idleQuotes, latestWeek);

  // ── CloudWatch (Continued/Abandoned) ────────────────────
  const cloudWatchStats = cloudWatch ? buildCloudWatchStats(cloudWatch) : null;

  return { kpis, timeSeries, tenantBreakdown, cloudWatchStats, warnings, latestWeek, allWeekKeys };
}

function buildTenantBreakdown(conversionRate, quotesPerUser, idleQuotes, latestWeek) {
  const rows = [];

  Object.entries(CONFIG.ACCOUNTS).forEach(([accountId, info]) => {
    const crRows = (conversionRate || []).filter(r => r.accountId === accountId);
    const qpuRows = (quotesPerUser || []).filter(r => r.accountId === accountId);
    const idleRows = (idleQuotes || []).filter(r => r.accountId === accountId);

    const crLatest = latestWeek ? crRows.filter(r => weekKey(r.week) === latestWeek) : crRows;
    const qpuLatest = latestWeek ? qpuRows.filter(r => weekKey(r.week) === latestWeek) : qpuRows;

    const totalDef = crLatest.reduce((s, r) => s + r.totalDeficiencyQuotes, 0);
    const submitted = crLatest.reduce((s, r) => s + r.submittedQuotes, 0);
    const totalQ = qpuLatest.reduce((s, r) => s + r.totalQuotes, 0);
    const stellaQ = qpuLatest.reduce((s, r) => s + r.stellaQuotes, 0);
    const idleQ = idleRows.reduce((s, r) => s + r.idleQuotes, 0);

    rows.push({
      accountId,
      company:       info.company,
      cohort:        info.cohort,
      status:        info.status,
      quotesSent:    submitted,
      conversionRate: totalDef > 0 ? (submitted / totalDef) * 100 : null,
      stellaAdoption: totalQ > 0 ? (stellaQ / totalQ) * 100 : null,
      idleQuotes:    idleQ,
    });
  });

  return rows;
}

function buildCloudWatchStats(events) {
  const continued = events.filter(e => e.event === 'CONTINUED').length;
  const abandoned  = events.filter(e => e.event === 'ABANDONED').length;
  const total = continued + abandoned;

  // Daily breakdown
  const byDate = {};
  events.forEach(e => {
    if (!e.date) return;
    if (!byDate[e.date]) byDate[e.date] = { cont: 0, aband: 0 };
    if (e.event === 'CONTINUED') byDate[e.date].cont++;
    else byDate[e.date].aband++;
  });
  const dailyLabels = Object.keys(byDate).sort();
  const dailyCont   = dailyLabels.map(d => byDate[d].cont);
  const dailyAband  = dailyLabels.map(d => byDate[d].aband);

  return { continued, abandoned, total, dailyLabels, dailyCont, dailyAband };
}
