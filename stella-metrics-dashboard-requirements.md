# Stella Quote Metrics Dashboard — Claude Code Requirements

## Overview

Build a static, interactive metrics dashboard for the **Stella Quote EA** program, published to GitHub Pages. The dashboard ingests manual data exports (AWS CloudWatch and Snowflake/data platform CSVs) and renders KPI cards, trend charts, and breakdowns for internal stakeholders and leadership.

---

## 1. Repository & Publishing

- **Scaffold a new GitHub repository** named `stella-quote-metrics` (or similar).
- Configure **GitHub Pages** to publish from the `main` branch, `/docs` folder (or root — whichever is simpler for weekly updates).
- The entire site must be **static HTML/CSS/JS** — no server-side runtime, no build step required to view locally.
- Include a `README.md` explaining:
  - How to drop in new data files each week
  - How to run the site locally (e.g., `open index.html` or `npx serve`)
  - How the GitHub Pages publish cycle works

---

## 2. Data Ingestion

The dashboard must support **two input methods**, switchable without code changes:

### 2a. File Drop (Weekly Manual Update)
- A designated `/data/` folder in the repo holds the latest exports.
- The site reads files from `/data/` at load time via `fetch()`.
- Supported formats:
  - **CSV** — Snowflake / data platform exports (primary)
  - **HTML** — AWS CloudWatch exports (parse as DOM or convert logic; see note below)
  - **JSON** — optional CloudWatch export format if available
- When new files are dropped into `/data/` and committed, the site auto-reflects updated data on next page load.

### 2b. Browser Drag-and-Drop Upload
- A UI panel (collapsible or on a `/upload` page) allows a user to drag and drop one or more files directly into the browser.
- The dashboard parses and renders them in-memory without a page reload.
- Supports the same formats as 2a (CSV, HTML, JSON).
- Display a clear "loaded from upload" indicator so users know they're viewing non-committed data.

### Data File Conventions

Files are named with the pattern `{MetricName}_YYYY-MM-DD.csv` (e.g., `Conversion_Rate_2026-06-08.csv`). The date in the filename is the report run date. The dashboard should parse the date from the filename to label the dataset.

**Exact column schemas from production exports:**

`Conversion_Rate_YYYY-MM-DD.csv`
```
ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, TOTAL_DEFICIENCY_QUOTES, SUBMITTED_QUOTES, CONVERSION_RATE_PCT
```
- `DEFICIENCY_WEEK` is ISO 8601 timestamp (e.g., `2026-03-30T00:00:00Z`) — parse as week start date
- `CONVERSION_RATE_PCT` is pre-calculated (0–100)
- One row per user per week; multiple accounts (`ACCOUNT_ID`) in same file

`Idle_Quotes_YYYY-MM-DD.csv`
```
ACCOUNT_ID, USER_NAME, IDLE_QUOTES, AVG_IDLE_AGE_DAYS, MAX_IDLE_AGE_DAYS
```
- Snapshot (no week column) — represents current state at report run date
- `AVG_IDLE_AGE_DAYS` and `MAX_IDLE_AGE_DAYS` are floating point

`Quotes_per_User_YYYY-MM-DD.csv`
```
ACCOUNT_ID, USER_NAME, QUOTE_WEEK, TOTAL_QUOTES, STELLA_QUOTES
```
- `STELLA_QUOTES` = quotes that used Stella (subset of `TOTAL_QUOTES`)
- Stella adoption rate per user = `STELLA_QUOTES / TOTAL_QUOTES`
- Note: `Service Database Admin` rows are system/automation entries — filter from user-facing metrics

`Time_to_Quote_YYYY-MM-DD.csv`
```
ACCOUNT_ID, USER_NAME, DEFICIENCY_WEEK, DEFICIENCIES_QUOTED, AVG_DAYS_TO_QUOTE, MIN_DAYS_TO_QUOTE, MAX_DAYS_TO_QUOTE
```
- `AVG_DAYS_TO_QUOTE` can occasionally be negative (data artifact) — treat as 0 for display
- `DEFICIENCIES_QUOTED` is the count of deficiencies included in that week's submitted quotes

**Known data quirks to handle gracefully:**
- User names sometimes have trailing spaces (e.g., `"Megan  Segars "`, `"Daniel  Mabry"`) — trim on parse
- Multiple cohort accounts share the same file; `ACCOUNT_ID` is the tenant identifier
- The current week's data (e.g., `2026-06-08`) is a partial week — flag visually when the most recent week is < 5 business days old
- System/bot accounts to exclude from user metrics: `"Service Database Admin"`, `"ServiceTrade Support"`, `"ServiceTrade Support User (Do Not Delete)"`, `"automation user"`

