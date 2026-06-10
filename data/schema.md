# Data Schema

Files in `/data/` are loaded automatically at page load. Drop new exports here and refresh.

## Filename Convention

```
{MetricName}_YYYY-MM-DD.csv
```

The date is the report run date and is parsed from the filename to label the dataset.
**Never overwrite an existing file** — always use a new date-stamped name (GitHub Pages caches by URL).

## CSV Files (Snowflake exports)

### `Conversion_Rate_YYYY-MM-DD.csv`

| Column | Type | Notes |
|---|---|---|
| ACCOUNT_ID | string | Tenant identifier |
| USER_NAME | string | May have trailing spaces — trimmed on parse |
| DEFICIENCY_WEEK | ISO 8601 timestamp | Week start; parsed as UTC Monday |
| TOTAL_DEFICIENCY_QUOTES | number | Deficiencies eligible to be quoted |
| SUBMITTED_QUOTES | number | Quotes actually submitted |
| CONVERSION_RATE_PCT | number | Pre-calculated 0–100; not used for aggregate calc |

### `Idle_Quotes_YYYY-MM-DD.csv`

Snapshot — no week column. Represents current state at report run date.

| Column | Type | Notes |
|---|---|---|
| ACCOUNT_ID | string | |
| USER_NAME | string | |
| IDLE_QUOTES | number | |
| AVG_IDLE_AGE_DAYS | float | Weighted in KPI calculation |
| MAX_IDLE_AGE_DAYS | float | |

### `Quotes_per_User_YYYY-MM-DD.csv`

| Column | Type | Notes |
|---|---|---|
| ACCOUNT_ID | string | |
| USER_NAME | string | |
| QUOTE_WEEK | ISO 8601 timestamp | Week start; parsed as UTC Monday |
| TOTAL_QUOTES | number | All quotes created that week |
| STELLA_QUOTES | number | Subset that used Stella |

### `Time_to_Quote_YYYY-MM-DD.csv`

| Column | Type | Notes |
|---|---|---|
| ACCOUNT_ID | string | |
| USER_NAME | string | |
| DEFICIENCY_WEEK | ISO 8601 timestamp | Week start |
| DEFICIENCIES_QUOTED | number | Used as weight in KPI |
| AVG_DAYS_TO_QUOTE | float | Negative values floored to 0 on parse |
| MIN_DAYS_TO_QUOTE | float | |
| MAX_DAYS_TO_QUOTE | float | |

## CloudWatch Files (optional)

Used for the **Continued vs. Abandoned** donut chart and **Daily Activity** bar chart.

- **HTML export** (e.g., `stella-quote-feedback-report.html`) — the embedded `EVENTS` array is extracted automatically.
- **JSON export** — a raw array of event objects with fields: `ts`, `event` (`CONTINUED`|`ABANDONED`), `account`, `jobId`, `quoteId`.

## Filtered Accounts & Users

The following are always excluded from all metrics and tables:

**Excluded account IDs:** `46`, `666`, `4393`

**System users (excluded by name):**
- `Service Database Admin`
- `ServiceTrade Support`
- `ServiceTrade Support User (Do Not Delete)`
- `automation user`
