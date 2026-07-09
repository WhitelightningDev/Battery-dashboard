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
      <div className="headline-card-top">
        <div className="headline-card-heading">
          <p className="eyebrow">Headline price</p>
          <h2 id="headline-price-title">Contract price</h2>
        </div>
        <div className="headline-card-badge" aria-label="Current curve status">
          {curveState.status === "loading" && <span>Loading fan curve</span>}
          {curveState.status === "error" && (
            <span className="headline-error">{curveState.message}</span>
          )}
          {curveState.status === "missing" && (
            <span className="headline-error">No fan curve available</span>
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
        </div>
      </div>

      {wasSnapped && (
        <p className="snap-warning" role="status">
          Selected combination was not priced. Showing nearest available cell
          instead.
        </p>
      )}

      <p className="headline-price">
        {matrixRow && hasValidPrice ? formatCurrency(pricePerMwYr) : "—"}
        <span> / MW / yr</span>
      </p>

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

      {curveState.status === "empty" && (
        <p className="curve-empty">
          Fan curve contains no annual percentile bands.
        </p>
      )}

      <div className="requested-terms-pill" aria-label="Requested terms">
        <span className="requested-terms-pill-label">Requested terms</span>
        <DealTermsSummary terms={requestedTerms} />
      </div>
    </section>
  );
}
