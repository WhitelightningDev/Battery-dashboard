import type { DealTerms } from "../types";
import { formatDecimal } from "../utils";

interface DealTermsSummaryProps {
  terms: DealTerms;
}

export function DealTermsSummary({ terms }: DealTermsSummaryProps) {
  return (
    <dl className="terms-summary">
      <div>
        <dt>Term</dt>
        <dd>{formatDecimal(terms.term)}</dd>
      </div>
      <div>
        <dt>Merchant</dt>
        <dd>{formatDecimal(terms.merchantPct)}%</dd>
      </div>
      <div>
        <dt>Cycling</dt>
        <dd>{formatDecimal(terms.cycling)}</dd>
      </div>
      <div>
        <dt>Profile</dt>
        <dd>{terms.profile}</dd>
      </div>
    </dl>
  );
}
