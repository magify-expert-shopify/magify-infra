import type { Url } from 'generated/prisma/client';
import { DEFAULT_LEAD_SCORE_SETTINGS, type LeadScoreSettings, normalizeLeadScoreSettings } from 'src/site-settings/lead-score-settings';

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

const FREE_SHOPIFY_THEME_NAMES = new Set([
  'dawn',
  'horizon',
  'refresh',
  'sense',
  'craft',
  'ride',
  'studio',
  'taste',
  'origin',
  'crave',
  'colorblock',
  'publisher',
  'savor',
  'combine',
  'whisk',
  'pipeline',
  'expanse',
  'sleek',
  'local',
  'spark',
  'spotlight',
  'split',
  'broadcast',
  'motion',
  'mood',
  'fabric',
  'vessel',
  'atelier',
  'vision',
  'symmetry',
  'shape',
  'retina',
  'blockshop',
]);

type LeadScoreSourceRow = Pick<
  Url,
  | 'shopifyStatus'
  | 'cmsName'
  | 'shopifyThemeName'
  | 'shopifyThemeSchemaName'
  | 'shopifyThemeJson'
  | 'lighthousePerformanceScore'
  | 'lighthouseAccessibilityScore'
  | 'lighthouseBestPracticesScore'
  | 'lighthouseSeoScore'
> & {
  siteLanguageCode?: string | null;
  siteLanguageName?: string | null;
  siteCountryCode?: string | null;
  companyCountry?: string | null;
  contactCompanyCountry?: string | null;
  contactSiren?: string | null;
  productCount?: number | null;
  medianProductPrice?: number | null;
  shopifyThemeStoreType?: string | null;
  shopifyLegalNoticeStatus?: string | null;
};

function scoreShopify(row: Pick<LeadScoreSourceRow, 'shopifyStatus'>, settings: LeadScoreSettings) {
  return row.shopifyStatus === 'shopify' ? settings.shopify.shopify : settings.shopify.other;
}

function scoreCms(row: Pick<LeadScoreSourceRow, 'cmsName'>, settings: LeadScoreSettings) {
  const cmsName = normalize(row.cmsName);
  const knownCms = [
    'wordpress',
    'woocommerce',
    'prestashop',
    'presta shop',
    'magento',
    'wix',
    'squarespace',
    'webflow',
    'framer',
    'bigcommerce',
    'drupal',
    'joomla',
    'opencart',
  ];

  return knownCms.some((value) => cmsName.includes(value)) ? settings.shopify.cms : settings.shopify.other;
}

function scoreTheme(row: Pick<LeadScoreSourceRow, 'shopifyThemeStoreType' | 'shopifyThemeName' | 'shopifyThemeSchemaName' | 'shopifyThemeJson'>, settings: LeadScoreSettings) {
  const storeType = normalize(row.shopifyThemeStoreType);
  const themeName = normalize(row.shopifyThemeName);
  const schemaName = normalize(row.shopifyThemeSchemaName);
  const themeJson = normalize(row.shopifyThemeJson);
  const isFree =
    storeType === 'free' ||
    FREE_SHOPIFY_THEME_NAMES.has(themeName) ||
    FREE_SHOPIFY_THEME_NAMES.has(schemaName);
  const isCustom =
    storeType === 'custom' ||
    !themeName ||
    themeName.includes('custom') ||
    schemaName.includes('custom') ||
    themeJson.includes('custom') ||
    themeJson.includes('theme_store_id":null');

  if (isFree) {
    return settings.theme.dawn;
  }

  if (isCustom) {
    return settings.theme.custom;
  }

  return settings.theme.other;
}

function scoreSiren(row: Pick<LeadScoreSourceRow, 'contactSiren'>, settings: LeadScoreSettings) {
  return String(row.contactSiren || '').trim() ? settings.siren.found : settings.siren.missing;
}

function scoreLanguage(row: Pick<LeadScoreSourceRow, 'siteLanguageCode' | 'siteLanguageName' | 'siteCountryCode'>, settings: LeadScoreSettings) {
  const normalizedLanguage = normalize(row.siteLanguageCode || row.siteLanguageName);
  const normalizedCountry = normalize(row.siteCountryCode);

  if (normalizedLanguage.startsWith('fr') || normalizedCountry === 'fr' || normalizedCountry === 'fr-fr') {
    return settings.language.french;
  }

  if (normalizedLanguage.startsWith('en') || normalizedCountry === 'en' || normalizedCountry === 'en-us' || normalizedCountry === 'en-gb') {
    return settings.language.english;
  }

  return settings.language.other;
}

