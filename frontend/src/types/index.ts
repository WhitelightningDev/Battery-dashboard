export interface HealthResponse {
  status: string;
}

export type RunStatus = "queued" | "running" | "complete";

export interface RunResponse {
  id: string;
  status: RunStatus;
}

/**
 * The API accepts any non-empty profile name. Keep this as a string until the
 * backend exposes a fixed set of supported profiles.
 */
export type Profile = string;

export interface DealTerms {
  term: number;
  merchantPct: number;
  cycling: number;
  profile: Profile;
}

export interface StrikeMatrixRow extends DealTerms {
  pricePerMwYr: number | null;
}

export interface PnlPoint {
  p: number;
  pnlPerMwYr: number;
}

export interface PnlCurveResponse {
  dealTerms: DealTerms;
  asOf: string;
  strikePerMwYr: number;
  points: PnlPoint[];
}

export type PnlCurveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "empty"; response: PnlCurveResponse }
  | { status: "ready"; response: PnlCurveResponse };
