# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static GitHub Pages dashboard for the **Stella Quote EA** program. No build step — open `index.html` directly or run `npx serve .` for local development. Deploys via GitHub Pages from the `main` branch.

## Running Locally

```bash
npx serve .          # serves at localhost:3000
# or simply
open index.html      # works for file:// fetch if CORS not an issue
```

No package.json, no bundler, no compilation.

## Architecture

All logic lives in `/js/` as plain ES modules loaded via `<script type="module">`:

- **`main.js`** — entry point; orchestrates data load → parse → metric calculation → render
- **`parsers.js`** — CSV, HTML (CloudWatch DOM), and JSON parsers; returns normalized row arrays
- **`metrics.js`** — all KPI and aggregation math (conversion rate, idle, time-to-quote, Stella adoption)
- **`charts.js`** — Chart.js wrappers; all chart config lives here
- **`ui.js`** — KPI card DOM rendering, sortable table, filter controls
- **`config.js`** — tunable constants (idle threshold, default week range, data folder path) and the account ID → company mapping

Data flows one direction: `main.js` calls parsers → passes raw rows to `metrics.js` → passes computed values to `charts.js` and `ui.js`. No shared mutable state between modules.

## Data Layer

Files in `/data/` are fetched at load time. Filename pattern: `{MetricName}_YYYY-MM-DD.csv` — the date is parsed from the filename and used as the report label.

**Four CSV schemas** (exact column names matter for parser matching):
- `Conversion_Rate` — `ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, TOTAL_DEFICIENCY_QUOTES, SUBMITTED_QUOTES, CONVERSION_RATE_PCT`
- `Idle_Quotes` — `ACCOUNT_ID, USER_NAME, IDLE_QUOTES, AVG_IDLE_AGE_DAYS, MAX_IDLE_AGE_DAYS` (snapshot, no week column)
- `Quotes_per_User` — `ACCOUNT_ID, USER_NAME, QUOTE_WEEK, TOTAL_QUOTES, STELLA_QUOTES`
- `Time_to_Quote` — `ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, DEFICIENCIES_QUOTED, AVG_DAYS_TO_QUOTE, MIN_DAYS_TO_QUOTE, MAX_DAYS_TO_QUOTE`

**Required data handling rules (enforce in parsers.js and metrics.js):**
- Trim all user name strings — production data has trailing spaces
- Filter system accounts: `"Service Database Admin"`, `"ServiceTrade Support"`, `"ServiceTrade Support User (Do Not Delete)"`, `"automation user"`
- Exclude account IDs `46`, `666`, `4393` from all metrics and tables
- `DEFICIENCY_WEEK` / `QUOTE_WEEK` are ISO 8601 timestamps — parse as week-start dates
- `AVG_DAYS_TO_QUOTE` can be negative (data artifact) — floor to 0 before display
- Most-recent week may be partial (< 5 business days) — flag visually

**Drag-and-drop upload** (in `upload.html` or inline panel): parses files in-memory, renders without page reload, shows a "loaded from upload" indicator. Never persists uploads to `/data/`.

## Charting

Chart.js 4.4.3 via CDN (`cdn.jsdelivr.net`). Color order for multi-series: `#0A3047` → `#286382` → `#87BFD9` → `#F26417`. All charts default to last 8 weeks with an "All time" toggle. No default Chart.js blue should appear anywhere.

## Brand / Styling

CSS custom properties in `style.css`:
```
--st-dark-blue: #0A3047   (header bg, primary text)
--st-blue: #0C4061        (headers, nav)
--st-teal: #286382        (accents, links)
--st-light-blue: #87BFD9  (chart fills)
--st-orange: #F26417      (CTAs, "Upload Data" button, chart highlights)
--st-bg: #F8F8F8          (page background)
```
Google Fonts: Rubik (headlines) + Montserrat (labels/body). H1/H2 in ALL CAPS at display size. KPI labels: Montserrat SemiBold, uppercase, wide letter-spacing.

## KPI Card Logic

Each card shows current value + week-over-week delta (↑↓, green/red) when prior-week data exists.

| Card | Formula |
|---|---|
| Active Users | Unique non-system `USER_NAME` with any quotes, latest week |
| Active Tenants | Distinct `ACCOUNT_ID` with activity, latest week |
| Quote Conversion Rate | `ΣSubmitted ÷ ΣTotalDeficiency`, latest week |
| Stella Adoption Rate | `ΣStellaQuotes ÷ ΣTotalQuotes`, latest week |
| Total Idle Quotes | `ΣIdleQuotes` (snapshot) |
| Avg Idle Age | Weighted avg of `AVG_IDLE_AGE_DAYS` weighted by `IDLE_QUOTES` |
| Avg Time to Quote | Weighted avg of `AVG_DAYS_TO_QUOTE` weighted by `DEFICIENCIES_QUOTED`, latest week |
| Total Stella Quotes | `ΣStellaQuotes`, latest week |

## Account Config

The full account ID → company/cohort/status map is in `config.js`. Cohorts are `"Pre-May"` or `"May"`. Account `"7133"` (Desert Fire) is `status: "inactive"` — still shown in breakdowns but flagged.

## Error / Edge Cases

- Missing columns: yellow warning banner listing missing fields; render other metrics with "N/A"
- No data files: friendly empty state with upload instructions
- Single week of data: hide trend charts, show a note that historical view requires ≥ 2 weeks

## Full Requirements

See `stella-metrics-dashboard-requirements.md` for the complete spec including acceptance criteria, out-of-scope items, and reference to `stella-quote-feedback-report.html` (existing weekly report used as chart/metric reference).
