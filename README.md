# Stella Quote Metrics Dashboard

Static GitHub Pages dashboard for the Stella Quote EA program. No build step — served directly from `index.html`.

## Running Locally

```bash
npx serve .
# then open http://localhost:3000
```

Opening `index.html` directly over `file://` will block data loading (browser CORS restriction).

## Weekly Data Update

1. Export the four Snowflake CSVs for the new week.
2. Rename files to the standard pattern (replace spaces with underscores):
   ```
   Conversion_Rate_YYYY-MM-DD.csv
   Idle_Quotes_YYYY-MM-DD.csv
   Quotes_per_User_YYYY-MM-DD.csv
   Time_to_Quote_YYYY-MM-DD.csv
   ```
   The date is the report run date, not the week start.
3. Drop them into the `/data/` folder.
4. **Do not overwrite existing files** — always use a new date-stamped filename (GitHub Pages caches by URL).
5. Commit and push to `main`. The site auto-reflects the new data on next page load.

## GitHub Pages Deployment

1. Push to `main` on GitHub.
2. Go to **Settings → Pages**.
3. Set source to **"Deploy from a branch"**, branch `main`, folder `/ (root)`.
4. The site publishes at `https://<your-org>.github.io/stella-quote-metrics/`.

After the first deploy, subsequent pushes to `main` publish automatically within ~60 seconds.

## Browser Upload (Ad-hoc)

Click **Upload Data** in the header to open the upload panel. Drop files directly — the dashboard parses and renders them in memory without saving to the repo. Supports the same CSV formats plus CloudWatch HTML/JSON exports.

CloudWatch exports enable the **Continued vs. Abandoned** donut chart and **Daily Activity** bar chart.

## Data Schema

See [`data/schema.md`](data/schema.md) for full column definitions, filtering rules, and file naming conventions.

## Config

Edit `js/config.js` to change:
- `DEFAULT_WEEKS` — default trend chart window (8)
- `ACCOUNTS` — tenant name / cohort / status mapping
- `EXCLUDED_ACCOUNTS` / `SYSTEM_USERS` — rows filtered from all metrics

## File Structure

```
index.html          Main dashboard
js/
  main.js           Orchestration, data load, drag-and-drop
  config.js         Brand constants, account map, KPI definitions
  parsers.js        CSV/HTML/JSON parsers (one per file type)
  metrics.js        KPI calculations and time-series aggregation
  ui.js             DOM rendering (cards, table, cohort grid)
  charts.js         Chart.js wrappers
css/
  style.css         ServiceTrade brand styles
data/
  files.json        Optional manifest listing current export filenames
  schema.md         Column definitions
  sample/           Reference CSVs (representative production exports)
```

## `data/files.json` (optional)

If present, this manifest is loaded first and used to discover data files instead of hardcoded filename discovery. Format:

```json
[
  { "name": "Conversion_Rate_2026-06-08.csv" },
  { "name": "Idle_Quotes_2026-06-08.csv" },
  { "name": "Quotes_per_User_2026-06-08.csv" },
  { "name": "Time_to_Quote_2026-06-08.csv" }
]
```

Update this file each week alongside the CSV drop.
