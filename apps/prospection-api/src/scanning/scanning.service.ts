import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { Queue } from 'bullmq';
import he from 'he';
import { Observable, Subject } from 'rxjs';
import { ContactsService } from 'src/contacts/contacts.service';
import { LighthouseService } from 'src/lighthouse/lighthouse.service';
import { UrlsService, classifyShopifyThemeType, type ScanLaunchFilters, type ScanLaunchOverwriteMode, type ScanLaunchStepKey, type ScanLaunchTarget, type ScanWriteMode } from 'src/urls/urls.service';
import type { ContactResult, LighthouseAuditResult, ProductCatalogScanResult, ShopifyScanResult } from 'src/urls/urls.service';
import { SiteSettingsService, type ScanStepKey } from 'src/site-settings/site-settings.service';
import { SCAN_LAUNCH_QUEUE } from 'src/queues/queue.constants';

const DEFAULT_SCAN_TIMEOUT_MS = 10_000;
const LAUNCH_DEFAULT_LIMIT = 200;

interface FetchHtmlResult {
  body: string;
  headers: Headers;
  status: number;
  metrics: {
    ttfbMs: number;
    totalMs: number;
    htmlBytes: number;
  };
}

type ShopifyLegalNoticeInspection = {
  shopifyLegalNoticeStatus: string | null;
  shopifyLegalNoticeUrl: string | null;
};

type ShopifyThemeStoreType = 'free' | 'paid' | 'custom';

type SiteLanguageInspection = {
  siteLanguageCode: string | null;
  siteLanguageName: string | null;
  httpStatus: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  htmlBytes: number | null;
};

type ScanTimingKey =
  | 'scanShopifyMs'
  | 'scanCmsDetectionMs'
  | 'scanLanguageMs'
  | 'scanSeoMetaMs'
  | 'scanLegalNoticeMs'
  | 'scanCatalogMs'
  | 'scanContactMs'
  | 'scanLinkedinMs'
  | 'scanSocialMs'
  | 'scanTechnicalMs'
  | 'scanLighthouseMs'
  | 'scanWorkflowTotalMs';

type CmsDetectionInspection = {
  cmsName: string | null;
  httpStatus: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  htmlBytes: number | null;
};

function getShopifyThemeStoreType(site: {
  shopifyStatus?: string | null;
  shopifyThemeName?: string | null;
  shopifyThemeSchemaName?: string | null;
  shopifyThemeJson?: string | null;
  shopifyThemeStoreType?: string | null;
}): ShopifyThemeStoreType {
  return classifyShopifyThemeType(site);
}

function decodeHtmlEntities(value: string): string {
  return he.decode(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function getMetaContent(body: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const metaRegex = new RegExp(
    `<meta\\b(?=[^>]*(?:property|name)=["']${escapedName}["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>`,
    'i',
  );
  const match = body.match(metaRegex);

  return match ? decodeHtmlEntities(match[1]) : null;
}

function getLinkHref(body: string, rel: string) {
  const escapedRel = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(
    `<link\\b(?=[^>]*\\brel=["'][^"']*\\b${escapedRel}\\b[^"']*["'])(?=[^>]*\\bhref=["']([^"']+)["'])[^>]*>`,
    'i',
  );
  const match = body.match(linkRegex);

  return match ? decodeHtmlEntities(match[1]) : null;
}

function resolveSeoUrlLikeValue(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl);
  } catch {
    return null;
  }
}

type SeoMetaIssueSeverity = 'info' | 'warning' | 'critical';

type SeoMetaIssue = {
  title: string;
  detail: string;
  severity: SeoMetaIssueSeverity;
};

