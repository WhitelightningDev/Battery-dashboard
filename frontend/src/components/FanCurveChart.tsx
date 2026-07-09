import {
  area,
  curveMonotoneX,
  line,
  max,
  min,
  scaleLinear,
} from "d3";
import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { FanBandPoint, FanCurveState, FanHistoryPoint } from "../types";
import { formatCompactCurrency, formatCurrency } from "../utils";

interface FanCurveChartProps {
  curveState: FanCurveState;
}

interface LinePoint {
  year: number;
  value: number;
  kind: "history" | "forecast";
}

interface BandPoint {
  year: number;
  low: number;
  high: number;
}

interface HoverPoint {
  year: number;
  x: number;
  y: number;
  value: number;
  pins: Array<{
    label: string;
    value: number;
    y: number;
    className: string;
  }>;
  band?: FanBandPoint;
  kind: "history" | "forecast";
}

interface FanChartModel {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  plotWidth: number;
  plotHeight: number;
  historyEndYear: number;
  forecastStartYear: number;
  forecastEndYear: number;
  yTicks: Array<{
    value: number;
    y: number;
  }>;
  xTicks: Array<{
    value: number;
    x: number;
  }>;
  outerPath: string;
  innerPath: string;
  medianPath: string;
  strikePath: string;
  hoverPoints: HoverPoint[];
  currentYearX: number;
  forecastStartX: number;
  forecastWidth: number;
  strikeY: number;
}

const chartWidth = 960;
const chartHeight = 420;
const margin = {
  top: 24,
  right: 76,
  bottom: 52,
  left: 74,
};

function renderChartState(curveState: FanCurveState) {
  if (curveState.status === "loading") {
    return (
      <div className="chart-state" aria-live="polite" aria-busy="true">
        <span className="loading-spinner" aria-hidden="true" />
        <div>
          <h3>Loading fan chart</h3>
          <p>Retrieving annual percentile bands for the displayed priced cell.</p>
        </div>
      </div>
    );
  }

  if (curveState.status === "missing") {
    return (
      <div className="chart-state">
        <div>
          <h3>Fan chart not available</h3>
          <p>No fan curve exists for the displayed priced terms.</p>
        </div>
      </div>
    );
  }

  if (curveState.status === "empty") {
    return (
      <div className="chart-state">
        <div>
          <h3>No annual percentile bands</h3>
          <p>
            The fan curve response exists, but contains no bands to chart.
          </p>
        </div>
      </div>
    );
  }

  if (curveState.status === "error") {
    return (
      <div className="chart-state chart-state-error" role="alert">
        <div>
          <h3>Unable to load fan chart</h3>
          <p>{curveState.message}</p>
        </div>
      </div>
    );
  }

  return null;
}

function buildYearTicks(startYear: number, endYear: number): number[] {
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_value, index) => startYear + index,
  );
  const interval = years.length > 18 ? 2 : 1;

  return years.filter(
    (year, index) =>
      index === 0 || index === years.length - 1 || year % interval === 0,
  );
}

