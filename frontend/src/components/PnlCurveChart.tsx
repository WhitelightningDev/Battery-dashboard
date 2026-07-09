import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PnlCurveState } from "../types";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDecimal,
  parseFiniteNumber,
} from "../utils";

interface PnlCurveChartProps {
  curveState: PnlCurveState;
}

/** Render the responsive P&L chart or the appropriate non-ready data state. */
export function PnlCurveChart({ curveState }: PnlCurveChartProps) {
  return (
    <section className="chart-card" aria-labelledby="pnl-chart-title">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Scenario distribution</p>
          <h2 id="pnl-chart-title">P&amp;L by P value</h2>
        </div>
        <div className="chart-legend" aria-label="Chart legend">
          <span>
            <i className="legend-line legend-line-pnl" aria-hidden="true" />
            P&amp;L
          </span>
          <span>
            <i className="legend-line legend-line-strike" aria-hidden="true" />
            Strike
          </span>
        </div>
      </div>

      {curveState.status === "loading" && (
        <div className="chart-state" aria-live="polite" aria-busy="true">
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <h3>Loading curve</h3>
            <p>Retrieving values for the displayed priced cell.</p>
          </div>
        </div>
      )}

      {curveState.status === "missing" && (
        <div className="chart-state">
          <div>
            <h3>Curve not available</h3>
            <p>No P&amp;L curve exists for the displayed priced terms.</p>
          </div>
        </div>
      )}

      {curveState.status === "empty" && (
        <div className="chart-state">
          <div>
            <h3>No curve points</h3>
            <p>No P&amp;L points are available for this priced cell.</p>
          </div>
        </div>
      )}

      {curveState.status === "error" && (
        <div className="chart-state chart-state-error" role="alert">
          <div>
            <h3>Unable to load curve</h3>
            <p>{curveState.message}</p>
          </div>
        </div>
      )}

      {curveState.status === "ready" && (
        <div
          className="chart-container"
          role="img"
          aria-label="Line chart of P and L per megawatt per year by P value, with a strike-price reference line."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={curveState.response.points}
              margin={{ top: 24, right: 28, bottom: 32, left: 28 }}
            >
              <CartesianGrid stroke="#e4ebe7" strokeDasharray="4 4" />
              <XAxis
                dataKey="p"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#607068", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#bac8c0" }}
                label={{
                  value: "P value / percentile",
                  position: "insideBottom",
                  offset: -18,
                  fill: "#435249",
                }}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  formatCompactCurrency(value)
                }
                tick={{ fill: "#607068", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={76}
                label={{
                  value: "Price (USD / MW / yr)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -18,
                  fill: "#435249",
                }}
              />
              <Tooltip
                labelFormatter={(value) => {
                  const parsed = parseFiniteNumber(value);
                  return parsed === null ? "p: Invalid" : `p: ${formatDecimal(parsed)}`;
                }}
                formatter={(value) => {
                  const parsed = parseFiniteNumber(value);
                  return [
                    parsed === null ? "Invalid value" : formatCurrency(parsed),
                    "pnlPerMwYr",
                  ];
                }}
                contentStyle={{
                  border: "1px solid #d8e1dc",
                  borderRadius: 10,
                  boxShadow: "0 12px 30px rgb(35 72 51 / 12%)",
                }}
              />
              <ReferenceLine
                y={curveState.response.strikePerMwYr}
                stroke="#d97706"
                strokeDasharray="7 5"
                strokeWidth={2}
                label={{
                  value: `Strike ${formatCurrency(
                    curveState.response.strikePerMwYr,
                  )}`,
                  position: "insideTopRight",
                  fill: "#9a5707",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="pnlPerMwYr"
                name="P&L / MW / yr"
                stroke="#25734a"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: "#25734a" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
