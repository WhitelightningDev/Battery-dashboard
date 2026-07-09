const DEFAULT_API_BASE_URL = "http://localhost:8000";

/** Return the configured API origin, falling back to the local backend. */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
