## AzureCostPilot – Cost Integration Guide (Azure, AWS, GCP, MongoDB)

### High‑level explanation
AzureCostPilot collects month‑to‑date cloud spend from Azure, AWS, GCP and MongoDB Atlas, normalizes everything to USD, and shows a unified total and provider views in a single dashboard. Costs are fetched via provider APIs or stored entries, aggregated server‑side in UTC month windows, then rendered in the UI.

### Scope
This document explains how AzureCostPilot collects month‑to‑date (MTD) costs from Azure, AWS, GCP, and MongoDB Atlas, how the unified total is computed, what endpoints are exposed, and how the dashboard surfaces the data.

### High‑level flow
1) Credentials are provided via environment variables (.env) or cloud SDK defaults.
2) Provider‑specific collectors normalize costs to USD and persist records in the local store (`cost_data`).
3) The unified MTD total endpoint sums Azure + AWS + GCP + MongoDB for the current UTC month.
4) The dashboard Total view calls the unified endpoint and renders the total and a simple breakdown.

### Time window and currency
- Window: current calendar month in UTC, inclusive of the first day and exclusive of the first day of next month (\[YYYY‑MM‑01, next‑01)).
- Currency: USD for all providers.
- Rounding: the server sums internal full‑precision amounts, then rounds the final `total` to 2 decimals. Component values are also returned rounded to 2 decimals and (for diagnostics) in full precision.

### Environment variables (by provider)
Azure
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`
- `AZURE_INR_TO_USD_RATE` (optional) – used to convert Azure costs reported in INR to USD when normalizing.

MongoDB Atlas
- `MONGODB_PUBLIC_KEY`, `MONGODB_PRIVATE_KEY`, `MONGODB_ORG_ID` (and optionally `MONGODB_PROJECT_ID`)
  - Used to retrieve MTD usage via Cost Explorer endpoints. If CE is unavailable, the app falls back to stored `cost_data` entries for MongoDB.

AWS
- Uses AWS SDK default credential chain (env variables, profiles, or instance roles). No special app‑specific vars are required in most setups.

GCP
- Requires a BigQuery export of billing data. Variables depend on your setup and are read by `server/gcp.ts` (e.g., project, dataset, and table identifiers). Ensure your service account has the necessary BigQuery read permissions.

### Where the logic lives
Below sections detail per provider. Quick map:
- Azure: `server/routes.ts` (ingestion helpers) + `storage` (persists `cost_data`).
- MongoDB Atlas: `server/routes.ts` CE endpoints + fallbacks, and `scripts/fetch_mongo_cost.sh` for helper path.
- AWS: `server/aws.ts` exposes `/api/aws/mtd-summary`, `/api/aws/mtd-services`, `/api/aws/mtd-regions`.
- GCP: `server/gcp.ts` exposes `/api/gcp/mtd-summary`, `/api/gcp/mtd-services`.
- Total: `server/routes.ts` → `/api/total/mtd-usd` (sums the four).

---

## Azure
- Files
  - `server/routes.ts` (Azure ingestion logic: `fetchAzureCostData`, normalization, storage)
  - `server/storage.ts` (persists normalized USD rows to `cost_data`)
- Concept used
  - Azure Cost Management API for daily usage; results may be in INR and are converted to USD using `AZURE_INR_TO_USD_RATE`.
  - Stored rows enable fast MTD sum and historical trends.
- Credentials
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`
  - Optional: `AZURE_INR_TO_USD_RATE` for INR→USD normalization

## MongoDB Atlas
- Files
  - `server/routes.ts` endpoints: `/api/mongodb/mtd-usage`, `/api/mongodb/ce-init`, `/api/mongodb/ce-usage/:token`
  - `scripts/fetch_mongo_cost.sh` (helper script for CE)
- Concept used
  - Cost Explorer (two‑step POST→token, then GET result with polling) for authoritative MTD USD.
  - Fallback to stored `cost_data` entries when CE is unavailable.
- Credentials
  - `MONGODB_PUBLIC_KEY`, `MONGODB_PRIVATE_KEY`, `MONGODB_ORG_ID` (optionally `MONGODB_PROJECT_ID`)

## GCP
- Files
  - `server/gcp.ts` (provider summaries: `/api/gcp/mtd-summary`, `/api/gcp/mtd-services`)