function scoreCompanyCountry(
  row: Pick<LeadScoreSourceRow, 'companyCountry' | 'contactCompanyCountry'>,
  settings: LeadScoreSettings,
) {
  const normalizedCountry = normalize(row.companyCountry || row.contactCompanyCountry);

  if (!normalizedCountry) {
    return settings.companyCountry.missing;
  }

  if (normalizedCountry === 'fr' || normalizedCountry === 'france' || normalizedCountry === 'fr-fr') {
    return settings.companyCountry.france;
  }

  return settings.companyCountry.other;
}

function scoreLegalNotice(row: Pick<LeadScoreSourceRow, 'shopifyStatus' | 'shopifyLegalNoticeStatus'>, settings: LeadScoreSettings) {
  if (row.shopifyStatus !== 'shopify') {
    return 0;
  }

  return row.shopifyLegalNoticeStatus === 'found'
    ? settings.legalNotice.found
    : settings.legalNotice.missing;
}

function scoreLighthouse(
  row: Pick<
    Url,
    | 'lighthousePerformanceScore'
    | 'lighthouseAccessibilityScore'
    | 'lighthouseBestPracticesScore'
    | 'lighthouseSeoScore'
  >,
  settings: LeadScoreSettings,
) {
  const scores = [
    row.lighthousePerformanceScore,
    row.lighthouseAccessibilityScore,
    row.lighthouseBestPracticesScore,
    row.lighthouseSeoScore,
  ].filter((value): value is number => Number.isFinite(Number(value)));

  if (scores.length === 0) {
    return 0;
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;

  if (average >= settings.lighthouse.thresholds.excellent) {
    return settings.lighthouse.points.excellent;
  }

  if (average >= settings.lighthouse.thresholds.good) {
    return settings.lighthouse.points.good;
  }

  if (average >= settings.lighthouse.thresholds.average) {
    return settings.lighthouse.points.average;
  }

  if (average >= settings.lighthouse.thresholds.poor) {
    return settings.lighthouse.points.poor;
  }

  return settings.lighthouse.points.critical;
}

function scoreProductCountWithSettings(
  row: { productCount?: number | null },
  settings: LeadScoreSettings = DEFAULT_LEAD_SCORE_SETTINGS,
) {
  const productCount = Number(row.productCount);
  if (!Number.isFinite(productCount) || productCount <= 0) {
    return settings.catalog.productCount.points.none;
  }

  if (productCount >= settings.catalog.productCount.thresholds.high) {
    return settings.catalog.productCount.points.high;
  }

  if (productCount >= settings.catalog.productCount.thresholds.medium) {
    return settings.catalog.productCount.points.medium;
  }

  return settings.catalog.productCount.points.low;
}

function scoreMedianProductPriceWithSettings(
  row: { medianProductPrice?: number | null },
  settings: LeadScoreSettings = DEFAULT_LEAD_SCORE_SETTINGS,
) {
  const medianProductPrice = Number(row.medianProductPrice);
  if (!Number.isFinite(medianProductPrice) || medianProductPrice <= 0) {
    return settings.catalog.medianProductPrice.points.none;
  }

  if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.high) {
    return settings.catalog.medianProductPrice.points.high;
  }

  if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.medium) {
    return settings.catalog.medianProductPrice.points.medium;
  }

  if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.low) {
    return settings.catalog.medianProductPrice.points.low;
  }

  return settings.catalog.medianProductPrice.points.none;
}

export function computeLeadScore(
  row: LeadScoreSourceRow,
  settings: LeadScoreSettings = DEFAULT_LEAD_SCORE_SETTINGS,
) {
  const normalizedSettings = normalizeLeadScoreSettings(settings);
  return scoreShopify(row, normalizedSettings)
    + scoreCms(row, normalizedSettings)
    + scoreSiren(row, normalizedSettings)
    + scoreTheme(row, normalizedSettings)
    + scoreLanguage(row, normalizedSettings)
    + scoreCompanyCountry(row, normalizedSettings)
    + scoreLegalNotice(row, normalizedSettings)
    + scoreLighthouse(row, normalizedSettings)
    + scoreProductCountWithSettings(row, normalizedSettings)
    + scoreMedianProductPriceWithSettings(row, normalizedSettings);
}
