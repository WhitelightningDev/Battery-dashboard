# Battery Revenue Mini-Dashboard

A small full-stack pricing dashboard for exploring battery revenue deal terms.
Users select term, merchant percentage, cycling, and profile values; the
dashboard displays the applicable annual price per MW and a P&L curve across
the contract term as a percentile fan chart.

The implementation is designed to be honest about imperfect source data:

- Numeric API values are validated before use.
- Malformed prices such as `"138too"` are never rendered as prices.
- Unpriced combinations snap to a real, nearby priced matrix cell.
- Requested terms and displayed priced terms remain visible.
- Loading, missing, empty, malformed, and API-error states are explicit.
- Stale fan-curve requests cannot overwrite a newer selection.

## Technology

- Backend: Python, FastAPI, Uvicorn
- Frontend: TypeScript, React 19, Vite
- Charting: D3 SVG fan chart
- Data source: `backend/take-home-data-v2.json`

## Prerequisites

- Python 3.11+
- Node.js 22.12+

## Run the backend

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API runs at `http://localhost:8000`. FastAPI documentation is available at
`http://localhost:8000/docs`.

The backend loads `backend/take-home-data-v2.json` once at startup. Restart the
backend after changing that file.

## Run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

The default API origin is `http://localhost:8000`. Override it with
`frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Production builds default to the same-origin `/api` service route. Do not set a
deployed `VITE_API_BASE_URL` to `localhost`; either omit it or set it to `/api`.

Build the production bundle with:

```bash
cd frontend
npm run build
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Returns API health status. |
| `POST` | `/api/runs` | Creates an in-memory run in the `queued` state. |
| `GET` | `/api/runs/{id}` | Returns the current `queued`, `running`, or `complete` run state. |
| `GET` | `/api/strike-matrix` | Returns available deal-term rows and `pricePerMwYr`. |
| `GET` | `/api/pnl-curve?term={term}&merchantPct={pct}&cycling={cycling}&profile={profile}` | Returns `asOf`, `strikePerMwYr`, and P&L points for an exact priced cell. |
| `GET` | `/api/fan-curve?term={term}&merchantPct={pct}&cycling={cycling}&profile={profile}` | Returns `asOf`, `strikePerMwYr`, `term`, and yearly P10/P25/P50/P75/P90 bands for an exact priced cell. |
| `GET` | `/api/cashflow?term={term}&merchantPct={pct}&cycling={cycling}&profile={profile}` | Returns yearly contracted, merchant, opex, and cumulative net rows for an exact priced cell. |

`/fan-curve`, `/cashflow`, and `/pnl-curve` return `404` when the exact lookup
key is absent. The frontend distinguishes missing fan-curve data from transport
errors and valid responses with no annual bands.

## Charting library choice

The current fan chart is a custom D3-driven SVG implementation. Highcharts and
SciChart were used as visual references, but D3 was selected for direct control
over the calendar-year timeline, historical-to-forecast handoff, percentile
bands, hover pins, legend, and compact dashboard styling without adding a
commercial chart dependency.

The chart shows:

- Calendar year on the X-axis.
- P&L per MW per year on the Y-axis.
- `p10`–`p90` as the outer uncertainty band.
- `p25`–`p75` as the inner uncertainty band.
- `p50` as the median forecast line.
- `strikePerMwYr` as a dashed reference line.
- Yearly percentile values and strike in the hover tooltip.

Tradeoff: D3 gives stronger control over the product-specific chart behavior,
but requires more custom SVG code than a packaged charting library.

See [`docs/fan-chart-execution.md`](docs/fan-chart-execution.md) for execution
notes and the reference links used to understand and implement the fan chart.

## Nearest-cell snapping

The selector preserves the user's requested terms. If that exact combination
does not exist in the strike matrix, the frontend displays the nearest matrix
row that contains a finite `pricePerMwYr`. It uses the real price and P&L curve
for that displayed cell; it never interpolates or invents a price.

Distance is calculated as:

```text
abs(candidate.term - requested.term)
+ abs(candidate.merchantPct - requested.merchantPct)
+ abs(candidate.cycling - requested.cycling) * 10
+ (candidate.profile === requested.profile ? 0 : 100)
```

The candidate with the lowest total distance wins. Equal-distance ties use the
first matching row returned by `/strike-matrix`, making the result deterministic.
Rows with malformed or non-finite prices are not snapping candidates.

An exact matrix row with a malformed price is reported as invalid data instead
of being silently replaced. This keeps data-quality failures visible.

## Time-box tradeoffs

- Data is read from a static JSON file rather than a database or pricing
  service.
- The v2 fan/cashflow data is generated locally from the original P&L curves
  because the external `take-home-data-v2.json` attachment was unavailable.
- Optional run records are process-local and disappear when the backend
  restarts; their queued/running/complete lifecycle is simulated by elapsed
  time.
- Backend response shapes use the supplied data directly instead of explicit
  Pydantic response models.
- Runtime validation uses small purpose-built TypeScript helpers rather than a
  schema library such as Zod.
- Server state is managed with React effects and abort/request guards rather
  than React Query or SWR.
- Snapping is performed client-side because the matrix is small and already
  required by the selector flow.
- CORS is configured for local Vite origins only.
- There is no authentication, persistence, caching, telemetry, or deployment
  configuration.
- Verification currently relies on strict TypeScript compilation and the
  production Vite build; automated tests were not added within the time box.

These choices keep the implementation reviewable and runnable without hiding
the boundaries of the prototype.

## AI tools used

OpenAI Codex was used as an implementation assistant for:

- Inspecting the repository and tracing the frontend/backend data contract.
- Building the typed API client, selector flow, snapping logic, and fan chart.
- Adding defensive numeric parsing and asynchronous stale-response protection.
- Running TypeScript and production-build verification.
- Structuring and reviewing this README.

No AI model is called by the application at runtime. Product and architecture
decisions remain explicit in the source code and this documentation.

## What to improve next

1. Add automated tests for numeric parsing, nearest-cell distance and ties,
   malformed prices, missing curves, empty points, and request races.
2. Add Pydantic request/response models and generate frontend types from the
   OpenAPI schema to remove duplicated contracts.
3. Validate the complete JSON dataset at backend startup and report every
   invalid row with its lookup key.
4. Move pricing data behind a versioned database or managed pricing service,
   with audit history and effective dates.
5. Add React Query for caching, retries, request deduplication, and clearer
   server-state ownership.
6. Add focused chart tests for malformed percentile bands, missing years, and
   empty fan curves.
7. Add structured logs, frontend error reporting, API metrics, CI checks, and
   deployment configuration.
8. Add browser-level accessibility and responsive-layout tests.