function collectSeoMetaIssues(body: string, url: string): SeoMetaIssue[] {
  const issues: SeoMetaIssue[] = [];
  const pushMissing = (title: string, detail: string, severity: SeoMetaIssueSeverity = 'critical') => {
    issues.push({ title, detail, severity });
  };
  const pushWarning = (title: string, detail: string) => {
    issues.push({ title, detail, severity: 'warning' });
  };

  const titleMatch = body.match(/<title\b[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : '';
  if (!title) {
    pushMissing('Balise title absente', 'La page ne contient pas de balise <title> exploitable.');
  } else if (title.length < 10) {
    pushWarning('Balise title trop courte', `Le title contient seulement ${title.length} caractères. Vise plutôt une balise plus descriptive.`);
  } else if (title.length > 70) {
    pushWarning('Balise title trop longue', `Le title contient ${title.length} caractères. Au-delà de 70 caractères, il risque d’être tronqué dans les résultats.`);
  }

  const description = getMetaContent(body, 'description');
  if (!description) {
    pushMissing('Meta description absente', 'La balise meta description est absente.');
  } else if (description.length < 70) {
    pushWarning('Meta description trop courte', `La meta description contient seulement ${description.length} caractères.`);
  } else if (description.length > 170) {
    pushWarning('Meta description trop longue', `La meta description contient ${description.length} caractères. Elle peut être tronquée dans Google.`);
  }

  const canonical = getLinkHref(body, 'canonical');
  if (!canonical) {
    pushMissing('Canonical absent', 'La balise rel=canonical est absente.');
  } else {
    const resolvedCanonical = resolveSeoUrlLikeValue(canonical, url);
    if (!resolvedCanonical) {
      pushMissing('Canonical invalide', `La canonical fournie (${canonical}) n’est pas une URL valide.`);
    } else if (resolvedCanonical.protocol !== 'https:') {
      pushWarning('Canonical non sécurisé', `La canonical pointe vers ${resolvedCanonical.toString()}. Elle devrait utiliser HTTPS.`);
    }
  }

  const ogTitle = getMetaContent(body, 'og:title');
  if (!ogTitle) {
    pushMissing('Open Graph title absent', 'La balise og:title est absente.');
  }

  const ogDescription = getMetaContent(body, 'og:description');
  if (!ogDescription) {
    pushMissing('Open Graph description absente', 'La balise og:description est absente.');
  }

  const ogType = getMetaContent(body, 'og:type');
  if (!ogType) {
    pushWarning('Open Graph type absent', 'La balise og:type est absente.');
  }

  const ogSiteName = getMetaContent(body, 'og:site_name');
  if (!ogSiteName) {
    pushWarning('Open Graph site_name absent', 'La balise og:site_name est absente.');
  }

  const ogUrl = getMetaContent(body, 'og:url');
  if (!ogUrl) {
    pushMissing('Open Graph URL absente', 'La balise og:url est absente.');
  } else {
    const resolvedOgUrl = resolveSeoUrlLikeValue(ogUrl, url);
    if (!resolvedOgUrl) {
      pushMissing('Open Graph URL invalide', `La valeur og:url (${ogUrl}) n’est pas une URL valide.`);
    } else if (resolvedOgUrl.protocol !== 'https:') {
      pushWarning('Open Graph URL non sécurisée', `La balise og:url pointe vers ${resolvedOgUrl.toString()}. Elle devrait utiliser HTTPS.`);
    }
  }

  const ogImage = getMetaContent(body, 'og:image');
  if (!ogImage) {
    pushMissing('Open Graph image absente', 'La balise og:image est absente.');
  } else {
    const resolvedOgImage = resolveSeoUrlLikeValue(ogImage, url);
    if (!resolvedOgImage) {
      pushMissing('Open Graph image invalide', `La valeur og:image (${ogImage}) n’est pas une URL valide.`);
    } else if (resolvedOgImage.protocol !== 'https:') {
      pushWarning('Open Graph image non sécurisée', `La balise og:image pointe vers ${resolvedOgImage.toString()}. Il faut une URL HTTPS.`);
    }
  }

  const twitterCard = getMetaContent(body, 'twitter:card');
  if (!twitterCard) {
    pushWarning('Twitter Card absente', 'La balise twitter:card est absente.');
  }

  const twitterTitle = getMetaContent(body, 'twitter:title');
  if (!twitterTitle) {
    pushWarning('Twitter title absent', 'La balise twitter:title est absente.');
  }

  const twitterDescription = getMetaContent(body, 'twitter:description');
  if (!twitterDescription) {
    pushWarning('Twitter description absente', 'La balise twitter:description est absente.');
  }

  const twitterImage = getMetaContent(body, 'twitter:image');
  if (!twitterImage) {
    pushWarning('Twitter image absente', 'La balise twitter:image est absente.');
  } else {
    const resolvedTwitterImage = resolveSeoUrlLikeValue(twitterImage, url);
    if (!resolvedTwitterImage) {
      pushWarning('Twitter image invalide', `La valeur twitter:image (${twitterImage}) n’est pas une URL valide.`);
    } else if (resolvedTwitterImage.protocol !== 'https:') {
      pushWarning('Twitter image non sécurisée', `La balise twitter:image pointe vers ${resolvedTwitterImage.toString()}. Elle devrait utiliser HTTPS.`);
    }
  }

  return issues;
}

function isRefonteTheme(themeSchemaName: string | null, themeName: string | null) {
  const normalizedSchemaName = themeSchemaName?.trim().toLowerCase() || '';
  const normalizedThemeName = themeName?.trim().toLowerCase() || '';

  return normalizedSchemaName === 'dawn' || normalizedSchemaName === 'refresh'
    || normalizedThemeName === 'dawn' || normalizedThemeName === 'refresh';
}

function buildCatalogUrl(url: string) {
  const parsed = new URL(url);
  parsed.pathname = '/collections/all';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function extractProductCount(body: string) {
  const productHandles = new Set<string>();
  const productRegex = /href=["']([^"']*\/products\/([^"'?#/]+)[^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = productRegex.exec(body)) !== null) {
    productHandles.add(decodeURIComponent(match[2]).toLowerCase());
  }

  return productHandles.size;
}

function extractMedianProductPrice(body: string) {
  const prices: number[] = [];
  const normalizedBody = body.replace(/\s+/g, ' ');
  const priceRegex = /(?:€\s*)?([0-9]{1,5}(?:[.,][0-9]{2})?)\s*(?:€|eur\b)/gi;
  let match: RegExpExecArray | null;

  while ((match = priceRegex.exec(normalizedBody)) !== null) {
    const value = Number(String(match[1]).replace(',', '.'));
    if (Number.isFinite(value) && value > 0 && value < 100000) {
      prices.push(value);
    }
  }

  if (prices.length === 0) {
    return null;
  }

  prices.sort((left, right) => left - right);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0
    ? (prices[middle - 1] + prices[middle]) / 2
    : prices[middle];

  return Math.round(median * 100) / 100;
}

function detectGiftCard(body: string) {
  const text = decodeHtmlEntities(body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).toLowerCase();
  return /\b(carte\s+cadeau|cartes\s+cadeaux|gift\s+card|giftcard|bon\s+cadeau)\b/i.test(text);
}

function extractHtmlLang(body: string) {
  const match = body.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function extractLanguageCodeFromLocale(value: string | null) {
  const normalized = String(value || '').trim().replace('_', '-');
  if (!normalized) {
    return null;
  }

  const language = normalized.split('-').filter(Boolean)[0]?.trim().toLowerCase();
  return language && /^[a-z]{2,3}$/.test(language) ? language : null;
}

function extractOgLocale(body: string) {
  return getMetaContent(body, 'og:locale');
}

function getLanguageName(languageCode: string | null) {
  if (!languageCode) {
    return null;
  }

  try {
    return new Intl.DisplayNames(['fr'], { type: 'language' }).of(languageCode.toLowerCase()) || languageCode.toLowerCase();
  } catch {
    return languageCode.toLowerCase();
  }
}

function getCountryName(countryCode: string | null) {
  if (!countryCode) {
    return null;
  }

  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(countryCode.toUpperCase()) || countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

function extractCountryCodeFromLocale(value: string | null) {
  const normalized = String(value || '').trim().replace('_', '-');
  if (!normalized) {
    return null;
  }

  const parts = normalized.split('-').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const region = parts[1].trim().toUpperCase();
  return /^[A-Z]{2}$/.test(region) ? region : null;
}

function extractCountryCodeFromHostname(hostname: string) {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.endsWith('.co.uk') || normalized.endsWith('.uk')) return 'GB';
  if (normalized.endsWith('.com.au') || normalized.endsWith('.au')) return 'AU';
  if (normalized.endsWith('.com.br') || normalized.endsWith('.br')) return 'BR';
  if (normalized.endsWith('.ca')) return 'CA';
  if (normalized.endsWith('.ch')) return 'CH';
  if (normalized.endsWith('.de')) return 'DE';
  if (normalized.endsWith('.es')) return 'ES';
  if (normalized.endsWith('.fi')) return 'FI';
  if (normalized.endsWith('.fr')) return 'FR';
  if (normalized.endsWith('.it')) return 'IT';
  if (normalized.endsWith('.lu')) return 'LU';
  if (normalized.endsWith('.nl')) return 'NL';
  if (normalized.endsWith('.no')) return 'NO';
  if (normalized.endsWith('.pt')) return 'PT';
  if (normalized.endsWith('.be')) return 'BE';
  if (normalized.endsWith('.se')) return 'SE';
  if (normalized.endsWith('.us')) return 'US';
  if (normalized.endsWith('.ie')) return 'IE';
  if (normalized.endsWith('.jp')) return 'JP';
  if (normalized.endsWith('.mx')) return 'MX';
  if (normalized.endsWith('.pl')) return 'PL';
  if (normalized.endsWith('.cz')) return 'CZ';
  if (normalized.endsWith('.dk')) return 'DK';
  if (normalized.endsWith('.gr')) return 'GR';
  if (normalized.endsWith('.hu')) return 'HU';
  if (normalized.endsWith('.ro')) return 'RO';
  if (normalized.endsWith('.sk')) return 'SK';
  if (normalized.endsWith('.tr')) return 'TR';
  if (normalized.endsWith('.za')) return 'ZA';

  const lastLabel = normalized.split('.').pop() || '';
  return /^[a-z]{2}$/.test(lastLabel) ? lastLabel.toUpperCase() : null;
}

function detectSiteCountry(body: string, url: string) {
  const candidates = [extractOgLocale(body)];

  for (const candidate of candidates) {
    const countryCode = extractCountryCodeFromLocale(candidate);
    if (countryCode) {
      return {
        siteCountryCode: countryCode,
        siteCountryName: getCountryName(countryCode),
      };
    }
  }

  try {
    const countryCode = extractCountryCodeFromHostname(new URL(url).hostname);
    if (countryCode) {
      return {
        siteCountryCode: countryCode,
        siteCountryName: getCountryName(countryCode),
      };
    }
  } catch {
    // Ignore invalid URLs here; the caller already validates inputs.
  }

  return {
    siteCountryCode: null,
    siteCountryName: null,
  };
}

function detectSiteLanguage(body: string) {
  const candidates = [extractHtmlLang(body), extractOgLocale(body)];

  for (const candidate of candidates) {
    const languageCode = extractLanguageCodeFromLocale(candidate);
    if (languageCode) {
      return {
        siteLanguageCode: languageCode,
        siteLanguageName: getLanguageName(languageCode),
      };
    }
  }

  return {
    siteLanguageCode: null,
    siteLanguageName: null,
  };
}

async function inspectShopifyLegalNoticePage(url: string, timeoutMs = DEFAULT_SCAN_TIMEOUT_MS) {
  const legalNoticeUrl = new URL('/policies/legal-notice', url).toString();

  try {
    const response = await fetchHtmlWithTimeout(legalNoticeUrl, timeoutMs);
    const normalizedBody = response.body.replace(/\s+/g, ' ').trim().toLowerCase();
    const notFound =
      response.status === 404
      || response.status === 410
      || normalizedBody.includes('page not found')
      // || normalizedBody.includes('404')
      || normalizedBody.includes('not found');

    if (notFound || response.body.trim().length === 0) {
      return {
        shopifyLegalNoticeStatus: 'not_found',
        shopifyLegalNoticeUrl: null,
      };
    }

    return {
      shopifyLegalNoticeStatus: 'found',
      shopifyLegalNoticeUrl: legalNoticeUrl,
    };
  } catch {
    return {
      shopifyLegalNoticeStatus: 'error',
      shopifyLegalNoticeUrl: null,
    };
  }
}

export function extractSiteName(body: string, url: string) {
  const metaName = getMetaContent(body, 'og:site_name') || getMetaContent(body, 'application-name');

  if (metaName) {
    return decodeHtmlEntities(metaName);
  }

  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1])
      .replace(/\s+[|-]\s+.*$/u, '')
      .trim();
  }

  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

export function detectShopify({
  body,
  headers,
}: {
  body: string;
  headers: Headers;
}) {
  const normalize = (value: string | null) =>
    value?.toLowerCase() || '';

  const server = normalize(headers.get('server'));
  const poweredBy = normalize(headers.get('x-powered-by'));

  // Si Shopify est déjà détecté dans les headers,
  // inutile d'analyser tout le HTML
  if (
    server.includes('shopify') ||
    poweredBy.includes('shopify')
  ) {
    return { isShopify: true };
  }

  const normalizedBody = body.toLowerCase();

  const signals = [
    'cdn.shopify.com',
    'shopify.theme',
    'window.shopify',
    'shopify.shop',
    '/cdn/shop/',
    'myshopify.com',
  ];

  return {
    isShopify: signals.some((signal) =>
      normalizedBody.includes(signal)
    ),
  };
}

export function detectShopifyTheme(body: string) {
  const patterns = [
    /Shopify\.theme\s*=\s*({[\s\S]*?});/i,
    /"theme"\s*:\s*({[^{}]*(?:"schema_name"|"name")[^{}]*})/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (!match) {
      continue;
    }

    try {
      const normalized = match[1].replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      const theme = JSON.parse(normalized) as {
        id?: string | number;
        theme_store_id?: string | number;
        name?: string;
        schema_name?: string;
      };

      return {
        id: theme.id || theme.theme_store_id ? String(theme.id || theme.theme_store_id) : null,
        name: theme.name || null,
        schemaName: theme.schema_name || null,
        raw: theme,
      };
    } catch {
      const nameMatch = match[1].match(/["']name["']\s*:\s*["']([^"']+)["']/i);
      const schemaNameMatch = match[1].match(/["']schema_name["']\s*:\s*["']([^"']+)["']/i);
      const idMatch = match[1].match(/["'](?:id|theme_store_id)["']\s*:\s*["']?([0-9]+)["']?/i);

      return {
        id: idMatch ? idMatch[1] : null,
        name: nameMatch ? nameMatch[1] : null,
        schemaName: schemaNameMatch ? schemaNameMatch[1] : null,
        raw: match[1],
      };
    }
  }

  const assetMatch = body.match(/\/cdn\/shop\/t\/\d+\/assets\/(?:base|theme)\.css/i);
  return {
    id: null,
    name: assetMatch && /dawn/i.test(body) ? 'Dawn' : null,
    schemaName: null,
    raw: null,
  };
}

type ShopifySiteInspection = ShopifyScanResult;

export interface ShopifyTechnicalInspection {
  shopifyThemeStoreType?: ShopifyThemeStoreType | null;
  shopifyThemeName: string | null;
  shopifyThemeId: string | null;
  shopifyThemeSchemaName: string | null;
  shopifyThemeJson: string | null;
  redesignStatus: string | null;
}

export function detectCms({ body, headers }: { body: string; headers: Headers }) {
  const normalizedBody = body.toLowerCase();
  const poweredBy = (headers.get('x-powered-by') || '').toLowerCase();
  const generator = getMetaContent(body, 'generator') || '';
  const normalizedGenerator = generator.toLowerCase();
  const signals = [
    { name: 'Shopify', tests: ['cdn.shopify.com', 'shopify.theme', 'window.shopify', '/cdn/shop/'] },
    { name: 'WooCommerce', tests: ['woocommerce', 'wc-cart-fragments', 'wp-content/plugins/woocommerce'] },
    { name: 'WordPress', tests: ['wp-content/', 'wp-includes/', 'wordpress'] },
    { name: 'PrestaShop', tests: ['prestashop', '/modules/', 'var prestashop'] },
    { name: 'Magento', tests: ['mage/cookies', 'magento', 'x-magento'] },
    { name: 'Wix', tests: ['wixstatic.com', 'x-wix-', 'wix.com'] },
    { name: 'Squarespace', tests: ['squarespace.com', 'static1.squarespace.com'] },
    { name: 'Webflow', tests: ['webflow.js', 'webflow.io', 'data-wf-page'] },
    { name: 'Framer', tests: ['framerusercontent.com', 'framer.com', 'framer-motion'] },
    { name: 'BigCommerce', tests: ['bigcommerce.com', 'cdn11.bigcommerce.com', 'stencil-utils'] },
    { name: 'Drupal', tests: ['drupal.settings', 'sites/default/files', 'drupal.org'] },
    { name: 'Joomla', tests: ['joomla', 'com_content', 'mod_'] },
    { name: 'OpenCart', tests: ['opencart', 'catalog/view/theme', 'index.php?route='] },
  ];

  for (const signal of signals) {
    const evidence = signal.tests.filter(
      (test) => normalizedBody.includes(test) || poweredBy.includes(test) || normalizedGenerator.includes(test),
    );

    if (evidence.length > 0) {
      return { name: signal.name, evidence: evidence.slice(0, 5).join(', ') };
    }
  }

  return { name: 'Custom / Static', evidence: null };
}

type WorkflowStepName = 'shopify' | 'cms_detection' | 'language' | 'seo_meta' | 'legal_notice' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse';
const LIGHTHOUSE_ELIGIBLE_CMS = new Set([
  'Shopify',
  'WooCommerce',
  'WordPress',
  'PrestaShop',
  'Magento',
  'Wix',
  'Squarespace',
  'Webflow',
  'Framer',
  'BigCommerce',
  'Drupal',
  'Joomla',
  'OpenCart',
]);

export async function fetchHtmlWithTimeout(url: string, timeoutMs = DEFAULT_SCAN_TIMEOUT_MS): Promise<FetchHtmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ProspectionMagify/1.0 Shopify checker',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const headersReceivedAt = performance.now();
    const contentType = response.headers.get('content-type') || '';
    let body = '';

    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      body = await response.text();
    }
    const finishedAt = performance.now();

    return {
      body,
      headers: response.headers,
      status: response.status,
      metrics: {
        ttfbMs: Math.round(headersReceivedAt - startedAt),
        totalMs: Math.round(finishedAt - startedAt),
        htmlBytes: Buffer.byteLength(body, 'utf8'),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

type ScanLaunchOptions = {
  steps?: ScanLaunchStepKey[];
  overwriteMode?: ScanLaunchOverwriteMode;
  timeoutMs?: number;
  force?: boolean;
  filters?: ScanLaunchFilters;
};

export type ScanLaunchJobData = {
  launchId: number;
  target: ScanLaunchTarget;
  steps: ScanLaunchStepKey[];
  options: {
    timeoutMs?: number;
    overwriteMode?: ScanLaunchOverwriteMode;
  };
};

export interface ScanLaunchRunStatus {
  id: number;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'error';
  totalUrls: number;
  processedUrls: number;
  runningUrls: number;
  pendingUrls: number;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  currentUrlId: number | null;
  updatedAt: string | null;
  changes: ScanLaunchChange[];
}

export type ScanLaunchChange = {
  urlId: number;
  url: string;
  siteName: string | null;
  step: ScanLaunchStepKey;
  stepLabel: string;
  field: string;
  fieldLabel: string;
  before: string | null;
  after: string | null;
};

const SCAN_LAUNCH_STEP_LABELS: Record<ScanLaunchStepKey, string> = {
  shopify: 'Détection Shopify',
  cms_detection: 'Détection CMS hors Shopify',
  language: 'Détection langue du site',
  seo_meta: 'Vérification balises SEO',
  legal_notice: 'Vérification mentions légales',
  catalog: 'Catalogue produits',
  contact: 'Recherche contact',
  linkedin: 'Enrichissement LinkedIn',
  social: 'Enrichissement autres réseaux',
  technical: 'Analyse technique Shopify',
  lighthouse: 'Audit Lighthouse',
};

const SCAN_LAUNCH_FIELD_MAP: Record<ScanLaunchStepKey, string[]> = {
  shopify: [
    'shopify_status',
    'shopify_checked_at',
    'http_status',
    'site_name',
    'shopify_theme_name',
    'shopify_theme_id',
    'shopify_theme_schema_name',
    'shopify_theme_json',
    'redesign_status',
    'site_country_code',
    'site_country_name',
    'scan_ttfb_ms',
    'scan_total_ms',
    'scan_html_bytes',
  ],
  cms_detection: [
    'cms_name',
  ],
  language: [
    'site_language_code',
    'site_language_name',
  ],
  seo_meta: [
    'seo_meta_checked_at',
  ],
  legal_notice: [
    'shopify_legal_notice_status',
    'shopify_legal_notice_url',
    'shopify_legal_notice_checked_at',
  ],
  catalog: [
    'product_count',
    'median_product_price',
    'gift_card_detected',
    'catalog_checked_at',
  ],
  contact: [
    'contact_status',
    'contact_checked_at',
    'contact_email',
    'contact_phone',
    'contact_siret',
    'contact_siren',
    'contact_first_name',
    'contact_last_name',
    'contact_owner_name',
    'contact_company_name',
    'contact_source_url',
    'contact_evidence',
    'contact_linkedin_url',
    'contact_company_linkedin_url',
    'contact_social_links_json',
  ],
  linkedin: [
    'contact_linkedin_url',
    'contact_company_linkedin_url',
    'contact_social_links_json',
  ],
  social: [
    'contact_social_links_json',
  ],
  technical: [
    'shopify_theme_name',
    'shopify_theme_id',
    'shopify_theme_schema_name',
    'shopify_theme_json',
    'redesign_status',
  ],
  lighthouse: [
    'lighthouse_checked_at',
    'lighthouse_score',
    'lighthouse_performance_score',
    'lighthouse_accessibility_score',
    'lighthouse_best_practices_score',
    'lighthouse_seo_score',
    'lighthouse_report_json',
    'lighthouse_observations_json',
  ],
};

const SCAN_LAUNCH_FIELD_LABELS: Record<string, string> = {
  shopify_status: 'Statut Shopify',
  shopify_checked_at: 'Shopify vérifié le',
  http_status: 'Code HTTP',
  site_name: 'Nom du site',
  cms_name: 'CMS',
  shopify_theme_name: 'Nom du thème',
  shopify_theme_id: 'ID du thème',
  shopify_theme_schema_name: 'Schema du thème',
  shopify_theme_json: 'JSON du thème',
  redesign_status: 'Statut refonte',
  site_country_code: 'Pays du site (code)',
  site_country_name: 'Pays du site',
  site_language_code: 'Langue du site (code)',
  site_language_name: 'Langue du site',
  seo_meta_checked_at: 'SEO meta vérifié le',
  scan_ttfb_ms: 'TTFB',
  scan_total_ms: 'Temps total',
  scan_html_bytes: 'Poids HTML',
  shopify_legal_notice_status: 'Mentions légales',
  shopify_legal_notice_url: 'URL mentions légales',
  shopify_legal_notice_checked_at: 'Mentions légales vérifiées le',
  product_count: 'Nombre de produits',
  median_product_price: 'Prix médian',
  gift_card_detected: 'Carte cadeau détectée',
  catalog_checked_at: 'Catalogue vérifié le',
  contact_status: 'Statut contact',
  contact_checked_at: 'Contact vérifié le',
  contact_email: 'Email',
  contact_phone: 'Téléphone',
  contact_siret: 'SIRET',
  contact_siren: 'SIREN',
  contact_first_name: 'Prénom',
  contact_last_name: 'Nom',
  contact_owner_name: 'Propriétaire',
  contact_company_name: 'Société',
  contact_source_url: 'Source contact',
  contact_evidence: 'Preuve contact',
  contact_linkedin_url: 'LinkedIn',
  contact_company_linkedin_url: 'LinkedIn société',
  contact_social_links_json: 'Réseaux sociaux',
  lighthouse_checked_at: 'Lighthouse vérifié le',
  lighthouse_score: 'Score Lighthouse',
  lighthouse_performance_score: 'Performance',
  lighthouse_accessibility_score: 'Accessibilité',
  lighthouse_best_practices_score: 'Bonnes pratiques',
  lighthouse_seo_score: 'SEO',
  lighthouse_report_json: 'Rapport Lighthouse',
  lighthouse_observations_json: 'Observations Lighthouse',
};

function formatScanLaunchValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? JSON.stringify(value) : null;
  }

  return JSON.stringify(value);
}

@Injectable()
export class ScanningService implements OnModuleDestroy {
  private readonly launchEventsSubject = new Subject<MessageEvent>();
  private launchRunId = 0;
  private launchRun: ScanLaunchRunStatus = {
    id: 0,
    status: 'idle',
    totalUrls: 0,
    processedUrls: 0,
    runningUrls: 0,
    pendingUrls: 0,
    queuedAt: null,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    currentUrlId: null,
    updatedAt: null,
    changes: [],
  };

  constructor(
    private readonly urlsService: UrlsService,
    private readonly contactsService: ContactsService,
    private readonly lighthouseService: LighthouseService,
    private readonly siteSettingsService: SiteSettingsService,
    @InjectQueue(SCAN_LAUNCH_QUEUE)
    private readonly scanLaunchQueue: Queue<ScanLaunchJobData>,
  ) {}

  private async resolveScanTimeoutMs(timeoutMs?: number) {
    if (Number.isFinite(timeoutMs as number) && Number(timeoutMs) > 0) {
      return Number(timeoutMs);
    }

    const settings = await this.siteSettingsService.getScanTimeout();
    return settings.timeoutMs;
  }

  onModuleDestroy() {
    this.launchEventsSubject.complete();
  }

  getLaunchStatus() {
    return this.launchRun;
  }

  streamLaunchEvents(): Observable<MessageEvent> {
    return this.launchEventsSubject.asObservable();
  }

  private emitLaunchEvent(type: string, data: ScanLaunchRunStatus) {
    this.launchEventsSubject.next({
      type,
      data,
    });
  }

  private updateLaunchRun(patch: Partial<ScanLaunchRunStatus>, eventType = 'scan-launch.updated') {
    this.launchRun = {
      ...this.launchRun,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.emitLaunchEvent(eventType, this.launchRun);
  }

  private async getEnabledDefaultScanSteps() {
    const { steps } = await this.siteSettingsService.getScanSteps();
    return new Set(steps.filter((step) => step.enabled).map((step) => step.key as ScanStepKey));
  }

  private async isCmsDetectionEnabled() {
    const settings = await this.siteSettingsService.getScanSteps();
    return settings.steps.some((step) => step.key === 'cms_detection' && step.enabled);
  }

  private async fetchSiteHtml(url: string, timeoutMs?: number) {
    return fetchHtmlWithTimeout(url, await this.resolveScanTimeoutMs(timeoutMs));
  }

  private async recordScanTiming(id: number, key: ScanTimingKey, startedAt: number) {
    await this.urlsService.updateScanTimings(id, {
      [key]: Date.now() - startedAt,
    } as Record<ScanTimingKey, number>);
  }

  async inspectSeoMetaSite(url: string, options: { timeoutMs?: number } = {}) {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const issues = collectSeoMetaIssues(response.body, url);

      return {
        seoMetaStatus: issues.length === 0 ? 'valid' : 'invalid',
        issues,
        httpStatus: response.status,
        ttfbMs: response.metrics.ttfbMs,
        totalMs: response.metrics.totalMs,
        htmlBytes: response.metrics.htmlBytes,
      };
    } catch {
      return {
        seoMetaStatus: 'invalid',
        issues: [
          {
            title: 'Page SEO inaccessible',
            detail: 'La page n’a pas pu être analysée pour vérifier ses balises SEO.',
            severity: 'warning' as const,
          },
        ],
        httpStatus: null,
        ttfbMs: null,
        totalMs: null,
        htmlBytes: null,
      };
    }
  }

  async inspectCmsDetectionSite(url: string, options: { timeoutMs?: number } = {}): Promise<CmsDetectionInspection> {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const cms = detectCms({
        body: response.body,
        headers: response.headers,
      });

      return {
        cmsName: cms.name,
        httpStatus: response.status,
        ttfbMs: response.metrics.ttfbMs,
        totalMs: response.metrics.totalMs,
        htmlBytes: response.metrics.htmlBytes,
      };
    } catch {
      return {
        cmsName: null,
        httpStatus: null,
        ttfbMs: null,
        totalMs: null,
        htmlBytes: null,
      };
    }
  }

  private collectLaunchChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    steps: ScanLaunchStepKey[],
    target: { id: number; url: string; siteName: string | null },
  ) {
    const allowedFields = new Set<string>();

    for (const step of steps) {
      for (const field of SCAN_LAUNCH_FIELD_MAP[step] || []) {
        allowedFields.add(field);
      }
    }

    const changes: ScanLaunchChange[] = [];

    for (const field of allowedFields) {
      const beforeValue = formatScanLaunchValue(before[field]);
      const afterValue = formatScanLaunchValue(after[field]);

      if (beforeValue === afterValue) {
        continue;
      }

      changes.push({
        urlId: target.id,
        url: target.url,
        siteName: target.siteName,
        step: steps.find((step) => (SCAN_LAUNCH_FIELD_MAP[step] || []).includes(field)) || 'shopify',
        stepLabel: SCAN_LAUNCH_STEP_LABELS[steps.find((step) => (SCAN_LAUNCH_FIELD_MAP[step] || []).includes(field)) || 'shopify'],
        field,
        fieldLabel: SCAN_LAUNCH_FIELD_LABELS[field] || field,
        before: beforeValue,
        after: afterValue,
      });
    }

    return changes;
  }

  private async runShopifyLegalNoticeStep(
    id: number,
    url: string,
    options: { timeoutMs?: number; writeMode?: ScanWriteMode; persistUrl?: boolean } = {},
  ) {
    const startedAt = Date.now();
    const legalNotice = await this.inspectShopifyLegalNoticeSite(url, {
      timeoutMs: await this.resolveScanTimeoutMs(options.timeoutMs),
    });

    if (options.persistUrl) {
      await this.urlsService.updateShopifyLegalNoticeResult(id, legalNotice, {
        writeMode: options.writeMode,
      });
    } else {
      await this.urlsService.updateShopifyLegalNoticeStatus(
        id,
        {
          shopifyLegalNoticeStatus: legalNotice.shopifyLegalNoticeStatus,
        },
        { writeMode: options.writeMode },
      );
    }

    await this.urlsService.syncMissingLegalNoticeObservation(
      id,
      legalNotice.shopifyLegalNoticeStatus === 'found',
    );

    await this.recordScanTiming(id, 'scanLegalNoticeMs', startedAt);

    return legalNotice;
  }

  shouldRunLighthouse(site: {
    cmsName: string | null;
    contactStatus: string;
  }) {
    const cmsName = site.cmsName?.trim() || '';

    if (site.contactStatus !== 'found') {
      return false;
    }

    if (!cmsName) {
      return false;
    }

    if (cmsName === 'unknown' || cmsName === 'Custom / Static') {
      return false;
    }

    return LIGHTHOUSE_ELIGIBLE_CMS.has(cmsName);
  }

  private async recalculateLeadScoreAfterScan(urlId: number) {
    await this.urlsService.recalculateLeadScoreFromUrlId(urlId).catch(() => undefined);
  }

  private withContactShopifyDependency(steps: Set<ScanStepKey>) {
    if (steps.has('contact')) {
      steps.add('shopify');
    }

    return steps;
  }

  private buildContactResultFromSite(site: {
    contactEmail: string | null;
    contactPhone: string | null;
    contactSiret: string | null;
    contactSiren: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
    contactOwnerName: string | null;
    contactCompanyName: string | null;
    contactSourceUrl: string | null;
    contactEvidence: string | null;
    contactLinkedinUrl: string | null;
    contactCompanyLinkedinUrl: string | null;
    contactSocialLinksJson: string | null;
    url: string;
  }, linkedinUrl: string | null): Omit<ContactResult, 'status'> {
    return {
      email: site.contactEmail,
      phone: site.contactPhone,
      siret: site.contactSiret,
      siren: site.contactSiren,
      firstName: site.contactFirstName,
      lastName: site.contactLastName,
      ownerName: site.contactOwnerName,
      companyName: site.contactCompanyName,
      sourceUrl: site.contactSourceUrl || site.url,
      evidence: site.contactEvidence,
      linkedinUrl,
      companyLinkedinUrl: site.contactCompanyLinkedinUrl,
      linkedinImageUrl: null,
      socialLinks: JSON.parse(site.contactSocialLinksJson || '[]'),
    };
  }

  async inspectShopifySite(url: string, options: { timeoutMs?: number } = {}): Promise<ShopifySiteInspection> {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const result = detectShopify({
        body: response.body,
        headers: response.headers,
      });
      const siteCountry = detectSiteCountry(response.body, url);
      const theme = result.isShopify
        ? detectShopifyTheme(response.body)
        : { id: null, name: null, schemaName: null, raw: null };
      const cms = result.isShopify
        ? { name: 'Shopify' }
        : { name: null };
      const themeSchemaName = theme.schemaName || null;

      return {
        httpStatus: response.status,
        shopifyStatus: result.isShopify ? 'shopify' : 'not_shopify',
        siteName: extractSiteName(response.body, url),
        cmsName: cms.name,
        siteCountryCode: siteCountry.siteCountryCode,
        siteCountryName: siteCountry.siteCountryName,
        shopifyThemeStoreType: getShopifyThemeStoreType({
          shopifyStatus: result.isShopify ? 'shopify' : 'not_shopify',
          shopifyThemeName: theme.name,
          shopifyThemeSchemaName: themeSchemaName,
          shopifyThemeJson: theme.raw ? JSON.stringify(theme.raw) : null,
        }),
        ttfbMs: response.metrics.ttfbMs,
        totalMs: response.metrics.totalMs,
        htmlBytes: response.metrics.htmlBytes,
        redesignStatus: result.isShopify ? null : 'candidat migration',
      };
    } catch (error) {
      const typedError = error as Error;

      return {
        httpStatus: null,
        shopifyStatus: 'error',
        siteName: null,
        cmsName: null,
        siteCountryCode: null,
        siteCountryName: null,
        shopifyThemeStoreType: 'custom',
        ttfbMs: null,
        totalMs: null,
        htmlBytes: null,
        redesignStatus: null,
      };
    }
  }

  async inspectSiteLanguage(url: string, options: { timeoutMs?: number } = {}): Promise<SiteLanguageInspection> {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const siteLanguage = detectSiteLanguage(response.body);

      return {
        siteLanguageCode: siteLanguage.siteLanguageCode,
        siteLanguageName: siteLanguage.siteLanguageName,
        httpStatus: response.status,
        ttfbMs: response.metrics.ttfbMs,
        totalMs: response.metrics.totalMs,
        htmlBytes: response.metrics.htmlBytes,
      };
    } catch {
      return {
        siteLanguageCode: null,
        siteLanguageName: null,
        httpStatus: null,
        ttfbMs: null,
        totalMs: null,
        htmlBytes: null,
      };
    }
  }

  async inspectShopifyLegalNoticeSite(url: string, options: { timeoutMs?: number } = {}): Promise<ShopifyLegalNoticeInspection> {
    return inspectShopifyLegalNoticePage(url, await this.resolveScanTimeoutMs(options.timeoutMs));
  }

  async inspectShopifyTechnical(url: string, options: { timeoutMs?: number } = {}): Promise<ShopifyTechnicalInspection> {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const result = detectShopify({
        body: response.body,
        headers: response.headers,
      });

      if (!result.isShopify) {
        return {
          shopifyThemeStoreType: 'custom',
          shopifyThemeName: null,
          shopifyThemeId: null,
          shopifyThemeSchemaName: null,
          shopifyThemeJson: null,
          redesignStatus: 'candidat migration',
        };
      }

      const theme = detectShopifyTheme(response.body);
      const themeSchemaName = theme.schemaName || null;

      return {
        shopifyThemeStoreType: getShopifyThemeStoreType({
          shopifyStatus: 'shopify',
          shopifyThemeName: theme.name,
          shopifyThemeSchemaName: themeSchemaName,
          shopifyThemeJson: theme.raw ? JSON.stringify(theme.raw) : null,
        }),
        shopifyThemeName: theme.name,
        shopifyThemeId: theme.id,
        shopifyThemeSchemaName: themeSchemaName,
        shopifyThemeJson: theme.raw ? JSON.stringify(theme.raw) : null,
        redesignStatus: isRefonteTheme(themeSchemaName, theme.name) ? 'candidat refonte' : null,
      };
    } catch {
      return {
        shopifyThemeStoreType: 'custom',
        shopifyThemeName: null,
        shopifyThemeId: null,
        shopifyThemeSchemaName: null,
        shopifyThemeJson: null,
        redesignStatus: null,
      };
    }
  }

  async inspectLighthouseSite(url: string, options: { timeoutMs?: number } = {}): Promise<LighthouseAuditResult> {
    try {
      const result = await this.lighthouseService.audit(url);

      return {
        lighthouseScore: result.scores.overall,
        lighthousePerformanceScore: result.scores.performance,
        lighthouseAccessibilityScore: result.scores.accessibility,
        lighthouseBestPracticesScore: result.scores.bestPractices,
        lighthouseSeoScore: result.scores.seo,
        lighthouseObservationsJson: JSON.stringify(result.observations || []),
        lighthouseReportJson: JSON.stringify(result),
      };
    } catch {
      return {
        lighthouseScore: null,
        lighthousePerformanceScore: null,
        lighthouseAccessibilityScore: null,
        lighthouseBestPracticesScore: null,
        lighthouseSeoScore: null,
        lighthouseObservationsJson: null,
        lighthouseReportJson: null,
      };
    }
  }

  async inspectProductCatalog(url: string, options: { timeoutMs?: number } = {}): Promise<ProductCatalogScanResult> {
    try {
      const response = await this.fetchSiteHtml(buildCatalogUrl(url), options.timeoutMs);
      return {
        productCount: extractProductCount(response.body),
        medianProductPrice: extractMedianProductPrice(response.body),
        giftCardDetected: detectGiftCard(response.body),
      };
    } catch {
      return {
        productCount: null,
        medianProductPrice: null,
        giftCardDetected: false,
      };
    }
  }

  async checkOneShopifyUrl(url: string, options: { timeoutMs?: number } = {}): Promise<ShopifySiteInspection> {
    try {
      const response = await this.fetchSiteHtml(url, options.timeoutMs);
      const result = detectShopify({
        body: response.body,
        headers: response.headers,
      });
      const siteCountry = detectSiteCountry(response.body, url);
      const cms = result.isShopify
        ? { name: 'Shopify' }
        : { name: null };
      const theme = result.isShopify
        ? detectShopifyTheme(response.body)
        : { id: null, name: null, schemaName: null, raw: null };
      const themeSchemaName = theme.schemaName || null;
      const shopifyThemeStoreType = getShopifyThemeStoreType({
        shopifyStatus: result.isShopify ? 'shopify' : 'not_shopify',
        shopifyThemeName: theme.name,
        shopifyThemeSchemaName: themeSchemaName,
        shopifyThemeJson: theme.raw ? JSON.stringify(theme.raw) : null,
      });
      const redesignStatus = result.isShopify
        ? isRefonteTheme(themeSchemaName, theme.name)
          ? 'candidat refonte'
          : null
        : 'candidat migration';

      return {
        httpStatus: response.status,
        shopifyStatus: result.isShopify ? 'shopify' : 'not_shopify',
        siteName: extractSiteName(response.body, url),
        cmsName: cms.name,
        siteCountryCode: siteCountry.siteCountryCode,
        siteCountryName: siteCountry.siteCountryName,
        shopifyThemeStoreType,
        shopifyThemeName: theme.name,
        shopifyThemeId: theme.id,
        shopifyThemeSchemaName: themeSchemaName,
        shopifyThemeJson: theme.raw ? JSON.stringify(theme.raw) : null,
        redesignStatus,
        ttfbMs: response.metrics.ttfbMs,
        totalMs: response.metrics.totalMs,
        htmlBytes: response.metrics.htmlBytes,
      };
    } catch (error) {
      const typedError = error as Error;
      return {
        httpStatus: null,
        shopifyStatus: 'error',
        siteName: null,
        cmsName: null,
        siteCountryCode: null,
        siteCountryName: null,
        shopifyThemeStoreType: 'custom',
        shopifyThemeName: null,
        shopifyThemeId: null,
        shopifyThemeSchemaName: null,
        shopifyThemeJson: null,
        redesignStatus: null,
        ttfbMs: null,
        totalMs: null,
        htmlBytes: null,
      };
    }
  }

  async rescanSite(id: number, options: { timeoutMs?: number; force?: boolean } = {}) {
    const site = await this.urlsService.getSite(id);
    const enabledSteps = this.withContactShopifyDependency(await this.getEnabledDefaultScanSteps());
    let shopifyResult: Awaited<ReturnType<ScanningService['checkOneShopifyUrl']>> | null = null;
    const scanStartedAt = Date.now();
    let didExecuteAnyStep = false;
    await this.urlsService.clearScanTimings(id);
    const timeoutMs = await this.resolveScanTimeoutMs(options.timeoutMs);

    try {
      if (enabledSteps.has('shopify')) {
        didExecuteAnyStep = true;
        const shopifyStartedAt = Date.now();
        shopifyResult = await this.checkOneShopifyUrl(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateShopifyResult(id, shopifyResult, { writeMode: 'merge' });

        if (shopifyResult.shopifyStatus === 'shopify') {
          await this.runShopifyLegalNoticeStep(id, site.url, {
            timeoutMs,
            persistUrl: true,
          });
        }

        await this.urlsService.updateScanTimings(id, { scanShopifyMs: Date.now() - shopifyStartedAt });
      }

      const currentShopifyStatus = shopifyResult?.shopifyStatus ?? site.shopifyStatus;
      const currentSiteName = shopifyResult?.siteName ?? site.siteName;
      let currentCmsName = shopifyResult?.cmsName ?? site.cmsName;

      if (enabledSteps.has('cms_detection') && currentShopifyStatus !== 'shopify') {
        didExecuteAnyStep = true;
        const cmsDetectionStartedAt = Date.now();
        const cmsDetection = await this.inspectCmsDetectionSite(site.url, {
          timeoutMs,
        });

        currentCmsName = cmsDetection.cmsName ?? currentCmsName;
        await this.urlsService.updateCmsResult(
          id,
          cmsDetection.cmsName,
          { writeMode: 'merge' },
        );
        await this.recordScanTiming(id, 'scanCmsDetectionMs', cmsDetectionStartedAt);
      }

      if (enabledSteps.has('language')) {
        didExecuteAnyStep = true;
        const languageStartedAt = Date.now();
        const language = await this.inspectSiteLanguage(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSiteLanguageResult(
          id,
          {
            siteLanguageCode: language.siteLanguageCode,
            siteLanguageName: language.siteLanguageName,
          },
          { writeMode: 'clear' },
        );
        await this.recordScanTiming(id, 'scanLanguageMs', languageStartedAt);
      }

      if (enabledSteps.has('seo_meta')) {
        didExecuteAnyStep = true;
        const seoMetaStartedAt = Date.now();
        const seoMeta = await this.inspectSeoMetaSite(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSeoMetaResult(id);
        await this.urlsService.syncSeoMetaObservation(id, seoMeta.issues);
        await this.recordScanTiming(id, 'scanSeoMetaMs', seoMetaStartedAt);
      }

      if (enabledSteps.has('legal_notice') && currentShopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        await this.runShopifyLegalNoticeStep(id, site.url, {
          timeoutMs,
        });
      }

      if (enabledSteps.has('catalog') && currentShopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        const catalogStartedAt = Date.now();
        const productCatalog = await this.inspectProductCatalog(site.url, {
          timeoutMs,
        });
        await this.urlsService.updateProductCatalogResult(id, productCatalog, { writeMode: 'merge' });
        await this.urlsService.updateScanTimings(id, { scanCatalogMs: Date.now() - catalogStartedAt });
      }

      let contactResult = null;
      if (enabledSteps.has('contact') && currentShopifyStatus !== 'error') {
        didExecuteAnyStep = true;
        const contactStartedAt = Date.now();
        contactResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: currentSiteName || site.siteName,
            siren: site.contactSiren,
            companyName: site.contactCompanyName,
            firstName: site.contactFirstName,
            lastName: site.contactLastName,
            ownerName: site.contactOwnerName,
          },
          {
            timeoutMs,
            preferLegalNoticeFirst: currentShopifyStatus === 'shopify',
          },
        );

        if (contactResult.status === 'found') {
          await this.urlsService.updateContactResult(id, contactResult, { writeMode: 'merge' });
        } else {
          await this.urlsService.clearContactResult(id);
        }

        await this.urlsService.updateScanTimings(id, { scanContactMs: Date.now() - contactStartedAt });
      }

      if (enabledSteps.has('linkedin') && currentShopifyStatus !== 'error' && (contactResult?.status ?? site.contactStatus) === 'found') {
        didExecuteAnyStep = true;
        const linkedinStartedAt = Date.now();
        const linkedContact = contactResult?.status === 'found' ? contactResult : null;
        const linkedinUrl = await this.contactsService.searchLinkedinProfile(
          {
            email: linkedContact?.email ?? site.contactEmail,
            phone: linkedContact?.phone ?? site.contactPhone,
            siret: linkedContact?.siret ?? site.contactSiret,
            siren: linkedContact?.siren ?? site.contactSiren,
            firstName: linkedContact?.firstName ?? site.contactFirstName,
            lastName: linkedContact?.lastName ?? site.contactLastName,
            ownerName: linkedContact?.ownerName ?? site.contactOwnerName,
            companyName: linkedContact?.companyName ?? site.contactCompanyName,
            linkedinUrl: linkedContact?.linkedinUrl ?? site.contactLinkedinUrl,
            companyLinkedinUrl: linkedContact?.companyLinkedinUrl ?? site.contactCompanyLinkedinUrl,
            socialLinks: linkedContact?.socialLinks || JSON.parse(site.contactSocialLinksJson || '[]'),
            sourceUrl: linkedContact?.sourceUrl ?? site.contactSourceUrl,
            evidence: linkedContact?.evidence ?? site.contactEvidence,
          },
          { timeoutMs },
        );

        const resolvedLinkedinUrl = linkedinUrl || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl || null;
        if (resolvedLinkedinUrl) {
          const contactLinkedinResult = this.buildContactResultFromSite(site, resolvedLinkedinUrl);
          await this.urlsService.updateContactResult(id, {
            ...contactLinkedinResult,
            status: 'found',
          });
        }

        await this.urlsService.updateScanTimings(id, { scanLinkedinMs: Date.now() - linkedinStartedAt });
      }

      if (enabledSteps.has('social') && currentShopifyStatus !== 'error') {
        didExecuteAnyStep = true;
        const socialStartedAt = Date.now();
        const socialResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: currentSiteName || site.siteName,
            siren: site.contactSiren,
            companyName: site.contactCompanyName,
            firstName: site.contactFirstName,
            lastName: site.contactLastName,
            ownerName: site.contactOwnerName,
          },
          {
            timeoutMs,
            includeLinkedin: false,
            preferLegalNoticeFirst: currentShopifyStatus === 'shopify',
          },
        );

        if (socialResult.status === 'found') {
          await this.urlsService.updateContactResult(id, socialResult, { writeMode: 'merge' });
        }

        await this.urlsService.updateScanTimings(id, { scanSocialMs: Date.now() - socialStartedAt });
      }

      const nextSite = {
        ...site,
        shopifyStatus: currentShopifyStatus ?? site.shopifyStatus,
        cmsName: currentCmsName ?? site.cmsName,
        contactStatus: contactResult?.status ?? site.contactStatus,
      };

      if (!enabledSteps.has('technical') && !enabledSteps.has('lighthouse')) {
        return { shopifyResult, contactResult, lighthouse: null };
      }

      if (enabledSteps.has('technical') && nextSite.shopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        const technicalStartedAt = Date.now();
        const technical = await this.inspectShopifyTechnical(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateShopifyResult(id, {
          httpStatus: nextSite.httpStatus,
          shopifyStatus: nextSite.shopifyStatus,
          siteName: nextSite.siteName,
          cmsName: nextSite.cmsName,
          shopifyThemeName: technical.shopifyThemeName,
          shopifyThemeId: technical.shopifyThemeId,
          shopifyThemeSchemaName: technical.shopifyThemeSchemaName,
          shopifyThemeJson: technical.shopifyThemeJson,
          redesignStatus: technical.redesignStatus,
          ttfbMs: nextSite.scanTtfbMs,
          totalMs: nextSite.scanTotalMs,
          htmlBytes: nextSite.scanHtmlBytes,
        }, { writeMode: 'merge' });

        nextSite.shopifyThemeName = technical.shopifyThemeName;
        nextSite.shopifyThemeId = technical.shopifyThemeId;
        nextSite.shopifyThemeSchemaName = technical.shopifyThemeSchemaName;
        nextSite.shopifyThemeJson = technical.shopifyThemeJson;
        nextSite.redesignStatus = technical.redesignStatus;

        await this.urlsService.updateScanTimings(id, { scanTechnicalMs: Date.now() - technicalStartedAt });
      }

      if (!enabledSteps.has('lighthouse') || !this.shouldRunLighthouse(nextSite)) {
        return { shopifyResult, contactResult, lighthouse: null };
      }

      const lighthouseStartedAt = Date.now();
      didExecuteAnyStep = true;
      const lighthouse = await this.inspectLighthouseSite(site.url, {
        timeoutMs,
      });

      await this.urlsService.updateLighthouseResult(id, lighthouse, { writeMode: 'merge' });
      await this.urlsService.updateScanTimings(id, { scanLighthouseMs: Date.now() - lighthouseStartedAt });

      return { shopifyResult, contactResult, lighthouse };
    } finally {
      if (didExecuteAnyStep) {
        await this.urlsService
          .updateScanTimings(id, { scanWorkflowTotalMs: Date.now() - scanStartedAt })
          .catch(() => undefined);
        await this.recalculateLeadScoreAfterScan(id);
      }
    }
  }

  async runSiteStep(
    id: number,
    step: WorkflowStepName,
    options: { timeoutMs?: number; force?: boolean } = {},
  ) {
    const site = await this.urlsService.getSite(id);
    const stepStartedAt = Date.now();
    let didExecuteStep = false;
    const timeoutMs = await this.resolveScanTimeoutMs(options.timeoutMs);

    try {
      if (step === 'shopify') {
        if (!options.force && site.shopifyCheckedAt) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const shopifyStartedAt = Date.now();
        const shopifyResult = await this.checkOneShopifyUrl(
          site.url,
          {
            timeoutMs,
          },
        );

        await this.urlsService.updateShopifyResult(id, shopifyResult, { writeMode: 'merge' });

        if (shopifyResult.shopifyStatus === 'shopify') {
          await this.runShopifyLegalNoticeStep(id, site.url, {
            timeoutMs,
            persistUrl: true,
          });
        }

        await this.urlsService.updateScanTimings(id, { scanShopifyMs: Date.now() - shopifyStartedAt });

        if (shopifyResult.shopifyStatus === 'shopify') {
          const catalogStartedAt = Date.now();
          const productCatalog = await this.inspectProductCatalog(site.url, {
            timeoutMs,
          });
          await this.urlsService.updateProductCatalogResult(id, productCatalog, { writeMode: 'merge' });
          await this.urlsService.updateScanTimings(id, { scanCatalogMs: Date.now() - catalogStartedAt });
        }

        return { step, processed: 1, total: 1 };
      }

      if (step === 'cms_detection') {
        if (site.shopifyStatus === 'shopify' && !options.force) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        const cmsDetectionStartedAt = Date.now();
        const cmsDetection = await this.inspectCmsDetectionSite(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateCmsResult(id, cmsDetection.cmsName, { writeMode: 'clear' });
        await this.recordScanTiming(id, 'scanCmsDetectionMs', cmsDetectionStartedAt);

        return { step, processed: 1, total: 1 };
      }

      if (step === 'language') {
        if (!options.force && site.siteLanguageCode && site.siteLanguageName) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        const languageStartedAt = Date.now();
        const language = await this.inspectSiteLanguage(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSiteLanguageResult(
          id,
          {
            siteLanguageCode: language.siteLanguageCode,
            siteLanguageName: language.siteLanguageName,
          },
          { writeMode: 'clear' },
        );
        await this.recordScanTiming(id, 'scanLanguageMs', languageStartedAt);

        return { step, processed: 1, total: 1 };
      }

      if (step === 'seo_meta') {
        if (!options.force && site.seoMetaCheckedAt) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        const seoMetaStartedAt = Date.now();
        const seoMeta = await this.inspectSeoMetaSite(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSeoMetaResult(id);
        await this.urlsService.syncSeoMetaObservation(id, seoMeta.issues);
        await this.recordScanTiming(id, 'scanSeoMetaMs', seoMetaStartedAt);

        return {
          step,
          processed: 1,
          total: 1,
          matched: seoMeta.issues.length === 0 ? 1 : 0,
        };
      }

      if (step === 'legal_notice') {
        if (site.shopifyStatus !== 'shopify' && !options.force) {
          return { step, processed: 0, total: 0 };
        }

        if (!options.force && site.shopifyLegalNoticeCheckedAt) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        const legalNotice = await this.runShopifyLegalNoticeStep(id, site.url, {
          timeoutMs,
        });

        return {
          step,
          processed: 1,
          total: 1,
          matched: legalNotice.shopifyLegalNoticeStatus === 'found' ? 1 : 0,
        };
      }

      if (step === 'contact') {
        let currentShopifyStatus = site.shopifyStatus;

        if (!options.force && site.contactCheckedAt) {
          return { step, processed: 0, total: 0 };
        }

        if (currentShopifyStatus !== 'shopify') {
          const shopifyStartedAt = Date.now();
          const shopifyResult = await this.checkOneShopifyUrl(site.url, {
            timeoutMs,
          });

          await this.urlsService.updateShopifyResult(id, shopifyResult, { writeMode: 'merge' });
          await this.recordScanTiming(id, 'scanShopifyMs', shopifyStartedAt);
          currentShopifyStatus = shopifyResult.shopifyStatus;
        }

        if (currentShopifyStatus === 'error' && !options.force) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const contactStartedAt = Date.now();
        const contactResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: site.siteName,
          },
          {
            timeoutMs,
            includeLinkedin: false,
            preferLegalNoticeFirst: currentShopifyStatus === 'shopify',
          },
        );

        if (contactResult.status === 'found') {
          await this.urlsService.updateContactResult(id, contactResult, { writeMode: 'merge' });
        } else {
          await this.urlsService.clearContactResult(id);
        }

        await this.urlsService.updateScanTimings(id, { scanContactMs: Date.now() - contactStartedAt });
        return { step, processed: 1, total: 1 };
      }

      if (step === 'linkedin') {
        if (site.contactStatus !== 'found') {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        if (!options.force && site.contactLinkedinUrl) {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const linkedinStartedAt = Date.now();
        const linkedinUrl = await this.contactsService.searchLinkedinProfile(
          {
            email: site.contactEmail,
            phone: site.contactPhone,
            siret: site.contactSiret,
            siren: site.contactSiren,
            firstName: site.contactFirstName,
            lastName: site.contactLastName,
            ownerName: site.contactOwnerName,
            companyName: site.contactCompanyName,
            linkedinUrl: site.contactLinkedinUrl,
            companyLinkedinUrl: site.contactCompanyLinkedinUrl,
            socialLinks: JSON.parse(site.contactSocialLinksJson || '[]'),
            sourceUrl: site.contactSourceUrl,
            evidence: site.contactEvidence,
          },
          { timeoutMs },
        );

        const resolvedLinkedinUrl = linkedinUrl || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl || null;

        if (!resolvedLinkedinUrl) {
          await this.urlsService.updateScanTimings(id, { scanLinkedinMs: Date.now() - linkedinStartedAt });
          return { step, processed: 1, matched: 0, total: 1 };
        }

        const contactResult = this.buildContactResultFromSite(site, resolvedLinkedinUrl);
        await this.urlsService.updateContactResult(id, {
          ...contactResult,
          status: 'found',
        });

        await this.urlsService.updateScanTimings(id, { scanLinkedinMs: Date.now() - linkedinStartedAt });
        return { step, processed: 1, matched: 1, total: 1 };
      }

      if (step === 'social') {
        if (site.contactStatus !== 'found' && !options.force) {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        if (!options.force && (site.contactSocialLinksJson || '').trim().length > 2) {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const socialStartedAt = Date.now();
        const socialResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: site.siteName,
          },
          { timeoutMs, includeLinkedin: false },
        );

        if (socialResult.status === 'found') {
          await this.urlsService.updateContactResult(id, socialResult, { writeMode: 'merge' });
        }

        await this.urlsService.updateScanTimings(id, { scanSocialMs: Date.now() - socialStartedAt });
        return { step, processed: 1, matched: socialResult.status === 'found' ? 1 : 0, total: 1 };
      }

      if (step === 'technical') {
        if (site.shopifyStatus !== 'shopify') {
          return { step, processed: 0, total: 0 };
        }

        if (!options.force && site.shopifyThemeJson) {
          return { step, processed: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const technicalStartedAt = Date.now();
        const technical = await this.inspectShopifyTechnical(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateShopifyResult(id, {
            httpStatus: site.httpStatus,
            shopifyStatus: site.shopifyStatus,
            siteName: site.siteName,
            cmsName: site.cmsName,
            shopifyThemeName: technical.shopifyThemeName,
          shopifyThemeId: technical.shopifyThemeId,
          shopifyThemeSchemaName: technical.shopifyThemeSchemaName,
          shopifyThemeJson: technical.shopifyThemeJson,
          redesignStatus: technical.redesignStatus,
          ttfbMs: site.scanTtfbMs,
          totalMs: site.scanTotalMs,
          htmlBytes: site.scanHtmlBytes,
        }, { writeMode: 'merge' });

        await this.urlsService.updateScanTimings(id, { scanTechnicalMs: Date.now() - technicalStartedAt });
        return { step, processed: 1, total: 1 };
      }

      if (step === 'lighthouse') {
        if (!options.force && site.lighthouseCheckedAt) {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        if (!this.shouldRunLighthouse(site)) {
          return { step, processed: 0, matched: 0, total: 0 };
        }

        didExecuteStep = true;
        await this.urlsService.clearScanTimings(id);
        const lighthouseStartedAt = Date.now();
        const lighthouse = await this.inspectLighthouseSite(
          site.url,
          {
            timeoutMs,
          },
        );

        await this.urlsService.updateLighthouseResult(id, lighthouse, { writeMode: 'merge' });
        await this.urlsService.updateScanTimings(id, { scanLighthouseMs: Date.now() - lighthouseStartedAt });

        return { step, processed: 1, matched: 1, total: 1 };
      }

      return { step, processed: 0, matched: 0, total: 0 };
    } finally {
      if (didExecuteStep) {
        await this.urlsService
          .updateScanTimings(id, { scanWorkflowTotalMs: Date.now() - stepStartedAt })
          .catch(() => undefined);
      }
    }
  }

  async scanSiteWithLaunchOptions(
    id: number,
    steps: ScanLaunchStepKey[],
    options: { timeoutMs?: number; overwriteMode?: ScanLaunchOverwriteMode } = {},
  ) {
    const site = await this.urlsService.getSite(id);
    const enabledSteps = this.withContactShopifyDependency(new Set<ScanStepKey>(steps as ScanStepKey[]));
    const overwriteMode = options.overwriteMode || 'merge';
    const timeoutMs = await this.resolveScanTimeoutMs(options.timeoutMs);
    let shopifyResult: Awaited<ReturnType<ScanningService['checkOneShopifyUrl']>> | null = null;
    const scanStartedAt = Date.now();
    let didExecuteAnyStep = false;
    let currentContactStatus = site.contactStatus;

    try {
      if (enabledSteps.has('shopify')) {
        didExecuteAnyStep = true;
        const shopifyStartedAt = Date.now();
        shopifyResult = await this.checkOneShopifyUrl(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateShopifyResult(
          id,
          shopifyResult,
          { writeMode: overwriteMode },
        );

        if (shopifyResult.shopifyStatus === 'shopify') {
          await this.runShopifyLegalNoticeStep(id, site.url, {
            timeoutMs,
            persistUrl: true,
          });
        }

        await this.urlsService.updateScanTimings(id, { scanShopifyMs: Date.now() - shopifyStartedAt });
      }

      const currentShopifyStatus = shopifyResult?.shopifyStatus ?? site.shopifyStatus;
      const currentSiteName = shopifyResult?.siteName ?? site.siteName;
      let currentCmsName = shopifyResult?.cmsName ?? site.cmsName;

      if (enabledSteps.has('cms_detection') && currentShopifyStatus !== 'shopify') {
        didExecuteAnyStep = true;
        const cmsDetectionStartedAt = Date.now();
        const cmsDetection = await this.inspectCmsDetectionSite(site.url, {
          timeoutMs,
        });

        currentCmsName = cmsDetection.cmsName ?? currentCmsName;
        await this.urlsService.updateCmsResult(
          id,
          cmsDetection.cmsName,
          { writeMode: overwriteMode },
        );
        await this.recordScanTiming(id, 'scanCmsDetectionMs', cmsDetectionStartedAt);
      }

      if (enabledSteps.has('language')) {
        didExecuteAnyStep = true;
        const languageStartedAt = Date.now();
        const language = await this.inspectSiteLanguage(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSiteLanguageResult(
          id,
          {
            siteLanguageCode: language.siteLanguageCode,
            siteLanguageName: language.siteLanguageName,
          },
          { writeMode: overwriteMode },
        );
        await this.recordScanTiming(id, 'scanLanguageMs', languageStartedAt);
      }

      if (enabledSteps.has('seo_meta')) {
        didExecuteAnyStep = true;
        const seoMetaStartedAt = Date.now();
        const seoMeta = await this.inspectSeoMetaSite(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateSeoMetaResult(id);
        await this.urlsService.syncSeoMetaObservation(id, seoMeta.issues);
        await this.recordScanTiming(id, 'scanSeoMetaMs', seoMetaStartedAt);
      }

      if (enabledSteps.has('legal_notice') && currentShopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        await this.runShopifyLegalNoticeStep(id, site.url, {
          timeoutMs,
        });
      }

      if (enabledSteps.has('catalog') && currentShopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        const catalogStartedAt = Date.now();
        const productCatalog = await this.inspectProductCatalog(site.url, {
          timeoutMs,
        });
          await this.urlsService.updateProductCatalogResult(
            id,
            productCatalog,
            { writeMode: overwriteMode },
          );
        await this.urlsService.updateScanTimings(id, { scanCatalogMs: Date.now() - catalogStartedAt });
      }

      let contactResult = null;
      if (enabledSteps.has('contact') && currentShopifyStatus !== 'error') {
        didExecuteAnyStep = true;
        const contactStartedAt = Date.now();
        contactResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: currentSiteName || site.siteName,
          },
          {
            timeoutMs,
            preferLegalNoticeFirst: currentShopifyStatus === 'shopify',
          },
        );

        if (contactResult.status === 'found') {
          await this.urlsService.updateContactResult(
            id,
            contactResult,
            { writeMode: overwriteMode },
          );
          currentContactStatus = contactResult.status;
        } else if (overwriteMode === 'clear') {
          await this.urlsService.clearContactResult(id);
          currentContactStatus = 'unknown';
        }

        await this.urlsService.updateScanTimings(id, { scanContactMs: Date.now() - contactStartedAt });
      }

      if (enabledSteps.has('linkedin') && currentShopifyStatus !== 'error' && (contactResult?.status ?? site.contactStatus) === 'found') {
        didExecuteAnyStep = true;
        const linkedinStartedAt = Date.now();
        const linkedContact = contactResult?.status === 'found' ? contactResult : null;
        const linkedinUrl = await this.contactsService.searchLinkedinProfile(
          {
            email: linkedContact?.email ?? site.contactEmail,
            phone: linkedContact?.phone ?? site.contactPhone,
            siret: linkedContact?.siret ?? site.contactSiret,
            siren: linkedContact?.siren ?? site.contactSiren,
            firstName: linkedContact?.firstName ?? site.contactFirstName,
            lastName: linkedContact?.lastName ?? site.contactLastName,
            ownerName: linkedContact?.ownerName ?? site.contactOwnerName,
            companyName: linkedContact?.companyName ?? site.contactCompanyName,
            linkedinUrl: linkedContact?.linkedinUrl ?? site.contactLinkedinUrl,
            companyLinkedinUrl: linkedContact?.companyLinkedinUrl ?? site.contactCompanyLinkedinUrl,
            socialLinks: linkedContact?.socialLinks || JSON.parse(site.contactSocialLinksJson || '[]'),
            sourceUrl: linkedContact?.sourceUrl ?? site.contactSourceUrl,
            evidence: linkedContact?.evidence ?? site.contactEvidence,
          },
          { timeoutMs },
        );

        const resolvedLinkedinUrl = linkedinUrl || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl || null;
        if (resolvedLinkedinUrl) {
          const contactLinkedinResult = this.buildContactResultFromSite(site, resolvedLinkedinUrl);
          await this.urlsService.updateContactResult(
            id,
            {
              ...contactLinkedinResult,
              status: 'found',
            },
            { writeMode: overwriteMode },
          );
        } else if (overwriteMode === 'clear') {
          await this.urlsService.clearContactLinkedinResult(id);
        }

        await this.urlsService.updateScanTimings(id, { scanLinkedinMs: Date.now() - linkedinStartedAt });
      }

      if (enabledSteps.has('social') && currentShopifyStatus !== 'error') {
        didExecuteAnyStep = true;
        const socialStartedAt = Date.now();
        const socialResult = await this.contactsService.findOneContact(
          {
            id,
            url: site.url,
            siteName: currentSiteName || site.siteName,
          },
          {
            timeoutMs,
            includeLinkedin: false,
            preferLegalNoticeFirst: currentShopifyStatus === 'shopify',
          },
        );

        if (socialResult.status === 'found') {
          await this.urlsService.updateContactResult(
            id,
            socialResult,
            { writeMode: overwriteMode },
          );
          currentContactStatus = socialResult.status;
        } else if (overwriteMode === 'clear') {
          await this.urlsService.clearContactResult(id);
          currentContactStatus = 'unknown';
        }

        await this.urlsService.updateScanTimings(id, { scanSocialMs: Date.now() - socialStartedAt });
      }

      const nextSite = {
        ...site,
        shopifyStatus: currentShopifyStatus ?? site.shopifyStatus,
        cmsName: currentCmsName ?? site.cmsName,
        contactStatus: currentContactStatus,
      };

      if (enabledSteps.has('technical') && nextSite.shopifyStatus === 'shopify') {
        didExecuteAnyStep = true;
        const technicalStartedAt = Date.now();
        const technical = await this.inspectShopifyTechnical(site.url, {
          timeoutMs,
        });

        await this.urlsService.updateShopifyResult(
          id,
          {
            httpStatus: nextSite.httpStatus,
            shopifyStatus: nextSite.shopifyStatus,
            siteName: nextSite.siteName,
            cmsName: nextSite.cmsName,
            shopifyThemeName: technical.shopifyThemeName,
            shopifyThemeId: technical.shopifyThemeId,
            shopifyThemeSchemaName: technical.shopifyThemeSchemaName,
            shopifyThemeJson: technical.shopifyThemeJson,
            redesignStatus: technical.redesignStatus,
            ttfbMs: nextSite.scanTtfbMs,
            totalMs: nextSite.scanTotalMs,
            htmlBytes: nextSite.scanHtmlBytes,
          },
          { writeMode: overwriteMode },
        );

        nextSite.shopifyThemeName = technical.shopifyThemeName;
        nextSite.shopifyThemeId = technical.shopifyThemeId;
        nextSite.shopifyThemeSchemaName = technical.shopifyThemeSchemaName;
        nextSite.shopifyThemeJson = technical.shopifyThemeJson;
        nextSite.redesignStatus = technical.redesignStatus;

        await this.urlsService.updateScanTimings(id, { scanTechnicalMs: Date.now() - technicalStartedAt });
      }

      if (!enabledSteps.has('lighthouse') || !this.shouldRunLighthouse(nextSite)) {
        return { shopifyResult, contactResult, lighthouse: null };
      }

      const lighthouseStartedAt = Date.now();
      didExecuteAnyStep = true;
      const lighthouse = await this.inspectLighthouseSite(site.url, {
        timeoutMs,
      });

      await this.urlsService.updateLighthouseResult(
        id,
        lighthouse,
        { writeMode: overwriteMode },
      );
      await this.urlsService.updateScanTimings(id, { scanLighthouseMs: Date.now() - lighthouseStartedAt });

      return { shopifyResult, contactResult, lighthouse };
    } finally {
      if (didExecuteAnyStep) {
        await this.urlsService
          .updateScanTimings(id, { scanWorkflowTotalMs: Date.now() - scanStartedAt })
          .catch(() => undefined);
      }
    }
  }

  async startLaunchScans(
    filters: ScanLaunchFilters,
    steps: ScanLaunchStepKey[],
    options: { timeoutMs?: number; overwriteMode?: ScanLaunchOverwriteMode } = {},
  ) {
    if (this.launchRun.status === 'queued' || this.launchRun.status === 'running') {
      throw new Error('Un lancement de scan est déjà en cours.');
    }

    const targets = await this.urlsService.listAllScanLaunchTargets(filters);
    const launchId = ++this.launchRunId;
    const queuedAt = new Date().toISOString();

    this.launchRun = {
      id: launchId,
      status: 'queued',
      totalUrls: targets.length,
      processedUrls: 0,
      runningUrls: 0,
      pendingUrls: targets.length,
      changes: [],
      queuedAt,
      startedAt: null,
      finishedAt: null,
      lastError: null,
      currentUrlId: null,
      updatedAt: queuedAt,
    };
    this.emitLaunchEvent('scan-launch.snapshot', this.launchRun);

    const effectiveSteps = [...this.withContactShopifyDependency(new Set<ScanStepKey>(steps as ScanStepKey[]))];

    for (const target of targets) {
      await this.scanLaunchQueue.add(
        `scan-launch-${launchId}-${target.id}`,
        {
          launchId,
          target,
          steps: effectiveSteps,
          options,
        },
        {
          jobId: `scan-launch-${launchId}-${target.id}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }

    return {
      run: this.launchRun,
      queued: targets.length,
    };
  }

  async executeLaunchScansJob(job: ScanLaunchJobData) {
    const { launchId, target, steps, options } = job;
    const totalUrls = this.launchRun.totalUrls || 1;
    const currentProcessed = this.launchRun.processedUrls;

    this.updateLaunchRun(
      {
        status: 'running',
        startedAt: this.launchRun.startedAt || new Date().toISOString(),
        runningUrls: 1,
        pendingUrls: Math.max(0, totalUrls - currentProcessed - 1),
        currentUrlId: target.id,
      },
      'scan-launch.running',
    );

    const results = [];

    const before = await this.urlsService.getSite(target.id);
    this.updateLaunchRun({
      runningUrls: 1,
      pendingUrls: Math.max(0, totalUrls - currentProcessed - 1),
      currentUrlId: target.id,
    });

    try {
      const scan = await this.scanSiteWithLaunchOptions(target.id, steps, options);
      results.push({
        id: target.id,
        url: target.url,
        processed: 1,
        scan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      results.push({
        id: target.id,
        url: target.url,
        processed: 0,
        error: message,
      });
    }

    const after = await this.urlsService.getSite(target.id);
    const changes = this.collectLaunchChanges(before as Record<string, unknown>, after as Record<string, unknown>, steps, target);
    if (changes.length > 0) {
      this.updateLaunchRun({
        changes: [...this.launchRun.changes, ...changes],
      });
    }

    const nextProcessed = currentProcessed + 1;
    const isCompleted = nextProcessed >= totalUrls;

    this.updateLaunchRun(
      {
        processedUrls: nextProcessed,
        runningUrls: 0,
        pendingUrls: Math.max(0, totalUrls - nextProcessed),
        currentUrlId: null,
        status: isCompleted ? 'completed' : 'running',
        finishedAt: isCompleted ? new Date().toISOString() : this.launchRun.finishedAt,
      },
      isCompleted ? 'scan-launch.completed' : 'scan-launch.updated',
    );

    return {
      scanned: results.filter((row) => row.processed === 1).length,
      total: results.length,
      results,
      launchId,
    };
  }

  async previewLaunchScans(
    filters: ScanLaunchFilters,
    options: { page?: number; limit?: number } = {},
  ) {
    return this.urlsService.listScanLaunchTargets(filters, options);
  }

  async rescanAllSites(options: { timeoutMs?: number; force?: boolean } = {}) {
    const rows = options.force
      ? await this.urlsService.listUrls()
      : await this.urlsService.getUnscannedSites();
    const results = [];

    for (const row of rows) {
      const result = await this.rescanSite(row.id, options);
      results.push({
        id: row.id,
        url: row.url,
        ...result,
      });
    }

    return {
      scanned: results.length,
      results,
    };
  }

  async rescanSiteLanguage(id: number, options: { timeoutMs?: number; force?: boolean } = {}) {
    const site = await this.urlsService.getSite(id);

    if (!options.force && site.siteLanguageCode && site.siteLanguageName) {
      return {
        id,
        url: site.url,
        processed: 0,
        total: 0,
        siteLanguageCode: site.siteLanguageCode,
        siteLanguageName: site.siteLanguageName,
      };
    }

    const languageStartedAt = Date.now();
    const language = await this.inspectSiteLanguage(site.url, options);
    const updated = await this.urlsService.updateSiteLanguageResult(
      id,
      {
        siteLanguageCode: language.siteLanguageCode,
        siteLanguageName: language.siteLanguageName,
      },
      { writeMode: 'clear' },
    );
    await this.recordScanTiming(id, 'scanLanguageMs', languageStartedAt);
    await this.recalculateLeadScoreAfterScan(id);

    return {
      id,
      url: site.url,
      processed: 1,
      total: 1,
      siteLanguageCode: language.siteLanguageCode,
      siteLanguageName: language.siteLanguageName,
      site: updated,
    };
  }

  async rescanAllSiteLanguages(options: { timeoutMs?: number } = {}) {
    const rows = await this.urlsService.listUrls();
    const results = [];

    for (const row of rows) {
      const languageStartedAt = Date.now();
      const language = await this.inspectSiteLanguage(row.url, options);
      await this.urlsService.updateSiteLanguageResult(
        row.id,
        {
          siteLanguageCode: language.siteLanguageCode,
          siteLanguageName: language.siteLanguageName,
        },
        { writeMode: 'clear' },
      );
      await this.urlsService.updateScanTimings(row.id, {
        scanLanguageMs: Date.now() - languageStartedAt,
      });
      await this.recalculateLeadScoreAfterScan(row.id);
      results.push({
        id: row.id,
        url: row.url,
        ...language,
      });
    }

    return {
      scanned: results.length,
      results,
    };
  }

  async checkShopify(options: { force?: boolean; timeoutMs?: number } = {}) {
    const rows = await this.urlsService.getPendingShopifySites(options.force);
    const results = [];
    const cmsDetectionEnabled = await this.isCmsDetectionEnabled();

    for (const row of rows) {
      const result = await this.checkOneShopifyUrl(row.url, options);
      await this.urlsService.updateShopifyResult(row.id, result);

      if (cmsDetectionEnabled && result.shopifyStatus !== 'shopify') {
        const cmsDetectionStartedAt = Date.now();
        const cmsDetection = await this.inspectCmsDetectionSite(row.url, options);
        await this.urlsService.updateCmsResult(row.id, cmsDetection.cmsName, { writeMode: 'merge' });
        await this.urlsService.updateScanTimings(row.id, {
          scanCmsDetectionMs: Date.now() - cmsDetectionStartedAt,
        });
      }

      await this.recalculateLeadScoreAfterScan(row.id);

      results.push({ id: row.id, url: row.url, ...result });
    }

    return {
      scanned: results.length,
      results,
      counts: results.reduce(
        (accumulator, row) => {
          accumulator[row.shopifyStatus] += 1;
          return accumulator;
        },
        { shopify: 0, not_shopify: 0, error: 0 } as Record<string, number>,
      ),
    };
  }
}
