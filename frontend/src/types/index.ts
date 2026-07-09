/** Response returned by the lightweight backend health endpoint. */
export interface HealthResponse {
  status: string;
}

/** Finite lifecycle states supported by the optional run workflow. */
export type RunStatus = "queued" | "running" | "complete";

/** Public run representation shared by create and status endpoints. */
export interface RunResponse {
  id: string;
  status: RunStatus;
}

/**
 * The API accepts any non-empty profile name. Keep this as a string until the
 * backend exposes a fixed set of supported profiles.
 */
export type Profile = string;

/** Four commercial inputs that identify a pricing scenario. */
export interface DealTerms {
  term: number;
  merchantPct: number;
  cycling: number;
  profile: Profile;
}

/** One supplied pricing cell, including a nullable runtime-validated price. */
export interface StrikeMatrixRow extends DealTerms {
  pricePerMwYr: number | null;
}

/** One coordinate on the P-value versus annual P&L curve. */
export interface PnlPoint {
  p: number;
  pnlPerMwYr: number;
}

/** Validated P&L payload associated with an exact set of displayed terms. */
export interface PnlCurveResponse {
  dealTerms: DealTerms;
  asOf: string;
  strikePerMwYr: number;
  points: PnlPoint[];
}

/** Discriminated UI states for every P&L request outcome. */
export type PnlCurveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "empty"; response: PnlCurveResponse }
  | { status: "ready"; response: PnlCurveResponse };

/** One yearly percentile band row used by the P-value fan chart. */
export interface FanBandPoint {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/** Validated fan-curve payload associated with an exact priced cell. */
export interface FanCurveResponse {
  dealTerms: DealTerms;
  asOf: string;
  strikePerMwYr: number;
  term: number;
  bands: FanBandPoint[];
}

/** Discriminated UI states for every fan-curve request outcome. */
export type FanCurveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "empty"; response: FanCurveResponse }
  | { status: "ready"; response: FanCurveResponse };
