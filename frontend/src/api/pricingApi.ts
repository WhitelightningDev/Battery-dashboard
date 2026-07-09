import type {
  DealTerms,
  FanBandPoint,
  FanCurveResponse,
  PnlCurveResponse,
  PnlPoint,
  Profile,
  StrikeMatrixRow,
} from "../types";
import {
  getApiBaseUrl,
  parseFiniteNumber,
} from "../utils";

type JsonObject = Record<string, unknown>;

/** Preserve HTTP status metadata for callers that distinguish missing data. */
export class PricingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "PricingApiError";
    this.status = status;
  }
}

/** Narrow an unknown JSON value to a non-array object. */
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// API payloads remain unknown until every required numeric field is validated.
/** Parse a required finite number or report its precise response field. */
function parseRequiredNumber(value: unknown, field: string): number {
  const parsed = parseFiniteNumber(value);

  if (parsed === null) {
    throw new Error(`Invalid numeric value for "${field}".`);
  }

  return parsed;
}

/** Validate and normalize a required non-empty profile string. */
function parseProfile(value: unknown, field: string): Profile {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid profile value for "${field}".`);
  }

  return value.trim();
}

/** Validate and trim a required non-empty text field. */
function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid text value for "${field}".`);
  }

  return value.trim();
}

/** Parse a matrix price while retaining malformed prices as an invalid state. */
function parsePricePerMwYr(value: unknown): number | null {
  // A bad matrix price is preserved as invalid so the UI can explain it clearly.
  return parseFiniteNumber(value);
}

/** Parse the four shared deal-term fields from an unknown object. */
function parseDealTerms(value: unknown, field: string): DealTerms {
  if (!isJsonObject(value)) {
    throw new Error(`Invalid object for "${field}".`);
  }

  return {
    term: parseRequiredNumber(value.term, `${field}.term`),
    merchantPct: parseRequiredNumber(
      value.merchantPct,
      `${field}.merchantPct`,
    ),
    cycling: parseRequiredNumber(value.cycling, `${field}.cycling`),
    profile: parseProfile(value.profile, `${field}.profile`),
  };
}

/** Validate one strike-matrix row and retain its source index in errors. */
function parseStrikeMatrixRow(
  value: unknown,
  index: number,
): StrikeMatrixRow {
  const field = `strikeMatrix[${index}]`;

  if (!isJsonObject(value)) {
    throw new Error(`Invalid object for "${field}".`);
  }

  return {
    ...parseDealTerms(value, field),
    pricePerMwYr: parsePricePerMwYr(value.pricePerMwYr),
  };
}

/** Validate one P&L curve point and reject malformed chart coordinates. */
function parsePnlPoint(value: unknown, index: number): PnlPoint {
  const field = `pnlCurve.points[${index}]`;

  if (!isJsonObject(value)) {
    throw new Error(`Invalid object for "${field}".`);
  }

  return {
    p: parseRequiredNumber(value.p, `${field}.p`),
    pnlPerMwYr: parseRequiredNumber(
      value.pnlPerMwYr,
      `${field}.pnlPerMwYr`,
    ),
  };
}

/** Validate one yearly fan-band row and reject malformed chart coordinates. */
function parseFanBandPoint(value: unknown, index: number): FanBandPoint {
  const field = `fanCurve.bands[${index}]`;

  if (!isJsonObject(value)) {
    throw new Error(`Invalid object for "${field}".`);
  }

  return {
    year: parseRequiredNumber(value.year, `${field}.year`),
    p10: parseRequiredNumber(value.p10, `${field}.p10`),
    p25: parseRequiredNumber(value.p25, `${field}.p25`),
    p50: parseRequiredNumber(value.p50, `${field}.p50`),
    p75: parseRequiredNumber(value.p75, `${field}.p75`),
    p90: parseRequiredNumber(value.p90, `${field}.p90`),
  };
}

/** Reject fan bands that would render a misleading distribution. */
function validateFanBands(term: number, bands: FanBandPoint[]): FanBandPoint[] {
  if (bands.length === 0) {
    return bands;
  }

  if (bands.length !== term) {
    throw new Error(
      `Invalid fan curve: expected ${term} yearly bands, received ${bands.length}.`,
    );
  }

  const orderedBands = [...bands].sort((left, right) => left.year - right.year);

  orderedBands.forEach((band, index) => {
    const expectedYear = index + 1;

    if (band.year !== expectedYear) {
      throw new Error(
        `Invalid fan curve: expected year ${expectedYear}, received ${band.year}.`,
      );
    }

    if (
      !(
        band.p10 <= band.p25 &&
        band.p25 <= band.p50 &&
        band.p50 <= band.p75 &&
        band.p75 <= band.p90
      )
    ) {
      throw new Error(
        `Invalid fan curve: percentile bands are not monotonic in year ${band.year}.`,
      );
    }
  });

  return orderedBands;
}

