import type {
  DealTerms,
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

export class PricingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "PricingApiError";
    this.status = status;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// API payloads remain unknown until every required numeric field is validated.
function parseRequiredNumber(value: unknown, field: string): number {
  const parsed = parseFiniteNumber(value);

  if (parsed === null) {
    throw new Error(`Invalid numeric value for "${field}".`);
  }

  return parsed;
}

function parseProfile(value: unknown, field: string): Profile {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid profile value for "${field}".`);
  }

  return value.trim();
}

function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid text value for "${field}".`);
  }

  return value.trim();
}

function parsePricePerMwYr(value: unknown): number | null {
  // A bad matrix price is preserved as invalid so the UI can explain it clearly.
  return parseFiniteNumber(value);
}

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

export async function getStrikeMatrix(
  signal?: AbortSignal,
): Promise<StrikeMatrixRow[]> {
  const payload = await fetchJson("/strike-matrix", signal);

  if (!Array.isArray(payload)) {
    throw new Error("Invalid strike matrix response: expected an array.");
  }

  return payload.map(parseStrikeMatrixRow);
}

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
