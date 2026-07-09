import type { DealTerms, StrikeMatrixRow } from "../types";
import { isFiniteNumber } from "./numbers";

export function matchesDealTerms(
  row: StrikeMatrixRow,
  terms: DealTerms,
): boolean {
  return (
    row.term === terms.term &&
    row.merchantPct === terms.merchantPct &&
    row.cycling === terms.cycling &&
    row.profile === terms.profile
  );
}

export function getDealTermsDistance(
  row: StrikeMatrixRow,
  requestedTerms: DealTerms,
): number {
  return (
    Math.abs(row.term - requestedTerms.term) +
    Math.abs(row.merchantPct - requestedTerms.merchantPct) +
    Math.abs(row.cycling - requestedTerms.cycling) * 10 +
    (row.profile === requestedTerms.profile ? 0 : 100)
  );
}

export function findNearestPricedRow(
  rows: StrikeMatrixRow[],
  requestedTerms: DealTerms,
): StrikeMatrixRow | undefined {
  let nearestRow: StrikeMatrixRow | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    if (!isFiniteNumber(row.pricePerMwYr)) {
      continue;
    }

    const distance = getDealTermsDistance(row, requestedTerms);

    if (distance < nearestDistance) {
      nearestRow = row;
      nearestDistance = distance;
    }
  }

  return nearestRow;
}