function buildFanChartModel(
  response: Extract<FanCurveState, { status: "ready" }>["response"],
): FanChartModel | null {
  const history: FanHistoryPoint[] = response.history;
  const forecastBands: FanBandPoint[] = response.bands;

  if (forecastBands.length === 0) {
    return null;
  }

  const asOfYear = new Date(response.asOf).getUTCFullYear();
  const historyEndYear =
    response.historyEndYear ?? history.at(-1)?.year ?? asOfYear;
  const historyStartYear =
    response.historyStartYear ?? history[0]?.year ?? historyEndYear;
  const forecastStartYear =
    response.forecastStartYear ?? historyEndYear + 1;
  const forecastEndYear =
    response.forecastEndYear ?? forecastStartYear + forecastBands.length - 1;
  const currentYearValue =
    history.at(-1)?.pnlPerMwYr ?? forecastBands[0]?.p50 ?? response.strikePerMwYr;
  const forecastYears = forecastBands.map(
    (_band, index) => forecastStartYear + index,
  );
  const historyLinePoints: LinePoint[] =
    history.length > 0
      ? history.map((point) => ({
          year: point.year,
          value: point.pnlPerMwYr,
          kind: "history",
        }))
      : [
          {
            year: historyEndYear,
            value: currentYearValue,
            kind: "history",
          },
        ];
  const forecastLinePoints: LinePoint[] = forecastBands.map((band, index) => ({
    year: forecastYears[index],
    value: band.p50,
    kind: "forecast",
  }));
  const linePoints = [...historyLinePoints, ...forecastLinePoints];
  const outerBandPoints: BandPoint[] = [
    { year: historyEndYear, low: currentYearValue, high: currentYearValue },
    ...forecastBands.map((band, index) => ({
      year: forecastYears[index],
      low: band.p10,
      high: band.p90,
    })),
  ];
  const innerBandPoints: BandPoint[] = [
    { year: historyEndYear, low: currentYearValue, high: currentYearValue },
    ...forecastBands.map((band, index) => ({
      year: forecastYears[index],
      low: band.p25,
      high: band.p75,
    })),
  ];
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const allYValues = [
    ...linePoints.map((point) => point.value),
    ...outerBandPoints.flatMap((point) => [point.low, point.high]),
    response.strikePerMwYr,
  ];
  const yMin = min(allYValues) ?? 0;
  const yMax = max(allYValues) ?? 0;
  const yPadding = Math.max((yMax - yMin) * 0.12, 12_000);
  const xScale = scaleLinear()
    .domain([historyStartYear, forecastEndYear])
    .range([0, plotWidth]);
  const yScale = scaleLinear()
    .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
    .range([plotHeight, 0])
    .nice();
  const linePath = line<LinePoint>()
    .x((point) => xScale(point.year))
    .y((point) => yScale(point.value))
    .curve(curveMonotoneX);
  const bandArea = area<BandPoint>()
    .x((point) => xScale(point.year))
    .y0((point) => yScale(point.low))
    .y1((point) => yScale(point.high))
    .curve(curveMonotoneX);
  const strikeLine = line<LinePoint>()
    .x((point) => xScale(point.year))
    .y((point) => yScale(point.value));
  const bandByYear = new Map(
    forecastBands.map((band, index) => [forecastYears[index], band]),
  );

  return {
    width: chartWidth,
    height: chartHeight,
    margin,
    plotWidth,
    plotHeight,
    historyEndYear,
    forecastStartYear,
    forecastEndYear,
    yTicks: yScale.ticks(5).map((value) => ({
      value,
      y: yScale(value),
    })),
    xTicks: buildYearTicks(historyStartYear, forecastEndYear).map((value) => ({
      value,
      x: xScale(value),
    })),
    outerPath: bandArea(outerBandPoints) ?? "",
    innerPath: bandArea(innerBandPoints) ?? "",
    medianPath: linePath(linePoints) ?? "",
    strikePath:
      strikeLine([
        {
          year: historyStartYear,
          value: response.strikePerMwYr,
          kind: "history",
        },
        {
          year: forecastEndYear,
          value: response.strikePerMwYr,
          kind: "forecast",
        },
      ]) ?? "",
    hoverPoints: linePoints.map((point) => ({
      year: point.year,
      x: xScale(point.year),
      y: yScale(point.value),
      value: point.value,
      kind: point.kind,
      band: bandByYear.get(point.year),
      pins: bandByYear.get(point.year)
        ? [
            {
              label: "P90",
              value: bandByYear.get(point.year)!.p90,
              y: yScale(bandByYear.get(point.year)!.p90),
              className: "d3-hover-pin-outer",
            },
            {
              label: "P75",
              value: bandByYear.get(point.year)!.p75,
              y: yScale(bandByYear.get(point.year)!.p75),
              className: "d3-hover-pin-inner",
            },
            {
              label: "P50",
              value: bandByYear.get(point.year)!.p50,
              y: yScale(bandByYear.get(point.year)!.p50),
              className: "d3-hover-pin-median",
            },
            {
              label: "P25",
              value: bandByYear.get(point.year)!.p25,
              y: yScale(bandByYear.get(point.year)!.p25),
              className: "d3-hover-pin-inner",
            },
            {
              label: "P10",
              value: bandByYear.get(point.year)!.p10,
              y: yScale(bandByYear.get(point.year)!.p10),
              className: "d3-hover-pin-outer",
            },
          ]
        : [
            {
              label: "Actual",
              value: point.value,
              y: yScale(point.value),
              className: "d3-hover-pin-median",
            },
          ],
    })),
    currentYearX: xScale(historyEndYear),
    forecastStartX: xScale(historyEndYear),
    forecastWidth: xScale(forecastEndYear) - xScale(historyEndYear),
    strikeY: yScale(response.strikePerMwYr),
  };
}