- Concept used
  - BigQuery export of GCP billing; queries aggregate MTD USD per service and total.
- Credentials
  - GCP service account with BigQuery read access; environment variables for project/dataset/table as configured in `server/gcp.ts`.

## AWS
- Files
  - `server/aws.ts` (provider summaries: `/api/aws/mtd-summary`, `/api/aws/mtd-services`, `/api/aws/mtd-regions`)
- Concept used
  - AWS Cost Explorer via AWS SDK; endpoint aggregates MTD USD total/services/regions.
- Credentials
  - AWS SDK default chain (env/profiles/instance role). No extra app‑specific vars required.

## Total cost (sum and display)
- Files
  - `server/routes.ts` → `GET /api/total/mtd-usd`
  - `client/src/components/dashboard/total-view.tsx` renders the Total card
- How it sums
  - Azure: sum stored USD rows for the UTC month window.
  - AWS: read from `/api/aws/mtd-summary`.
  - GCP: read from `/api/gcp/mtd-summary`.
  - MongoDB: prefer `/api/mongodb/mtd-usage`; fallback to stored USD rows if CE unavailable.
  - Return components, `total` (rounded), and `precise`/`window` diagnostics.

## Let Me Help (Agent)
- Files
  - `server/agent.ts` → `POST /api/agent/suggest`
  - Called from dashboard “Let Me Help” view
- Concept used
  - Builds a provider MTD summary (USD, top services) and either:
    - returns rule‑based recommendations (default), or
    - calls OpenAI (if `OPENAI_API_KEY` set) to generate short optimization suggestions structured as JSON.
- What it returns
  - `{ summary: { provider, mtdTotal, start, end }, recommendations: [...], metadata }`


### Unified total endpoint
`GET /api/total/mtd-usd`
- Response:
```
{
  "currency": "USD",
  "azure": 12.34,
  "aws": 5.67,
  "mongodb": 1.23,
  "gcp": 2.73,
  "total": 21.97,
  "start": "YYYY-MM-01",
  "end": "YYYY-MM-01", // exclusive next-month first day
  "precise": { "azure": 12.340123, "aws": 5.67, "mongodb": 1.23, "gcp": 2.7299, "total": 21.970023 },
  "window": { "timezone": "UTC", "startUtc": "YYYY-MM-01T00:00:00.000Z", "endExclusiveUtc": "YYYY-MM-01T00:00:00.000Z", "startDate": "YYYY-MM-01", "endDateExclusive": "YYYY-MM-01" }
}
```

### How each provider’s cost is fetched
Azure
- Source: Azure Cost Management API.
- Normalization: values reported in INR are converted using `AZURE_INR_TO_USD_RATE` (default fallback exists) and saved as USD in `cost_data`.
- Storage: per‑day entries are stored; MTD totals are produced by summing daily USD entries.

MongoDB Atlas
- Primary: Cost Explorer two‑step flow (token + polling) via `MONGODB_PUBLIC_KEY`/`MONGODB_PRIVATE_KEY`/`MONGODB_ORG_ID`.
- Fallback: when CE is unavailable, the app uses the stored `cost_data` entries for MongoDB.

AWS
- Aggregated via provider endpoint `/api/aws/mtd-summary` using AWS SDK credentials available to the server.

GCP
- Aggregated via provider endpoint `/api/gcp/mtd-summary` by querying the configured BigQuery export table.

### Dashboard surfaces
- Total view component (`client/src/components/dashboard/total-view.tsx`) calls `GET /api/total/mtd-usd` and displays the MTD total and a basic breakdown.
- Provider‑specific views/tables display entries coming from the stored `cost_data` and provider summaries.

### Testing & verification
Quick commands (run from project root):
```
curl -sS http://127.0.0.1:${PORT:-9003}/api/total/mtd-usd | jq .
curl -sS http://127.0.0.1:${PORT:-9003}/api/aws/mtd-summary | jq .
curl -sS http://127.0.0.1:${PORT:-9003}/api/gcp/mtd-summary | jq .
curl -sS http://127.0.0.1:${PORT:-9003}/api/mongodb/mtd-usage | jq .

echo "Refreshing…" && curl -sS -X POST http://127.0.0.1:${PORT:-9003}/api/refresh-cost-data | jq .
curl -sS http://127.0.0.1:${PORT:-9003}/api/total/mtd-usd | jq .
```

