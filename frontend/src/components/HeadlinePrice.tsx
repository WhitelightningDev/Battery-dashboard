import type {
  DealTerms,
  FanCurveState,
  StrikeMatrixRow,
} from "../types";
import { formatCurrency, isFiniteNumber } from "../utils";
import { DealTermsSummary } from "./DealTermsSummary";

interface HeadlinePriceProps {
  matrixRow: StrikeMatrixRow | undefined;
  requestedTerms: DealTerms;
  wasSnapped: boolean;
  curveState: FanCurveState;
}

/** Remove matrix-only fields before presenting a row as displayed deal terms. */
function toDealTerms(row: StrikeMatrixRow): DealTerms {
  return {
    term: row.term,
    merchantPct: row.merchantPct,
    cycling: row.cycling,
    profile: row.profile,
  };
}

/** Render the validated headline price, curve date, and snapping disclosure. */
export function HeadlinePrice({
  matrixRow,
  requestedTerms,
  wasSnapped,
  curveState,
}: HeadlinePriceProps) {
  const pricePerMwYr = matrixRow?.pricePerMwYr;
  const hasValidPrice = isFiniteNumber(pricePerMwYr);

  return (
    <section className="headline-card" aria-labelledby="headline-price-title">
      <p className="eyebrow">Headline price</p>
      <h2 id="headline-price-title">Contract price</h2>

      {wasSnapped && (
        <p className="snap-warning" role="status">
          Selected combination was not priced. Showing nearest available cell
          instead.
        </p>
      )}

      {!matrixRow && (
        <p className="headline-error" role="alert">
          No exact pricing row exists for the selected terms.
        </p>
      )}

      {matrixRow && !hasValidPrice && (
        <p className="headline-error" role="alert">
          Invalid pricing data: pricePerMwYr must be a finite number.
        </p>
      )}

      {matrixRow && hasValidPrice && (
        <p className="headline-price">
          {formatCurrency(pricePerMwYr)}
          <span> / MW / yr</span>
        </p>
      )}

      <div className="curve-status" aria-live="polite">
        {curveState.status === "loading" && <span>Loading fan curve…</span>}
        {curveState.status === "error" && (
          <span className="headline-error">{curveState.message}</span>
        )}
        {curveState.status === "missing" && (
          <span className="headline-error">
            No fan curve exists for the displayed priced terms.
          </span>
        )}
        {(curveState.status === "ready" ||
          curveState.status === "empty") && (
          <span>
            As of{" "}
            <time dateTime={curveState.response.asOf}>
              {curveState.response.asOf}
            </time>
          </span>
        )}
        {curveState.status === "empty" && (
          <span className="curve-empty">
            Fan curve contains no annual percentile bands.
          </span>
        )}
      </div>

      <div className="terms-comparison">
        <div>
          <h3>Requested terms</h3>
          <DealTermsSummary terms={requestedTerms} />
        </div>
        <div>
          <h3>Displayed priced terms</h3>
          {matrixRow ? (
            <DealTermsSummary terms={toDealTerms(matrixRow)} />
          ) : (
            <p className="headline-error">No priced cell available.</p>
          )}
        </div>
      </div>
    </section>
  );
}
