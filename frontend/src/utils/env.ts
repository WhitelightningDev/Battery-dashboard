const DEFAULT_API_BASE_URL = "http://localhost:8000";
const PRODUCTION_API_BASE_URL = "/api";
const LOCALHOST_URL_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

/** Return a safe API base URL for local development or same-origin production. */
export function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(
    /\/+$/,
    "",
  );

  // A localhost URL can never reach the backend from a deployed user's browser.
  if (
    import.meta.env.PROD &&
    (!configuredUrl || LOCALHOST_URL_PATTERN.test(configuredUrl))
  ) {
    return PRODUCTION_API_BASE_URL;
  }

  return configuredUrl || DEFAULT_API_BASE_URL;
}
