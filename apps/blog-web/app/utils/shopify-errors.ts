export function getShopifyErrorType(error: unknown) {
  const candidate = error as any;

  return (
    candidate?.data?.errorType ??
    candidate?.response?.data?.errorType ??
    candidate?.errorType ??
    candidate?.cause?.errorType ??
    null
  );
}

export function isProjectShopifyStoreNotLinkedError(error: unknown) {
  const errorType = getShopifyErrorType(error);

  if (
    errorType === 'PROJECT_SHOPIFY_STORE_NOT_LINKED' ||
    errorType === 'SHOPIFY_APP_NOT_INSTALLED' ||
    errorType === 'SHOPIFY_TOKEN_REQUEST_FAILED' ||
    errorType === 'SHOPIFY_TOKEN_INVALID_CLIENT' ||
    errorType === 'SHOPIFY_TOKEN_INVALID_REQUEST' ||
    errorType === 'SHOPIFY_TOKEN_UNAUTHORIZED'
  ) {
    return true;
  }

  const candidate = error as any;
  const message =
    candidate?.data?.message ??
    candidate?.response?.data?.message ??
    candidate?.message ??
    '';

  if (typeof message !== 'string') {
    return false;
  }

  return (
    message.includes('is not linked to a Shopify store') ||
    message.includes('app_not_installed') ||
    message.includes('application is not installed on this shop') ||
    message.includes('Shopify token request failed') ||
    message.includes('Shopify store domain is missing for the current project')
  );
}

export function isShopifyUnavailableError(error: unknown) {
  const errorType = getShopifyErrorType(error);

  if (errorType === "SHOPIFY_API_UNAVAILABLE") {
    return true;
  }

  const candidate = error as any;
  const message =
    candidate?.data?.message ??
    candidate?.response?.data?.message ??
    candidate?.message ??
    "";

  if (typeof message !== "string") {
    return false;
  }

  return (
    message.includes("Shopify request failed with status") ||
    message.includes("Impossible de contacter Shopify") ||
    message.includes("Shopify est momentanement indisponible") ||
    message.includes("Shopify est momentanément indisponible") ||
    message.includes("Shopify n'a pas repondu correctement") ||
    message.includes("Shopify n'a pas répondu correctement")
  );
}