**Account ID → Company mapping** (sourced from the Notion EA Programs database; store in `config.js`):
```json
{
  "accounts": {
    "1063":  { "company": "Total Fire Protection", "cohort": "May", "status": "active" },
    "1449":  { "company": "VSC Fire & Security Inc", "cohort": "Pre-May", "status": "active" },
    "2584":  { "company": "Century Fire Protection LLC", "cohort": "Pre-May", "status": "active" },
    "3345":  { "company": "Emerald Fire LLC", "cohort": "Pre-May", "status": "active" },
    "7133":  { "company": "Desert Fire", "cohort": "Pre-May", "status": "inactive" },
    "7710":  { "company": "Century Fire", "cohort": "Pre-May", "status": "active" },
    "8416":  { "company": "Jayhawk Fire Sprinkler Co.", "cohort": "Pre-May", "status": "active" },
    "9464":  { "company": "Yadon Mechanical", "cohort": "May", "status": "active" },
    "9639":  { "company": "California Boiler Inc.", "cohort": "Pre-May", "status": "active" },
    "9755":  { "company": "Performance Fire", "cohort": "May", "status": "active" },
    "9773":  { "company": "Innovative Systems", "cohort": "May", "status": "active" },
    "9790":  { "company": "The Fireman Equipment Company", "cohort": "May", "status": "active" },
    "9797":  { "company": "Soul Mechanical", "cohort": "May", "status": "active" },
    "9900":  { "company": "Gray Mechanical Contractors LLC", "cohort": "Pre-May", "status": "active" },
    "9945":  { "company": "Thorpe Design, Inc.", "cohort": "May", "status": "active" },
    "10296": { "company": "Continental Mechanical", "cohort": "May", "status": "active" },
    "10435": { "company": "National Fire and Safety", "cohort": "May", "status": "active" },
    "11098": { "company": "Envelop Group", "cohort": "Pre-May", "status": "active" },
    "11146": { "company": "Stark Tech", "cohort": "Pre-May", "status": "active" },
    "11150": { "company": "MSI Mechanical Systems Inc.", "cohort": "Pre-May", "status": "active" },
    "11261": { "company": "Serenergy Corp", "cohort": "Pre-May", "status": "active" },
    "11631": { "company": "DVL Group Inc.", "cohort": "Pre-May", "status": "active" }
  }
}
```
Accounts 46, 666, and 4393 are excluded from the dashboard. Claude Code should filter these account IDs out of all metrics and the tenant breakdown table.

- Document expected column names/schemas in `README.md` and a `/data/schema.md` file.
- The parser should be **tolerant of missing columns** — show "N/A" rather than crashing.
- Use the actual uploaded CSVs as sample data in `/data/sample/` — they are representative of real production exports and can be used as-is for development and testing.

---

## 3. Metrics — V1 Must-Haves

### 3a. KPI Cards (top of page — current week snapshot)

| Metric | Description | Source |
|---|---|---|
| **Active Users** | Count of unique non-system users with any quotes in the latest week | `Quotes_per_User` |
| **Active Tenants** | Count of distinct `ACCOUNT_ID`s with activity in the latest week | `Quotes_per_User` |
| **Quote Conversion Rate** | Sum(`SUBMITTED_QUOTES`) ÷ Sum(`TOTAL_DEFICIENCY_QUOTES`), latest week | `Conversion_Rate` |
| **Stella Adoption Rate** | Sum(`STELLA_QUOTES`) ÷ Sum(`TOTAL_QUOTES`), latest week | `Quotes_per_User` |
| **Total Idle Quotes** | Sum of `IDLE_QUOTES` across all non-system users (snapshot) | `Idle_Quotes` |
| **Avg Idle Age (days)** | Weighted avg of `AVG_IDLE_AGE_DAYS` weighted by `IDLE_QUOTES` | `Idle_Quotes` |
| **Avg Time to Quote** | Weighted avg of `AVG_DAYS_TO_QUOTE` weighted by `DEFICIENCIES_QUOTED`, latest week | `Time_to_Quote` |
| **Total Stella Quotes** | Sum of `STELLA_QUOTES` across all users, latest week | `Quotes_per_User` |

Each KPI card should show:
- Current value (large, prominent)
- Week-over-week delta (↑↓ with color: green/red) when prior-week data is available
- Subtle label/eyebrow text

### 3b. Trend Charts (historical, week-by-week)

- **Quote Conversion Rate over time** — line chart
- **Quote Acceptance Rate over time** — line chart
- **Active Users over time** — bar or line chart
- **Idle Quotes over time** — bar chart
- **Time to Quote (median) over time** — line chart
- **Deficiency Capture Rate over time** — line chart

Each chart should:
- Default to last 8 weeks of data
- Allow toggling to "All time" view
- Display data points on hover with exact values and week label

### 3c. Breakdowns (tables + charts)

- **Usage by Tenant** — sortable table: tenant name, quotes sent, conversion rate, acceptance rate, deficiency rate
- **Activity by Cohort** — which cohorts are active vs. inactive (e.g., "Desert Fire: inactive", "Aiden: active")
- **Continued vs. Abandoned breakdown** — donut chart (mirrors existing HTML report)
- **Daily Activity** — bar chart of quote events by day of week for the current period

---

## 4. Layout & UX

### Page Structure
```
Header (logo + title + week label)
├── Data Status Bar (source, last updated timestamp, "upload new data" button)
├── Section: KPI Summary Cards
├── Section: Trend Charts (2-column grid)
├── Section: Usage by Tenant (table)
├── Section: Cohort Activity
└── Section: Raw Event Log (collapsible, optional)
```

