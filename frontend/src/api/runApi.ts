import type { RunResponse, RunStatus } from "../types";
import { getApiBaseUrl } from "../utils";

const RUN_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "running",
  "complete",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && RUN_STATUSES.has(value);
}

function parseRunResponse(value: unknown): RunResponse {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !isRunStatus(value.status)
  ) {
    throw new Error("Run API returned an invalid response.");
  }

  return {
    id: value.id,
    status: value.status,
  };
}

async function requestRun(
  path: string,
  init: RequestInit,
): Promise<RunResponse> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Unable to reach the run API.${reason}`, {
      cause: error,
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error: unknown) {
    throw new Error(
      `Run API returned an unreadable response (${response.status}).`,
      { cause: error },
    );
  }

  if (!response.ok) {
    const detail =
      isObject(payload) && typeof payload.detail === "string"
        ? ` ${payload.detail}`
        : "";
    throw new Error(`Run API request failed (${response.status}).${detail}`);
  }

  return parseRunResponse(payload);
}

export function createRun(signal?: AbortSignal): Promise<RunResponse> {
  return requestRun("/runs", { method: "POST", signal });
}

export function getRun(
  runId: string,
  signal?: AbortSignal,
): Promise<RunResponse> {
  return requestRun(`/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    signal,
  });
}
