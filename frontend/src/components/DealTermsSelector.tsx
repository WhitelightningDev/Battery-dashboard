import type { DealTerms, StrikeMatrixRow } from "../types";
import { parseFiniteNumber } from "../utils";

interface DealTermsSelectorProps {
  matrix: StrikeMatrixRow[];
  selectedTerms: DealTerms;
  onChange: (dealTerms: DealTerms) => void;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function DealTermsSelector({
  matrix,
  selectedTerms,
  onChange,
}: DealTermsSelectorProps) {
  const termOptions = uniqueNumbers(matrix.map((row) => row.term));
  const merchantOptions = uniqueNumbers(
    matrix.map((row) => row.merchantPct),
  );
  const cyclingOptions = uniqueNumbers(
    matrix.map((row) => row.cycling),
  );
  const profileOptions = uniqueStrings(
    matrix.map((row) => row.profile),
  );

  return (
    <section className="selector-card" aria-labelledby="deal-terms-title">
      <div className="selector-heading">
        <p className="eyebrow">Deal configuration</p>
        <h2 id="deal-terms-title">Select commercial terms</h2>
        <p id="deal-terms-help">
          Each value comes from the pricing matrix. Unpriced combinations are
          resolved transparently to the nearest priced cell.
        </p>
      </div>

      <fieldset
        className="selector-grid"
        aria-describedby="deal-terms-help"
      >
        <legend className="sr-only">Commercial deal terms</legend>
        <label className="selector-field" htmlFor="deal-term">
          <span>Term</span>
          <select
            id="deal-term"
            name="term"
            value={selectedTerms.term}
            onChange={(event) => {
              const term = parseFiniteNumber(event.target.value);
              if (term !== null) {
                onChange({ ...selectedTerms, term });
              }
            }}
          >
            {termOptions.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </label>

        <label className="selector-field" htmlFor="deal-merchant-pct">
          <span>Merchant percentage</span>
          <select
            id="deal-merchant-pct"
            name="merchantPct"
            value={selectedTerms.merchantPct}
            onChange={(event) => {
              const merchantPct = parseFiniteNumber(event.target.value);
              if (merchantPct !== null) {
                onChange({ ...selectedTerms, merchantPct });
              }
            }}
          >
            {merchantOptions.map((merchantPct) => (
              <option key={merchantPct} value={merchantPct}>
                {merchantPct}%
              </option>
            ))}
          </select>
        </label>

        <label className="selector-field" htmlFor="deal-cycling">
          <span>Cycling</span>
          <select
            id="deal-cycling"
            name="cycling"
            value={selectedTerms.cycling}
            onChange={(event) => {
              const cycling = parseFiniteNumber(event.target.value);
              if (cycling !== null) {
                onChange({ ...selectedTerms, cycling });
              }
            }}
          >
            {cyclingOptions.map((cycling) => (
              <option key={cycling} value={cycling}>
                {cycling}
              </option>
            ))}
          </select>
        </label>

        <label className="selector-field" htmlFor="deal-profile">
          <span>Profile</span>
          <select
            id="deal-profile"
            name="profile"
            value={selectedTerms.profile}
            onChange={(event) => {
              onChange({
                ...selectedTerms,
                profile: event.target.value,
              });
            }}
          >
            {profileOptions.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    </section>
  );
}