/** Extract a readable error detail from common backend error payloads. */
function getErrorDetail(value: unknown): string | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }

  return typeof value.detail === "string"
    ? value.detail
    : typeof value.message === "string"
      ? value.message
      : undefined;
}

/** Fetch and decode JSON while preserving HTTP and network failure context. */
async function fetchJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  // Keep transport parsing separate from endpoint-specific response validation.
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Unable to reach the pricing API.${reason}`, {
      cause: error,
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error: unknown) {
    if (!response.ok) {
      throw new PricingApiError(
        `Pricing API request failed with status ${response.status}.`,
        response.status,
        { cause: error },
      );
    }

    throw new Error("Pricing API returned malformed JSON.", { cause: error });
  }

  if (!response.ok) {
    const detail = getErrorDetail(payload);
    throw new PricingApiError(
      detail
        ? `Pricing API request failed (${response.status}): ${detail}`
        : `Pricing API request failed with status ${response.status}.`,
      response.status,
    );
  }

  return payload;
}

/** Revalidate caller-provided terms before placing them in query parameters. */
function validateDealTerms(dealTerms: DealTerms): DealTerms {
  return {
    term: parseRequiredNumber(dealTerms.term, "dealTerms.term"),
    merchantPct: parseRequiredNumber(
      dealTerms.merchantPct,
      "dealTerms.merchantPct",
    ),
    cycling: parseRequiredNumber(dealTerms.cycling, "dealTerms.cycling"),
    profile: parseProfile(dealTerms.profile, "dealTerms.profile"),
  };
}

/** Fetch and validate the complete strike matrix. */
export async function getStrikeMatrix(
  signal?: AbortSignal,
): Promise<StrikeMatrixRow[]> {
  const payload = await fetchJson("/strike-matrix", signal);

  if (!Array.isArray(payload)) {
    throw new Error("Invalid strike matrix response: expected an array.");
  }

  return payload.map(parseStrikeMatrixRow);
}

/** Fetch and validate the P&L curve for one exact set of deal terms. */
export async function getPnlCurve(
  dealTerms: DealTerms,
  signal?: AbortSignal,
): Promise<PnlCurveResponse> {
  const validatedTerms = validateDealTerms(dealTerms);
  const query = new URLSearchParams({
    term: String(validatedTerms.term),
    merchantPct: String(validatedTerms.merchantPct),
    cycling: String(validatedTerms.cycling),
    profile: validatedTerms.profile,
  });
  const payload = await fetchJson(
    `/pnl-curve?${query.toString()}`,
    signal,
  );

  if (!isJsonObject(payload)) {
    throw new Error("Invalid P&L curve response: expected an object.");
  }

  // A missing points property is a valid empty-curve state, not invented data.
  const points = Array.isArray(payload.points) ? payload.points : [];

  return {
    dealTerms: validatedTerms,
    asOf: parseNonEmptyString(payload.asOf, "pnlCurve.asOf"),
    strikePerMwYr: parseRequiredNumber(
      payload.strikePerMwYr,
      "pnlCurve.strikePerMwYr",
    ),
    points: points.map(parsePnlPoint),
  };
}

/** Fetch and validate the fan curve for one exact set of deal terms. */
export async function getFanCurve(
  dealTerms: DealTerms,
  signal?: AbortSignal,
): Promise<FanCurveResponse> {
  const validatedTerms = validateDealTerms(dealTerms);
  const query = new URLSearchParams({
    term: String(validatedTerms.term),
    merchantPct: String(validatedTerms.merchantPct),
    cycling: String(validatedTerms.cycling),
    profile: validatedTerms.profile,
  });
  const payload = await fetchJson(
    `/fan-curve?${query.toString()}`,
    signal,
  );

  if (!isJsonObject(payload)) {
    throw new Error("Invalid fan curve response: expected an object.");
  }

  const term = parseRequiredNumber(payload.term, "fanCurve.term");
  const bands = Array.isArray(payload.bands) ? payload.bands : [];

  return {
    dealTerms: validatedTerms,
    asOf: parseNonEmptyString(payload.asOf, "fanCurve.asOf"),
    strikePerMwYr: parseRequiredNumber(
      payload.strikePerMwYr,
      "fanCurve.strikePerMwYr",
    ),
    term,
    bands: validateFanBands(term, bands.map(parseFanBandPoint)),
  };
}
