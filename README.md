# Battery Revenue Mini-Dashboard

A small full-stack pricing dashboard for exploring battery revenue deal terms.
Users select term, merchant percentage, cycling, and profile values; the
dashboard displays the applicable annual price per MW and a P&L curve across
P-value percentiles.

The implementation is designed to be honest about imperfect source data:

- Numeric API values are validated before use.
- Malformed prices such as `"138too"` are never rendered as prices.
- Unpriced combinations snap to a real, nearby priced matrix cell.
- Requested terms and displayed priced terms remain visible.
- Loading, missing, empty, malformed, and API-error states are explicit.
- Stale P&L requests cannot overwrite a newer selection.

## Technology

- Backend: Python, FastAPI, Uvicorn
- Frontend: TypeScript, React 19, Vite
- Charting: Recharts
- Data source: `backend/take-home-data.json`

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

The backend loads `backend/take-home-data.json` once at startup. Restart the
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

Build the production bundle with:

```bash
cd frontend
npm run build
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Returns API health status. |
| `GET` | `/strike-matrix` | Returns available deal-term rows and `pricePerMwYr`. |
| `GET` | `/pnl-curve?term={term}&merchantPct={pct}&cycling={cycling}&profile={profile}` | Returns `asOf`, `strikePerMwYr`, and P&L points for an exact priced cell. |

`/pnl-curve` returns `404` when its exact lookup key is absent. The frontend
distinguishes that missing-curve case from transport errors and valid responses
with no points.

## Charting library choice

Recharts was selected because it provides responsive React-native chart
components, typed composition, tooltips, reference lines, and axis formatting
without requiring a custom SVG chart implementation.

The chart shows:

- `p` on the X-axis as the P value / percentile.
- `pnlPerMwYr` on the Y-axis in USD per MW per year.
- `pnlPerMwYr` as the primary line.
- `strikePerMwYr` as a dashed reference line.
- Exact P value and formatted P&L in the tooltip.

Tradeoff: Recharts materially increases the frontend bundle size. The current
build reports a non-blocking chunk-size warning; route or component-level lazy
loading would be appropriate if the application grows.

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
first matching row returned by `/strike-matrix`, making the result
deterministic. Rows with malformed or non-finite prices are not snapping
candidates.

An exact matrix row with a malformed price is reported as invalid data instead
of being silently replaced. This keeps data-quality failures visible.

## Time-box tradeoffs

- Data is read from a static JSON file rather than a database or pricing
  service.
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
- Building the typed API client, selector flow, snapping logic, and chart.
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
6. Lazy-load or isolate the Recharts bundle as more dashboard routes are added.
7. Add structured logs, frontend error reporting, API metrics, CI checks, and
   deployment configuration.
8. Add browser-level accessibility and responsive-layout tests.
