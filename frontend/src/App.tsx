import { useCallback, useEffect, useRef, useState } from "react";
import { getFanCurve, getStrikeMatrix, PricingApiError } from "./api";
import {
  DashboardShell,
  DealTermsSelector,
  FanCurveChart,
  HeadlinePrice,
  RunLauncher,
} from "./components";
import type {
  DealTerms,
  FanCurveState,
  StrikeMatrixRow,
} from "./types";
import { findNearestPricedRow, matchesDealTerms } from "./utils";

type MatrixState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: StrikeMatrixRow[] };

/** Copy only the deal-term fields required by the fan-curve endpoint. */
function getDealTerms(row: StrikeMatrixRow): DealTerms {
  return {
    term: row.term,
    merchantPct: row.merchantPct,
    cycling: row.cycling,
    profile: row.profile,
  };
}

/** Coordinate matrix loading, pricing resolution, and fan-curve state. */
function App() {
  const [matrixState, setMatrixState] = useState<MatrixState>({
    status: "loading",
  });
  const [selectedTerms, setSelectedTerms] = useState<DealTerms | null>(null);
  const [curveState, setCurveState] = useState<FanCurveState>({
    status: "loading",
  });
  const curveRequestId = useRef(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // The optional run workflow only signals completion; core pricing owns reloads.
  const handleRunComplete = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    // Abort the matrix request when a reload starts or the app unmounts.
    const controller = new AbortController();

    setMatrixState({ status: "loading" });
    setSelectedTerms(null);

    void getStrikeMatrix(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) {
          return;
        }

        setMatrixState({ status: "ready", rows });
        setSelectedTerms(rows[0] ? getDealTerms(rows[0]) : null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setMatrixState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load the strike matrix.",
        });
      });

    return () => controller.abort();
  }, [loadAttempt]);

  // Preserve the requested terms and derive a separate row for displayed pricing.
  const exactMatrixRow =
    matrixState.status === "ready" && selectedTerms
      ? matrixState.rows.find((row) => matchesDealTerms(row, selectedTerms))
      : undefined;
  const displayedMatrixRow =
    exactMatrixRow ??
    (matrixState.status === "ready" && selectedTerms
      ? findNearestPricedRow(matrixState.rows, selectedTerms)
      : undefined);
  const wasSnapped =
    selectedTerms !== null &&
    exactMatrixRow === undefined &&
    displayedMatrixRow !== undefined;

  useEffect(() => {
    // A sequence ID protects against clients that do not honor AbortSignal.
    const requestId = ++curveRequestId.current;

    if (!displayedMatrixRow) {
      setCurveState({
        status: "error",
        message: "Fan curve unavailable: no priced cell is available.",
      });
      return;
    }

    const controller = new AbortController();
    setCurveState({ status: "loading" });

    void getFanCurve(getDealTerms(displayedMatrixRow), controller.signal)
      .then((response) => {
        // Only the newest request may commit curve data to the UI.
        if (
          controller.signal.aborted ||
          requestId !== curveRequestId.current
        ) {
          return;
        }

        setCurveState(
          response.bands.length === 0
            ? { status: "empty", response }
            : { status: "ready", response },
        );
      })
      .catch((error: unknown) => {
        // Ignore both cancelled requests and late responses from older selections.
        if (
          controller.signal.aborted ||
          requestId !== curveRequestId.current
        ) {
          return;
        }

        if (error instanceof PricingApiError && error.status === 404) {
          setCurveState({ status: "missing" });
          return;
        }

        setCurveState({
          status: "error",
          message:
            error instanceof Error
              ? `Fan curve unavailable: ${error.message}`
              : "Fan curve unavailable.",
        });
      });

    return () => controller.abort();
  }, [displayedMatrixRow]);

  return (
    <DashboardShell>
      {matrixState.status === "loading" && (
        <section
          className="state-card"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <h2>Loading pricing matrix</h2>
            <p>Retrieving the available commercial terms.</p>
          </div>
        </section>
      )}

      {matrixState.status === "error" && (
        <section className="state-card state-card-error" role="alert">
          <div>
            <h2>Pricing matrix unavailable</h2>
            <p>{matrixState.message}</p>
            <button
              className="retry-button"
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Try again
            </button>
          </div>
        </section>
      )}

      {matrixState.status === "ready" &&
        matrixState.rows.length === 0 && (
          <section className="state-card" role="status">
            <div>
              <h2>No pricing options available</h2>
              <p>The strike matrix returned no deal configurations.</p>
            </div>
          </section>
        )}

      {matrixState.status === "ready" &&
        matrixState.rows.length > 0 &&
        selectedTerms && (
          <>
            <HeadlinePrice
              matrixRow={displayedMatrixRow}
              requestedTerms={selectedTerms}
              wasSnapped={wasSnapped}
              curveState={curveState}
            />

            <div className="dashboard-filters-row">
              <DealTermsSelector
                matrix={matrixState.rows}
                selectedTerms={selectedTerms}
                onChange={setSelectedTerms}
              />
            </div>

            <div className="dashboard-workspace">
              <section
                className="dashboard-controls-pane"
                aria-label="Dashboard controls"
              >
                <RunLauncher onComplete={handleRunComplete} />
              </section>
              <section
                className="dashboard-chart-pane"
                aria-label="Forecast chart workspace"
              >
                <FanCurveChart curveState={curveState} />
              </section>
            </div>
          </>
        )}
    </DashboardShell>
  );
}

export default App;