### Interactivity
- **Date range selector** — filter all charts/tables to a selected week range
- **Tenant filter** — filter breakdown table by tenant name
- **Collapsible sections** — so leadership can focus on summary cards only
- Responsive layout: works on desktop and tablet (1024px+); mobile is nice-to-have

---

## 5. Visual Design — ServiceTrade Brand

Apply ServiceTrade's brand identity throughout:

### Colors (CSS custom properties)
```css
--st-dark-blue: #0A3047;   /* primary brand, dark backgrounds, primary text */
--st-blue: #0C4061;        /* secondary, headers, nav */
--st-teal: #286382;        /* accents, links */
--st-light-blue: #87BFD9;  /* highlights, chart fills */
--st-orange: #F26417;      /* CTAs, emphasis, interactive elements */
--st-bg: #F8F8F8;          /* page background */
```

### Typography (Google Fonts fallbacks — no license required)
```css
/* Headlines / headings */
font-family: 'D-DIN Exp', 'Rubik', Arial, sans-serif;

/* Eyebrows / labels / KPI labels */
font-family: 'Commuters Sans', 'Montserrat', Arial, sans-serif;

/* Body copy / table text */
font-family: 'Causten', 'Montserrat', Georgia, sans-serif;
```

- Load Rubik and Montserrat from Google Fonts as fallbacks (always available).
- H1/H2 text in ALL CAPS when using display sizing.
- KPI card labels: Montserrat SemiBold, uppercase, wide letter-spacing.
- Orange (`#F26417`) for the primary CTA button ("Upload Data") and chart highlights.
- Dark Blue (`#0A3047`) for the site header background with white text.

### Chart Colors
Use in this order for multi-series charts: Dark Blue → Teal → Light Blue → Orange.

---

## 6. Charting Library

Use **Chart.js** (already used in the existing HTML report — keep consistency):
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
```

---

## 7. File Structure

```
stella-quote-metrics/
├── index.html              # Main dashboard
├── upload.html             # (optional) dedicated upload page, or inline panel
├── README.md
├── docs/                   # (if using /docs for GitHub Pages)
├── data/
│   ├── schema.md           # Column definitions for each file type
│   ├── sample/
│   │   ├── cloudwatch-sample.csv
│   │   ├── cloudwatch-sample.html
│   │   └── snowflake-sample.csv
│   └── (real exports dropped here weekly)
├── js/
│   ├── main.js             # App entry point, orchestrates load/render
│   ├── parsers.js          # CSV, HTML, JSON parsers for each data source
│   ├── metrics.js          # Metric calculation logic (conversion rate, idle, etc.)
│   ├── charts.js           # Chart.js chart builders
│   └── ui.js               # KPI card rendering, table rendering, filters
└── css/
    └── style.css           # ServiceTrade brand styles, layout
```

---

## 8. Configuration File

Include a `config.js` or `config.json` at root with tunable constants:
```json
{
  "idleQuoteThresholdHours": 24,
  "defaultWeeksToShow": 8,
  "weekStartDay": "Monday",
  "dataFolder": "./data/"
}
```

---

## 9. Error Handling & Edge Cases

- If a required column is missing from an uploaded file: show a yellow warning banner listing missing fields, render available metrics with "N/A" for missing ones.
- If no data files are present: show a friendly empty state with instructions to upload data.
- If only one week of data is present: hide trend charts and show a note that historical data will appear after week 2.
- Timestamp/date parsing should handle multiple common formats (ISO 8601, MM/DD/YYYY, epoch ms).

---

## 10. Out of Scope for V1

- Authentication / access control (internal URL sharing is sufficient)
- Automated data pipeline (CloudWatch pull, Snowflake connector) — manual exports only
- Email/Slack alerting
- Pendo integration (tracked separately by the team)
- Mobile-first layout (desktop/tablet priority)

---

## 11. Acceptance Criteria

- [ ] Site loads with sample data out of the box with no errors in console
- [ ] All 8 KPI cards render with correct values from sample data
- [ ] All 6 trend charts render correctly with multi-week sample data
- [ ] Tenant breakdown table is sortable by all columns
- [ ] Drag-and-drop upload works in Chrome and Safari and updates charts in-memory
- [ ] Dropping new files into `/data/` and refreshing the page reflects new data
- [ ] Site renders correctly on 1280px+ viewport
- [ ] All colors match ServiceTrade brand palette (no default Chart.js blue)
- [ ] GitHub Pages deployment instructions in README produce a live URL
- [ ] `config.js` idle threshold change is reflected in the Idle Quotes KPI without code edits

---

## Reference Files

The following files were used to inform these requirements and should be reviewed by Claude Code when building:

- **`stella-quote-feedback-report.html`** — existing weekly HTML report; use as reference for existing metric definitions, data shape, and chart patterns (donut chart, daily activity bar, account table)
- **Meeting notes (Jun 9, 2026)** — context on GA timeline, cohort status, Pendo/GTM plans, and the "one-stop shop" dashboard vision
