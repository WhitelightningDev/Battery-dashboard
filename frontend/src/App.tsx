import { useCallback, useEffect, useRef, useState } from "react";
import { getPnlCurve, getStrikeMatrix, PricingApiError } from "./api";
import {
  DashboardShell,
  DealTermsSelector,
  HeadlinePrice,
  PnlCurveChart,
  RunLauncher,
} from "./components";
import type {
  DealTerms,
  PnlCurveState,
  StrikeMatrixRow,
} from "./types";
import { findNearestPricedRow, matchesDealTerms } from "./utils";

type MatrixState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: StrikeMatrixRow[] };

function getDealTerms(row: StrikeMatrixRow): DealTerms {
  return {
    term: row.term,
    merchantPct: row.merchantPct,
    cycling: row.cycling,
    profile: row.profile,
  };
}

function App() {
  const [matrixState, setMatrixState] = useState<MatrixState>({
    status: "loading",
  });
  const [selectedTerms, setSelectedTerms] = useState<DealTerms | null>(null);
  const [curveState, setCurveState] = useState<PnlCurveState>({
    status: "loading",
  });
  const curveRequestId = useRef(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const handleRunComplete = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
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
    const requestId = ++curveRequestId.current;

    if (!displayedMatrixRow) {
      setCurveState({
        status: "error",
        message: "P&L curve unavailable: no priced cell is available.",
      });
      return;
    }

    const controller = new AbortController();
    setCurveState({ status: "loading" });

    void getPnlCurve(getDealTerms(displayedMatrixRow), controller.signal)
      .then((response) => {
        if (
          controller.signal.aborted ||
          requestId !== curveRequestId.current
        ) {
          return;
        }

        setCurveState(
          response.points.length === 0
            ? { status: "empty", response }
            : { status: "ready", response },
        );
      })
      .catch((error: unknown) => {
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
              ? `P&L curve unavailable: ${error.message}`
              : "P&L curve unavailable.",
        });
      });

    return () => controller.abort();
  }, [displayedMatrixRow]);

  return (
    <DashboardShell>
      <RunLauncher onComplete={handleRunComplete} />

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
            <DealTermsSelector
              matrix={matrixState.rows}
              selectedTerms={selectedTerms}
              onChange={setSelectedTerms}
            />
            <HeadlinePrice
              matrixRow={displayedMatrixRow}
              requestedTerms={selectedTerms}
              wasSnapped={wasSnapped}
              curveState={curveState}
            />
            <PnlCurveChart curveState={curveState} />
          </>
        )}
    </DashboardShell>
  );
}

export default App;
