export function normalizeUrlWithoutProtocol(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  return trimmedValue.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export function normalizeShopifyStoreHandle(value: string) {
  const normalizedValue = normalizeUrlWithoutProtocol(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();

  if (!normalizedValue) {
    return '';
  }

  const hostPart = normalizedValue.split('/')[0]?.trim() || '';

  return hostPart.replace(/\.myshopify\.com$/i, '').trim();
}

export function buildShopifyStoreDomain(value: string) {
  const storeHandle = normalizeShopifyStoreHandle(value);

  if (!storeHandle) {
    return '';
  }

  return `${storeHandle}.myshopify.com`;
}
