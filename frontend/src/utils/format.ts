const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 20,
});

/** Format a validated number as USD with thousands separators and two decimals. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Format a validated currency value compactly for readable chart-axis ticks. */
export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

/** Format a validated decimal without unnecessary trailing zeroes. */
export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}
