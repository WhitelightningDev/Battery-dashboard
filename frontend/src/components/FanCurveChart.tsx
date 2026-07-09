import Highcharts from "highcharts";
import "highcharts/highcharts-more";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import type { FanCurveState } from "../types";
import { formatCompactCurrency, formatCurrency } from "../utils";

interface FanCurveChartProps {
  curveState: FanCurveState;
}

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

/** Render the P-value fan chart using Highcharts' arearange pattern. */
export function FanCurveChart({ curveState }: FanCurveChartProps) {
  const response =
    curveState.status === "ready" && Array.isArray(curveState.response.bands)
      ? curveState.response
      : undefined;

  const options = useMemo<Highcharts.Options | null>(() => {
    if (!response) {
      return null;
    }

    const categories = response.bands.map((band) => `Year ${band.year}`);
    const outerRange = response.bands.map((band) => [band.p10, band.p90]);
    const innerRange = response.bands.map((band) => [band.p25, band.p75]);
    const median = response.bands.map((band) => band.p50);
    const strike = response.bands.map(() => response.strikePerMwYr);

    return {
      chart: {
        type: "arearange",
        backgroundColor: "transparent",
        height: 460,
        spacing: [18, 12, 18, 8],
        style: {
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      },
      accessibility: {
        description:
          "Fan chart showing forecast P and L percentile bands across contract years.",
      },
      credits: {
        enabled: false,
      },
      title: {
        text: undefined,
      },
      xAxis: {
        categories,
        crosshair: {
          color: "rgba(20, 92, 56, 0.12)",
          width: 2,
        },
        lineColor: "#bac8c0",
        tickColor: "#bac8c0",
        labels: {
          style: {
            color: "#607068",
            fontSize: "12px",
          },
        },
        title: {
          text: "Contract year",
          style: {
            color: "#435249",
            fontWeight: "650",
          },
        },
      },
      yAxis: {
        gridLineColor: "#e4ebe7",
        labels: {
          formatter() {
            return formatCompactCurrency(Number(this.value));
          },
          style: {
            color: "#607068",
            fontSize: "12px",
          },
        },
        title: {
          text: "P&L (USD / MW / yr)",
          style: {
            color: "#435249",
            fontWeight: "650",
          },
        },
      },
      legend: {
        align: "left",
        verticalAlign: "top",
        itemStyle: {
          color: "#435249",
          fontSize: "12px",
          fontWeight: "650",
        },
        symbolRadius: 5,
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#d8e1dc",
        borderRadius: 10,
        padding: 12,
        shadow: {
          color: "rgba(35,72,51,0.16)",
          offsetX: 0,
          offsetY: 8,
          opacity: 0.08,
          width: 12,
        },
        formatter() {
          const pointIndex = this.points?.[0]?.index ?? 0;
          const band = response.bands[pointIndex];

          if (!band) {
            return false;
          }

          return `
            <strong>Year ${band.year}</strong>
            <table class="highcharts-fan-tooltip">
              <tr><td>P90</td><td>${formatCurrency(band.p90)}</td></tr>
              <tr><td>P75</td><td>${formatCurrency(band.p75)}</td></tr>
              <tr><td>P50</td><td>${formatCurrency(band.p50)}</td></tr>
              <tr><td>P25</td><td>${formatCurrency(band.p25)}</td></tr>
              <tr><td>P10</td><td>${formatCurrency(band.p10)}</td></tr>
              <tr><td>Strike</td><td>${formatCurrency(response.strikePerMwYr)}</td></tr>
            </table>
          `;
        },
      },
      plotOptions: {
        series: {
          marker: {
            enabled: false,
          },
          animation: false,
          states: {
            inactive: {
              opacity: 1,
            },
          },
        },
        arearange: {
          lineWidth: 0,
          fillOpacity: 0.86,
          stickyTracking: false,
          trackByArea: true,
        },
      },
      series: [
        {
          type: "arearange",
          name: "P10–P90",
          data: outerRange,
          color: "#b7dcc8",
          fillColor: {
            linearGradient: {
              x1: 0,
              x2: 1,
              y1: 0,
              y2: 0,
            },
            stops: [
              [0, "rgba(215, 234, 223, 0.62)"],
              [1, "rgba(183, 220, 200, 0.9)"],
            ],
          },
          zIndex: 0,
        },
        {
          type: "arearange",
          name: "P25–P75",
          data: innerRange,
          color: "#5ea77d",
          fillColor: {
            linearGradient: {
              x1: 0,
              x2: 1,
              y1: 0,
              y2: 0,
            },
            stops: [
              [0, "rgba(143, 198, 164, 0.74)"],
              [1, "rgba(94, 167, 125, 0.9)"],
            ],
          },
          zIndex: 1,
        },
        {
          type: "line",
          name: "P50 median",
          data: median,
          color: "#145c38",
          lineWidth: 3,
          zIndex: 3,
        },
        {
          type: "line",
          name: "Strike",
          data: strike,
          color: "#d97706",
          dashStyle: "Dash",
          lineWidth: 2,
          zIndex: 2,
        },
      ],
    };
  }, [response]);

  return (
    <section className="chart-card chart-card-highcharts" aria-labelledby="fan-chart-title">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Forecast distribution</p>
          <h2 id="fan-chart-title">P&amp;L fan chart</h2>
        </div>
        <p className="chart-context">
          Median forecast with inner and outer uncertainty bands over the full
          contract term.
        </p>
      </div>

      {curveState.status !== "ready" && renderChartState(curveState)}
      {curveState.status === "ready" && !options && (
        <div className="chart-state chart-state-error" role="alert">
          <div>
            <h3>Unable to render fan chart</h3>
            <p>The chart received an invalid fan-curve payload.</p>
          </div>
        </div>
      )}

      {options && (
        <div className="chart-container highcharts-container-shell">
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
      )}
    </section>
  );
}
