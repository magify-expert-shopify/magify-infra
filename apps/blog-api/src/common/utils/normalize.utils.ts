export function normalizeUrlWithoutProtocol(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  return trimmedValue.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}
