export function isUrl(value: string) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

export function toBaseUrl(value: string) {
  const parsed = new URL(value);
  return parsed.origin;
}

export function normalizeUrl(value: string) {
  const parsed = new URL(value);
  return parsed.toString().replace(/\/$/, '');
}

export function deriveNameFromUrl(url: string) {
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  const [firstSegment] = hostname.split('.');

  return firstSegment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function extractHostname(websiteUrl: string) {
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, '');
  } catch {
    return websiteUrl;
  }
}
