import { CONFIG } from './config.js';

// Normalize an ISO date string to a Monday week-start Date.
// Appends Z if no timezone offset is present so Date() treats it as UTC.
function toWeekStart(isoStr) {
  if (!isoStr) return null;
  const s = isoStr.trim();
  const normalized = /[+Z]/.test(s) ? s : s + 'Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  // Roll back to Monday (UTC)
  const dow = d.getUTCDay(); // 0=Sun
  const daysBack = dow === 0 ? 6 : dow - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack));
}

function isExcluded(row) {
  const acct = String(row.ACCOUNT_ID || '').trim();
  const user = (row.USER_NAME || '').trim();
  return CONFIG.EXCLUDED_ACCOUNTS.has(acct) || CONFIG.SYSTEM_USERS.has(user);
}

function parseCSV(text) {
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    skipBom: true,
    dynamicTyping: false,
  });
}

// ── Conversion Rate ──────────────────────────────────────────────────────────
// Columns: ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, TOTAL_DEFICIENCY_QUOTES,
//          SUBMITTED_QUOTES, CONVERSION_RATE_PCT
export function parseConversionRate(text) {
  const { data, errors } = parseCSV(text);
  const missingFields = [];
  const required = ['ACCOUNT_ID', 'USER_NAME', 'DEFICIENCY_WEEK', 'TOTAL_DEFICIENCY_QUOTES', 'SUBMITTED_QUOTES'];

  if (data.length > 0) {
    required.forEach(col => {
      if (!Object.prototype.hasOwnProperty.call(data[0], col)) missingFields.push(col);
    });
  }

  const rows = data
    .filter(r => !isExcluded(r))
    .map(r => ({
      accountId:             String(r.ACCOUNT_ID || '').trim(),
      userName:              (r.USER_NAME || '').trim(),
      week:                  toWeekStart(r.DEFICIENCY_WEEK),
      totalDeficiencyQuotes: parseFloat(r.TOTAL_DEFICIENCY_QUOTES) || 0,
      submittedQuotes:       parseFloat(r.SUBMITTED_QUOTES) || 0,
      conversionRatePct:     parseFloat(r.CONVERSION_RATE_PCT) || 0,
    }))
    .filter(r => r.week !== null);

  return { rows, missingFields };
}

// ── Idle Quotes ──────────────────────────────────────────────────────────────
// Columns: ACCOUNT_ID, USER_NAME, IDLE_QUOTES, AVG_IDLE_AGE_DAYS, MAX_IDLE_AGE_DAYS
// snapshotWeek is extracted from the filename (e.g. Idle_Quotes_2026-06-08.csv → "2026-06-08")
export function parseIdleQuotes(text, snapshotWeek) {
  const { data } = parseCSV(text);
  const missingFields = [];
  const required = ['ACCOUNT_ID', 'USER_NAME', 'IDLE_QUOTES', 'AVG_IDLE_AGE_DAYS'];

  if (data.length > 0) {
    required.forEach(col => {
      if (!Object.prototype.hasOwnProperty.call(data[0], col)) missingFields.push(col);
    });
  }

  const rows = data
    .filter(r => !isExcluded(r))
    .map(r => ({
      accountId:      String(r.ACCOUNT_ID || '').trim(),
      userName:       (r.USER_NAME || '').trim(),
      snapshotWeek:   snapshotWeek || null,
      idleQuotes:     parseFloat(r.IDLE_QUOTES) || 0,
      avgIdleAgeDays: parseFloat(r.AVG_IDLE_AGE_DAYS) || 0,
      maxIdleAgeDays: parseFloat(r.MAX_IDLE_AGE_DAYS) || 0,
    }));

  return { rows, missingFields };
}

// ── Quotes per User ──────────────────────────────────────────────────────────
// Columns: ACCOUNT_ID, USER_NAME, QUOTE_WEEK, TOTAL_QUOTES, STELLA_QUOTES
export function parseQuotesPerUser(text) {
  const { data } = parseCSV(text);
  const missingFields = [];
  const required = ['ACCOUNT_ID', 'USER_NAME', 'QUOTE_WEEK', 'TOTAL_QUOTES', 'STELLA_QUOTES'];

  if (data.length > 0) {
    required.forEach(col => {
      if (!Object.prototype.hasOwnProperty.call(data[0], col)) missingFields.push(col);
    });
  }

  const rows = data
    .filter(r => !isExcluded(r))
    .map(r => ({
      accountId:   String(r.ACCOUNT_ID || '').trim(),
      userName:    (r.USER_NAME || '').trim(),
      week:        toWeekStart(r.QUOTE_WEEK),
      totalQuotes: parseFloat(r.TOTAL_QUOTES) || 0,
      stellaQuotes: parseFloat(r.STELLA_QUOTES) || 0,
    }))
    .filter(r => r.week !== null);

  return { rows, missingFields };
}

