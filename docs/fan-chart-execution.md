# Fan chart execution notes

This document explains how the follow-up fan chart work was executed, what changed in the repo, how the data was shaped, and which references were used to understand and implement the chart.

## Objective

The original dashboard showed a P&L distribution at one point in time. The follow-up brief changed the required chart to a fan chart: a year-by-year forecast distribution across the contract term.

The required chart needed to show:

- A median forecast line at `p50`.
- An inner uncertainty band from `p25` to `p75`.
- An outer uncertainty band from `p10` to `p90`.
- A visible handoff from historical/anchored values into forecast values.
- A legend, labelled axes, and hover detail that exposes the percentile values.

## What we built

The implementation extends the existing full-stack dashboard instead of creating a separate chart prototype.

- Backend still loads static JSON at startup.
- The dataset was extended to `backend/take-home-data-v2.json`.
- Existing deal-term selectors continue to drive the chart.
- The frontend calls a dedicated fan-curve endpoint for the selected priced cell.
- The chart is rendered as a custom D3 SVG fan chart.
- The dashboard layout was tightened into a SaaS-style layout with compact price, term filters, and chart content.

## Data shaping

The candidate brief said the v2 data file should keep the original keys and add `fanCurves` and `cashflows`, keyed by the same deal-term lookup key:

```text
term|merchantPct|cycling|profile
```

Because the external `take-home-data-v2.json` attachment was not available locally, the v2 file was generated from the available pricing matrix and P&L curve data.

The generated v2 structure keeps:

- `strikeMatrix`
- `pnlCurves`

And adds:

- `fanCurves`
- `cashflows`

For each priced cell, `fanCurves` includes:

- `asOf`
- `strikePerMwYr`
- `term`
- historical year metadata
- forecast year metadata
- a historical line series
- yearly percentile bands

The important modelling choice is that the fan bands do not appear as disconnected red blocks. Each band is anchored at the final historical/current-year value, then widens across the forecast horizon. That creates the correct visual handoff from a known or anchored value into an increasingly uncertain forecast range.

## Backend execution

The backend remains intentionally thin. It does not calculate pricing in request handlers.

Implemented API shape:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/strike-matrix` | Returns selectable deal-term rows. |
| `GET /api/pnl-curve` | Returns the original P&L curve for an exact priced cell. |
| `GET /api/fan-curve` | Returns yearly fan chart percentile bands for an exact priced cell. |
| `GET /api/cashflow` | Returns optional yearly cashflow projection rows. |

Lookup remains deterministic through the shared key:

```text
term|merchantPct|cycling|profile
```

If a requested key is absent from `fanCurves` or `cashflows`, the backend returns a clear `404` instead of silently inventing data.

## Frontend execution

The frontend flow is:

1. Load the strike matrix.
2. Let the user select term, merchant percentage, cycling, and profile.
3. Resolve the displayed priced cell.
4. Fetch the matching fan curve.
5. Render the fan chart from the returned history and percentile bands.

The chart implementation is in:

```text
frontend/src/components/FanCurveChart.tsx
```

The chart uses D3 for:

- Linear X/Y scales.
- Median line path generation.
- Area path generation for the fan bands.
- Smooth monotone curves.
- SVG coordinate mapping for hover pins.

The visible chart elements are:

- Historical/anchored line before the forecast handoff.
- Forecast median line.
- Outer `p10`–`p90` fan band.
- Inner `p25`–`p75` fan band.
- Dashed current-year handoff line.
- Strike reference line.
- Legend.
- Hover pins and tooltip values.

## Why D3 was selected

Highcharts and SciChart were useful visual references, but D3 is a better fit for this implementation because we needed direct control over the SVG structure, calendar-year timeline, handoff marker, custom pins, compact layout, and styling.

Tradeoff:

- D3 gives maximum control and avoids a commercial chart dependency.
- D3 requires more custom chart code than Highcharts or SciChart.

For this take-home exercise, that is a reasonable tradeoff because the chart is the central product artifact and the implementation needs to be easy to explain in a walkthrough.

## Reference links used

Primary project reference:

- Local candidate brief: `backend/take-home-2-fan-chart-CANDIDATE.md`

Charting and implementation references:

- D3 official documentation: https://d3js.org/
- D3 linear scales: https://d3js.org/d3-scale/linear
- D3 shape generators: https://github.com/d3/d3-shape/blob/main/README.md
- Highcharts fan chart demo: https://www.highcharts.com/demo/highcharts/fan-chart
- SciChart React fan chart demo: https://www.scichart.com/demo/react/fan-chart

Fan chart / uncertainty communication reference:

- BIS paper, “Fan Chart: The art and science of communicating uncertainty”: https://www.bis.org/ifc/publ/ifcb43_zm.pdf

## How to explain the chart

The chart answers: “How does the expected P&L range evolve over the life of the contract?”

- The solid historical line shows the values leading into the current year.
- The dashed vertical line marks the handoff from history or anchored current-year value into forecast.
- The median line shows the central expected case, `p50`.
- The inner shaded band, `p25`–`p75`, contains the middle 50% of modelled outcomes.
- The outer shaded band, `p10`–`p90`, contains a wider plausible outcome range.
- The fan widens over time because forecast uncertainty compounds the further out the model projects.

In a capital-partner conversation, the key point is not just the median. The bands show downside and upside risk around that median over the full contract term.

## Verification

The frontend production build was run after the D3 fan chart work:

```bash
cd frontend
npm run build
```

The build completed successfully.

## Known tradeoffs and next improvements

- The v2 data was generated locally because the supplied external JSON attachment was not available in the repo.
- The cashflow endpoint exists, but the optional cashflow chart has not been prioritized over the required fan chart.
- The D3 chart is custom SVG, so production accessibility and browser-level chart tests should be added next.
- Backend response models should be formalized with Pydantic if this becomes more than a take-home prototype.
- The generated fan data should be replaced with the real pricing model output once available.
