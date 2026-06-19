export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
export const RETRY_REQUEST_TIMEOUT_MS = 20000;

export const PROJECT_SCOPED_PREFIXES = [
  "/keywords",
  "/pages",
  "/blogs",
  "/blog-articles",
  "/authors",
  "/shopify",
  "/seo-clusters",
  "/suggestions",
  "/articles/suggestions",
  "/tutorials/suggestions",
  "/guides/suggestions",
  "/definitions/suggestions",
] as const;

export const LONGER_TIMEOUT_ERROR_PATTERNS = [
  "fetch failed",
  "networkerror",
  "network error",
  "failed to fetch",
  "load failed",
  "aborterror",
  "timeout",
  "timed out",
  "econnrefused",
  "econnreset",
  "ehostunreach",
  "enotfound",
] as const;
