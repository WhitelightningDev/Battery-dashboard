# Basis Energy — Follow-up Exercise: P-Value Fan Chart

*Short follow-up to the Battery Revenue Mini-Dashboard. Time-box: **2–3 hours**. Companion data: `take-home-data-v2.json`.*

## Context

The chart you built plots the P&L distribution at a **single point in time** — percentile on the x-axis, one line. The chart our capital partners actually read is a **fan chart**: the same distribution shown **across the contract term**, so you can see the range of outcomes widen as the forecast horizon extends.

That is the single most important chart in our product. This exercise is that chart.

## What a fan chart is

- **X-axis:** year, `1 … term`.
- **Y-axis:** P&L per MW per year.
- **A median line** at `p50`.
- **Two shaded bands** around it: the `p25`–`p75` inner band, and the `p10`–`p90` outer band. The bands widen with the horizon.
- Optionally, the contract **strike** as a reference line.

## The data

`take-home-data-v2.json` extends the file you already have. It keeps `strikeMatrix` and `pnlCurves` unchanged, and adds two new blocks — both keyed by the same `term|merchantPct|cycling|profile` (e.g. `15|20|1.5|flat`):

**`fanCurves`** — the per-year distribution for each priced cell:
```json
{
  "asOf": "2026-06-01",
  "strikePerMwYr": 152100,
  "term": 15,
  "bands": [
    { "year": 1, "p10": 120900, "p25": 135800, "p50": 152100, "p75": 168400, "p90": 183300 },
    { "year": 2, "p10": 121500, "p25": 137400, "p50": 155100, "p75": 172800, "p90": 188700 }
  ]
}
```

**`cashflows`** — the per-year cashflow projection for each priced cell:
```json
{
  "asOf": "2026-06-01",
  "term": 15,
  "rows": [
    { "year": 1, "contracted": 121700, "merchant": 30400, "opex": -24000, "cumulativeNet": 128100 }
  ]
}
```

## Build

Extend your existing `Battery-dashboard` repo — reuse the backend, the selector, and the API client you already have.

1. **Two new endpoints**, serving the blocks above for the selected deal terms:
   - `GET /fan-curve?term=..&merchantPct=..&cycling=..&profile=..`
   - `GET /cashflow?term=..&merchantPct=..&cycling=..&profile=..`

2. **The fan chart (required).** For the selected cell: the `p50` median line with the `p25`–`p75` and `p10`–`p90` bands shaded around it, across the full term. Labelled axes with units, a legend, and a hover that shows the percentile values for that year. It has to be legible to a fund manager, not just correct.

3. **The cashflow chart (optional, only if time allows).** Per-year stacked `contracted` + `merchant` + `opex`, with `cumulativeNet` as a line on a secondary axis. Note that `opex` is negative.

## A note on the numbers

Treat this as production data: it is realistic, and it is not guaranteed to be clean. A number that renders as though it were correct when it is not is the worst outcome in our product — an analyst may be reading it aloud to a customer. Surfacing *"this doesn't look right"* is worth more to us than a chart that quietly draws something wrong.

## Not required

Auth, routing, persistence, tests, branding, polish beyond clarity. Reuse whatever you already built. Use your AI tooling as you normally would — that's how we work too.

## How we'll assess it

We'll book a **short call to walk through it together**. We're less interested in the code than in how you think about the chart: what the bands mean, why the fan widens, how you shaped the data, and anything about the dataset that gave you pause.

Send the repo link when you're done.