### Troubleshooting
- Different totals than expected: verify the `window` in the response (UTC month). Ensure your manual sum uses the same boundary dates.
- Azure conversion: confirm `AZURE_INR_TO_USD_RATE` matches finance expectations; totals will differ if a different rate is used.
- MongoDB Atlas CE blocked or zero: the server falls back to stored entries. Check `api/mongodb/mtd-usage` and refresh stored data.
- Staleness: run `POST /api/refresh-cost-data` to re‑ingest Azure/MongoDB entries before querying totals.

### Notes
- OpenAI Billing (Total Spend) is not included because OpenAI does not expose a supported server‑to‑server billing API for API keys. If needed later, consider an Estimated Spend calculator from Usage, or a human‑assisted capture workflow outside of the server.


## End‑to‑End Request Flow (How a request goes in and comes out)

### A) Total MTD (USD) as shown in the Dashboard → Total view

1) User opens the dashboard Total view
   - Component: `client/src/components/dashboard/total-view.tsx`
   - It issues `GET /api/total/mtd-usd` (fetch, JSON).

2) Server receives `GET /api/total/mtd-usd`
   - File: `server/routes.ts`
   - The handler computes the current UTC month window: `start = YYYY‑MM‑01`, `end = next‑month‑01`.

3) Server fetches provider components for that window
   - Azure: Sums stored `cost_data` entries with `provider === 'azure'` in USD.
   - AWS: Calls internal provider endpoint `GET /api/aws/mtd-summary` and reads `total`.
   - GCP: Calls internal provider endpoint `GET /api/gcp/mtd-summary` and reads `total`.
   - MongoDB:
     - First tries `GET /api/mongodb/mtd-usage` (Cost Explorer workflow). If it returns a positive amount, use that.
     - Otherwise falls back to summing stored `cost_data` entries with `provider === 'mongodb'`.

4) Server unifies and returns the total
   - It rounds the exposed components to 2 decimals and sums them to `total`.
   - It also returns a `precise` object with full‑precision values and a `window` object with exact UTC timestamps for reconciliation.

5) Client renders the result
   - The Total card shows `total` and may show a simple provider breakdown.

Sequence (abridged)
```
TotalView (client)
  └─ GET /api/total/mtd-usd
       ├─ (server) compute UTC month window
       ├─ (server) azure = sum(cost_data.azure)
       ├─ (server) aws   = GET /api/aws/mtd-summary
       ├─ (server) gcp   = GET /api/gcp/mtd-summary
       ├─ (server) mongodb = GET /api/mongodb/mtd-usage (fallback sum(cost_data.mongodb))
       └─ (server) return { azure, aws, gcp, mongodb, total, precise, window }
```

### B) Refresh flow (to keep stored `cost_data` up‑to‑date)

1) User triggers a refresh (or it happens on app load)
   - Component/hook: `use-cost-data.tsx` → `POST /api/refresh-cost-data`.

2) Server performs provider ingestions
   - Azure: `fetchAzureCostData(spn)` queries Azure Cost Management API for last ~30 days, normalizes to USD, writes per‑day entries into `cost_data`.
   - MongoDB: Attempts Cost Explorer MTD retrieval; if successful, stores a monthly entry; otherwise tries usage/invoice fallbacks and writes daily or monthly entries accordingly.
   - (AWS/GCP use provider endpoints at read time and don’t write `cost_data` here.)

3) Server recomputes the latest summary (optional helper)
   - `updateCostSummary()` collapses stored entries into today’s totals for overview widgets.

4) Client invalidates queries and re‑fetches
   - The dashboard components refresh and the Total view recomputes MTD totals using the new data.

### C) Error handling and resilience
- If a provider endpoint fails (e.g., MongoDB CE unavailable), the total endpoint uses the fallback (stored entries) so the Total view still renders.
- All provider numeric parsing uses safe guards; non‑numeric values are treated as 0.
- Azure currency normalization: if the Azure API returns INR, amounts are converted using `AZURE_INR_TO_USD_RATE` and stored as USD to keep downstream math simple and consistent.

### D) Why totals might differ from manual spreadsheets
- Timezone: the server uses UTC month boundaries; ensure manual sums use the same window.
- Freshness: run `POST /api/refresh-cost-data` before checking totals to minimize staleness.
- Rounding: the API returns a `precise` section for exact component values before final rounding.