/** Render the fan chart using D3 scales and SVG paths. */
export function FanCurveChart({ curveState }: FanCurveChartProps) {
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);
  const response =
    curveState.status === "ready" && Array.isArray(curveState.response.bands)
      ? curveState.response
      : undefined;
  const chartModel = useMemo(
    () => (response ? buildFanChartModel(response) : null),
    [response],
  );

  function handlePointerMove(
    event: PointerEvent<SVGRectElement>,
    model: FanChartModel,
  ) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX =
      ((event.clientX - bounds.left) / bounds.width) * model.plotWidth;
    const nearestPoint = model.hoverPoints.reduce((nearest, point) =>
      Math.abs(point.x - pointerX) < Math.abs(nearest.x - pointerX)
        ? point
        : nearest,
    );

    setHoverPoint(nearestPoint);
  }

  return (
    <section className="chart-card chart-card-d3" aria-labelledby="fan-chart-title">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Forecast distribution</p>
          <h2 id="fan-chart-title">P&amp;L fan chart</h2>
        </div>
        <p className="chart-context">
          The solid line bridges the last 10 years into this year. The shaded
          fan begins next year and shows the forecast range ahead.
        </p>
      </div>

      <div className="d3-chart-legend" aria-label="Chart legend">
        <span>
          <i className="d3-legend-line d3-legend-median" aria-hidden="true" />
          Median p50
        </span>
        <span>
          <i className="d3-legend-band d3-legend-inner" aria-hidden="true" />
          p25-p75
        </span>
        <span>
          <i className="d3-legend-band d3-legend-outer" aria-hidden="true" />
          p10-p90
        </span>
        <span>
          <i className="d3-legend-line d3-legend-strike" aria-hidden="true" />
          Strike
        </span>
        <span>
          <i className="d3-legend-line d3-legend-current" aria-hidden="true" />
          This year
        </span>
      </div>

      {curveState.status !== "ready" && renderChartState(curveState)}

      {curveState.status === "ready" && !chartModel && (
        <div className="chart-state chart-state-error" role="alert">
          <div>
            <h3>Unable to render fan chart</h3>
            <p>The chart received an invalid fan-curve payload.</p>
          </div>
        </div>
      )}

      {chartModel && (
        <div
          className="chart-container d3-fan-chart-shell"
          onMouseLeave={() => setHoverPoint(null)}
        >
          <svg
            className="d3-fan-chart"
            viewBox={`0 0 ${chartModel.width} ${chartModel.height}`}
            role="img"
            aria-label={`P and L fan chart from ${chartModel.forecastStartYear} to ${chartModel.forecastEndYear}`}
          >
            <defs>
              <linearGradient id="fanOuterGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(124, 41, 41, 0.42)" />
                <stop offset="100%" stopColor="rgba(174, 58, 58, 0.72)" />
              </linearGradient>
              <linearGradient id="fanInnerGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(194, 70, 58, 0.68)" />
                <stop offset="100%" stopColor="rgba(235, 92, 70, 0.9)" />
              </linearGradient>
            </defs>

            <g transform={`translate(${chartModel.margin.left}, ${chartModel.margin.top})`}>
              <rect
                className="d3-forecast-background"
                x={chartModel.forecastStartX}
                y={0}
                width={chartModel.forecastWidth}
                height={chartModel.plotHeight}
              />

              {chartModel.yTicks.map((tick) => (
                <g key={tick.value} className="d3-gridline">
                  <line
                    x1={0}
                    x2={chartModel.plotWidth}
                    y1={tick.y}
                    y2={tick.y}
                  />
                  <text
                    x={chartModel.plotWidth + 14}
                    y={tick.y}
                    dy="0.32em"
                  >
                    {formatCompactCurrency(tick.value)}
                  </text>
                </g>
              ))}

              <path className="d3-band-outer" d={chartModel.outerPath} />
              <path className="d3-band-inner" d={chartModel.innerPath} />
              <path className="d3-strike-line" d={chartModel.strikePath} />
              <path className="d3-median-line" d={chartModel.medianPath} />

              <line
                className="d3-current-year-line"
                x1={chartModel.currentYearX}
                x2={chartModel.currentYearX}
                y1={0}
                y2={chartModel.plotHeight}
              />
              <text
                className="d3-current-year-label"
                x={chartModel.currentYearX + 10}
                y={22}
              >
                This year
              </text>
              <text
                className="d3-forecast-label"
                x={chartModel.forecastStartX + chartModel.forecastWidth / 2}
                y={20}
                textAnchor="middle"
              >
                Forecast
              </text>

              <line
                className="d3-axis-line"
                x1={0}
                x2={chartModel.plotWidth}
                y1={chartModel.plotHeight}
                y2={chartModel.plotHeight}
              />
              {chartModel.xTicks.map((tick) => (
                <text
                  key={tick.value}
                  className="d3-x-label"
                  x={tick.x}
                  y={chartModel.plotHeight + 30}
                  textAnchor="middle"
                >
                  {tick.value}
                </text>
              ))}

              <text
                className="d3-y-title"
                transform={`translate(${-52}, ${chartModel.plotHeight / 2}) rotate(-90)`}
                textAnchor="middle"
              >
                P&amp;L (USD / MW / yr)
              </text>

              {hoverPoint && (
                <>
                  <line
                    className="d3-hover-line"
                    x1={hoverPoint.x}
                    x2={hoverPoint.x}
                    y1={0}
                    y2={chartModel.plotHeight}
                  />
                  {hoverPoint.pins.map((pin) => (
                    <g
                      key={`${hoverPoint.year}-${pin.label}`}
                      className={`d3-hover-pin ${pin.className}`}
                    >
                      <circle cx={hoverPoint.x} cy={pin.y} r={5} />
                      <text x={hoverPoint.x + 9} y={pin.y} dy="0.32em">
                        {pin.label}
                      </text>
                    </g>
                  ))}
                </>
              )}

              <rect
                className="d3-hover-overlay"
                x={0}
                y={0}
                width={chartModel.plotWidth}
                height={chartModel.plotHeight}
                onPointerMove={(event) => handlePointerMove(event, chartModel)}
                onFocus={() => setHoverPoint(chartModel.hoverPoints[0] ?? null)}
                tabIndex={0}
                aria-label="Hover or focus chart to inspect yearly values"
              />
            </g>
          </svg>

          {hoverPoint && (
            <div
              className="d3-fan-tooltip"
              style={{
                left: `${((hoverPoint.x + chartModel.margin.left) / chartModel.width) * 100}%`,
                top: `${((hoverPoint.y + chartModel.margin.top) / chartModel.height) * 100}%`,
              }}
            >
              <strong>{hoverPoint.year}</strong>
              {hoverPoint.band ? (
                <dl>
                  <div>
                    <dt>P90</dt>
                    <dd>{formatCurrency(hoverPoint.band.p90)}</dd>
                  </div>
                  <div>
                    <dt>P75</dt>
                    <dd>{formatCurrency(hoverPoint.band.p75)}</dd>
                  </div>
                  <div>
                    <dt>P50</dt>
                    <dd>{formatCurrency(hoverPoint.band.p50)}</dd>
                  </div>
                  <div>
                    <dt>P25</dt>
                    <dd>{formatCurrency(hoverPoint.band.p25)}</dd>
                  </div>
                  <div>
                    <dt>P10</dt>
                    <dd>{formatCurrency(hoverPoint.band.p10)}</dd>
                  </div>
                </dl>
              ) : (
                <dl>
                  <div>
                    <dt>Actual</dt>
                    <dd>{formatCurrency(hoverPoint.value)}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
