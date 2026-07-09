# Battery Revenue Mini-Dashboard

Runnable full-stack skeleton for a battery revenue dashboard. Business rules,
revenue calculations, persistence, and production infrastructure are
intentionally out of scope at this stage.

## Structure

```text
.
├── backend/
│   ├── app/
│   │   └── main.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── types/
    │   └── utils/
    └── package.json
```

## Prerequisites

- Python 3.11+
- Node.js 22.12+

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`, with interactive documentation
at `http://localhost:8000/docs` and a health check at
`http://localhost:8000/api/health`.

The backend expects its input data at `backend/take-home-data.json` and loads it
once at startup. Dashboard endpoints:

- `GET /strike-matrix`
- `GET /pnl-curve?term=...&merchantPct=...&cycling=...&profile=...`

## Nearest priced-cell rule

The UI preserves the user's requested terms. When that exact combination is
absent from the strike matrix, it displays the nearest row that has a finite
`pricePerMwYr`; it never calculates or invents a replacement price.

Candidate distance is calculated as:

```text
abs(candidate.term - requested.term)
+ abs(candidate.merchantPct - requested.merchantPct)
+ abs(candidate.cycling - requested.cycling) * 10
+ (candidate.profile === requested.profile ? 0 : 100)
```

The candidate with the lowest total distance is used. If multiple candidates
have the same distance, the first row returned by `/strike-matrix` wins. An
exact row with malformed `pricePerMwYr` is reported as invalid data rather than
silently replaced.

## Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:5173`.

To use a different API origin, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

## Production build

```bash
cd frontend
npm run build
```
# Battery-dashboard