// ── Time to Quote ────────────────────────────────────────────────────────────
// Columns: ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, DEFICIENCIES_QUOTED,
//          AVG_DAYS_TO_QUOTE, MIN_DAYS_TO_QUOTE, MAX_DAYS_TO_QUOTE
export function parseTimeToQuote(text) {
  const { data } = parseCSV(text);
  const missingFields = [];
  const required = ['ACCOUNT_ID', 'USER_NAME', 'DEFICIENCY_WEEK', 'DEFICIENCIES_QUOTED', 'AVG_DAYS_TO_QUOTE'];

  if (data.length > 0) {
    required.forEach(col => {
      if (!Object.prototype.hasOwnProperty.call(data[0], col)) missingFields.push(col);
    });
  }

  const rows = data
    .filter(r => !isExcluded(r))
    .map(r => ({
      accountId:          String(r.ACCOUNT_ID || '').trim(),
      userName:           (r.USER_NAME || '').trim(),
      week:               toWeekStart(r.DEFICIENCY_WEEK),
      deficienciesQuoted: parseFloat(r.DEFICIENCIES_QUOTED) || 0,
      avgDaysToQuote:     Math.max(0, parseFloat(r.AVG_DAYS_TO_QUOTE) || 0), // floor negatives
      minDaysToQuote:     Math.max(0, parseFloat(r.MIN_DAYS_TO_QUOTE) || 0),
      maxDaysToQuote:     Math.max(0, parseFloat(r.MAX_DAYS_TO_QUOTE) || 0),
    }))
    .filter(r => r.week !== null);

  return { rows, missingFields };
}

// ── CloudWatch HTML/JSON stub ────────────────────────────────────────────────
// Parses the StellaQuoteFeedback event log (CONTINUED / ABANDONED events).
// Supports both the JS-embedded EVENTS array (from the HTML report) and a raw JSON array.
export function parseCloudWatch(text, isHTML) {
  if (isHTML) {
    // Extract the EVENTS array from the embedded script block
    const match = text.match(/const EVENTS\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return { rows: [], missingFields: [] };
    try {
      const events = JSON.parse(match[1]);
      return { rows: normalizeCloudWatchEvents(events), missingFields: [] };
    } catch {
      return { rows: [], missingFields: ['parse_error'] };
    }
  }
  // JSON array
  try {
    const events = JSON.parse(text);
    if (!Array.isArray(events)) return { rows: [], missingFields: ['expected_array'] };
    return { rows: normalizeCloudWatchEvents(events), missingFields: [] };
  } catch {
    return { rows: [], missingFields: ['parse_error'] };
  }
}

function normalizeCloudWatchEvents(events) {
  return events
    .filter(e => e.event === 'CONTINUED' || e.event === 'ABANDONED')
    .filter(e => !CONFIG.EXCLUDED_ACCOUNTS.has(String(e.account || '').trim()))
    .map(e => ({
      ts:        e.ts,
      date:      e.ts ? e.ts.slice(0, 10) : null,
      hour:      e.ts ? parseInt(e.ts.slice(11, 13), 10) : null,
      event:     e.event,
      accountId: String(e.account || '').trim(),
      jobId:     e.jobId || null,
      quoteId:   e.quoteId || null,
    }));
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
// Routes a file by its name prefix to the correct parser.
// Returns { type, rows, missingFields } or null for unrecognized files.
export function parseByFilename(filename, text) {
  const base = filename.replace(/\s+/g, '_'); // normalize spaces
  const lower = base.toLowerCase();

  if (lower.startsWith('conversion_rate') || lower.startsWith('conversion rate')) {
    return { type: 'conversionRate', ...parseConversionRate(text) };
  }
  if (lower.startsWith('idle_quotes') || lower.startsWith('idle quotes')) {
    // Extract the YYYY-MM-DD date from the filename for snapshot tagging
    const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})/);
    const snapshotWeek = dateMatch ? dateMatch[1] : null;
    return { type: 'idleQuotes', ...parseIdleQuotes(text, snapshotWeek) };
  }
  if (lower.startsWith('quotes_per_user') || lower.startsWith('quotes per user')) {
    return { type: 'quotesPerUser', ...parseQuotesPerUser(text) };
  }
  if (lower.startsWith('time_to_quote') || lower.startsWith('time to quote')) {
    return { type: 'timeToQuote', ...parseTimeToQuote(text) };
  }
  // CloudWatch HTML or JSON
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return { type: 'cloudWatch', ...parseCloudWatch(text, true) };
  }
  if (lower.endsWith('.json')) {
    return { type: 'cloudWatch', ...parseCloudWatch(text, false) };
  }
  return null;
}
