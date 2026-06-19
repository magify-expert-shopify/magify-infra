import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProspectsService } from 'src/prospects/prospects.service';
import { URL_LEAD_SCORE_RECALC_QUEUE } from 'src/queues/queue.constants';
import { computeLeadScore } from 'src/prospects/prospect-score';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';
import {
  ensureSiteQualificationTables,
  loadSiteQualification,
  removeSiteObservation,
  saveSiteQualification,
  upsertSiteObservation,
  type SaveSiteQualificationInput,
  type SiteQualification,
} from 'src/site-qualifications/site-qualifications';
import { ensureProspectsTable, ensureUrlsTable, getTableColumnNames } from 'src/database/sqlite-schema';
import type { UrlLeadScoreRecalcJobData } from './url-lead-score-recalc.processor';
import { UrlLeadScoreRecalcEventsService } from './url-lead-score-recalc-events.service';
import { Inject, forwardRef } from '@nestjs/common';

export type RedesignStatus = 'cible' | 'candidat' | 'candidat migration' | 'candidat refonte' | 'ignore' | 'none';
export type RedesignDecision = 'draft' | 'accepted' | 'rejected' | 'manual' | 'none';
export type UrlSortKey = 'source' | 'shopifyStatus' | 'createdAt' | 'scanDate' | 'siteName';
export type SortDirection = 'asc' | 'desc';
export type ShopifyThemeStoreType = 'free' | 'paid' | 'custom';
type ScanTimingUpdate = {
  scanShopifyMs?: number | null;
  scanCmsDetectionMs?: number | null;
  scanLanguageMs?: number | null;
  scanSeoMetaMs?: number | null;
  scanLegalNoticeMs?: number | null;
  scanCatalogMs?: number | null;
  scanContactMs?: number | null;
  scanLinkedinMs?: number | null;
  scanSocialMs?: number | null;
  scanTechnicalMs?: number | null;
  scanLighthouseMs?: number | null;
  scanWorkflowTotalMs?: number | null;
};

export type ObservationTitleSuggestion = {
  title: string;
  siteCount: number;
  exampleDetail: string | null;
};

export type ScanLaunchImportRange = 'today' | 'week' | 'all';
export type ScanLaunchThemeType = 'free' | 'paid' | 'custom' | 'all';
export type ScanLaunchProspectScope = 'all' | 'with' | 'without';
export type ScanLaunchOverwriteMode = 'merge' | 'clear' | 'fill_missing';
export type ScanWriteMode = 'merge' | 'clear' | 'fill_missing';
export type ScanLaunchStepKey =
  | 'shopify'
  | 'cms_detection'
  | 'language'
  | 'seo_meta'
  | 'legal_notice'
  | 'catalog'
  | 'contact'
  | 'linkedin'
  | 'social'
  | 'technical'
  | 'lighthouse';

export type ScanLaunchFilters = {
  cmsName?: string | null;
  importRange?: ScanLaunchImportRange;
  themeType?: ScanLaunchThemeType;
  prospectScope?: ScanLaunchProspectScope;
};

export type ScanLaunchTarget = {
  id: number;
  url: string;
  siteName: string | null;
  createdAt: string;
  shopifyStatus: string;
  cmsName: string | null;
  shopifyThemeStoreType: ScanLaunchThemeType;
  shopifyThemeName: string | null;
  shopifyThemeSchemaName: string | null;
  hasProspect: boolean;
  themeType: Exclude<ScanLaunchThemeType, 'all'>;
};

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

function normalizeThemeText(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'shopify.com',
  'domain.com',
  'email.com',
  'exemple.com',
  'example.com',
]);

function isPlaceholderContactEmail(email: string | null | undefined) {
  const normalized = String(email || '').trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1).replace(/\.+$/, '');
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

export function classifyShopifyThemeType(site: {
  shopifyStatus?: string | null;
  shopifyThemeStoreType?: string | null;
  shopifyThemeName?: string | null;
  shopifyThemeSchemaName?: string | null;
  shopifyThemeJson?: string | null;
}): ShopifyThemeStoreType {
  const normalizedStoreType = normalizeThemeText(site.shopifyThemeStoreType);
  if (normalizedStoreType === 'free' || normalizedStoreType === 'paid' || normalizedStoreType === 'custom') {
    return normalizedStoreType;
  }

  if (normalizeThemeText(site.shopifyStatus) !== 'shopify') {
    return 'custom' as const;
  }

  const themeName = normalizeThemeText(site.shopifyThemeName);
  const schemaName = normalizeThemeText(site.shopifyThemeSchemaName);
  if (FREE_SHOPIFY_THEME_NAMES.has(themeName) || FREE_SHOPIFY_THEME_NAMES.has(schemaName)) {
    return 'free' as const;
  }

  const themeJson = String(site.shopifyThemeJson || '').trim().toLowerCase();
  if (themeJson.includes('"theme_store_id":null') || themeJson.includes('"theme_store_id": null')) {
    return 'custom' as const;
  }

  if (!themeName && !schemaName && !themeJson) {
    return 'custom' as const;
  }

  return 'paid' as const;
}
export type UrlListField =
  | 'id'
  | 'url'
  | 'sourceFile'
  | 'createdAt'
  | 'shopifyStatus'
  | 'siteKey'
  | 'shopifyCheckedAt'
  | 'httpStatus'
  | 'cmsName'
  | 'shopifyThemeName'
  | 'shopifyThemeId'
  | 'shopifyThemeSchemaName'
  | 'shopifyThemeJson'
  | 'redesignStatus'
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
  | 'scanWorkflowTotalMs'
  | 'scanTtfbMs'
  | 'scanTotalMs'
  | 'scanHtmlBytes'
  | 'productCount'
  | 'medianProductPrice'
  | 'catalogCheckedAt'
  | 'giftCardDetected'
  | 'lighthouseCheckedAt'
  | 'lighthouseScore'
  | 'lighthousePerformanceScore'
  | 'lighthouseAccessibilityScore'
  | 'lighthouseBestPracticesScore'
  | 'lighthouseSeoScore'
  | 'lighthouseObservationsJson'
  | 'lighthouseReportJson'
  | 'siteName'
  | 'siteCountryCode'
  | 'siteCountryName'
  | 'siteLanguageCode'
  | 'siteLanguageName'
  | 'seoMetaCheckedAt'
  | 'shopifyLegalNoticeStatus'
  | 'shopifyLegalNoticeUrl'
  | 'shopifyLegalNoticeCheckedAt'
  | 'contactStatus'
  | 'contactCheckedAt'
  | 'contactEmail'
  | 'contactPhone'
  | 'contactSiret'
  | 'contactSiren'
  | 'contactFirstName'
  | 'contactLastName'
  | 'contactOwnerName'
  | 'contactCompanyName'
  | 'contactCompanyAddress'
  | 'contactCompanyAddressExtra'
  | 'contactCompanyPostalCode'
  | 'contactCompanyCity'
  | 'contactCompanyLegalForm'
  | 'contactCompanyCountry'
  | 'contactSourceUrl'
  | 'contactEvidence'
  | 'contactLinkedinUrl'
  | 'contactCompanyLinkedinUrl'
  | 'contactSocialLinksJson'
  | 'blacklistedAt';

export interface ShopifyScanResult {
  httpStatus: number | null;
  shopifyStatus: string;
  siteName: string | null;
  cmsName: string | null;
  siteCountryCode?: string | null;
  siteCountryName?: string | null;
  shopifyLegalNoticeStatus?: string | null;
  shopifyLegalNoticeUrl?: string | null;
  shopifyThemeStoreType?: ShopifyThemeStoreType | null;
  shopifyThemeName?: string | null;
  shopifyThemeId?: string | null;
  shopifyThemeSchemaName?: string | null;
  shopifyThemeJson?: string | null;
  redesignStatus: string | null;
  redesignDecision?: string | null;
  ttfbMs: number | null;
  totalMs: number | null;
  htmlBytes: number | null;
}

export interface ProductCatalogScanResult {
  productCount: number | null;
  medianProductPrice: number | null;
  giftCardDetected: boolean;
}

export interface SiteLanguageResult {
  siteLanguageCode: string | null;
  siteLanguageName: string | null;
}

export interface LighthouseAuditResult {
    lighthouseScore: number | null;
    lighthousePerformanceScore: number | null;
    lighthouseAccessibilityScore: number | null;
    lighthouseBestPracticesScore: number | null;
    lighthouseSeoScore: number | null;
    lighthouseObservationsJson: string | null;
    lighthouseReportJson: string | null;
}

export interface ContactResult {
  status: string;
  email: string | null;
  contactEmailWasPlaceholder?: boolean;
  phone: string | null;
  siret: string | null;
  siren: string | null;
  firstName: string | null;
  lastName: string | null;
  ownerName: string | null;
  companyName: string | null;
  companyAddress?: string | null;
  companyAddressExtra?: string | null;
  companyPostalCode?: string | null;
  companyCity?: string | null;
  companyLegalForm?: string | null;
  companyCountry?: string | null;
  sourceUrl: string | null;
  evidence: string | null;
  contactObservation?: {
    key: string;
    title: string;
    detail: string;
    severity: 'info' | 'warning' | 'critical';
  } | null;
  linkedinUrl: string | null;
  companyLinkedinUrl: string | null;
  avatarUrl?: string | null;
  linkedinImageUrl?: string | null;
  socialLinks: string[];
}

export interface InsertSingleUrlResult {
  site: any;
  created: boolean;
  ignored?: boolean;
}

export interface UrlListResponse {
  items: Array<Record<string, unknown>>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type LeadScoreRecalcStatus = {
  id: number;
  status: string;
  totalUrls: number;
  processedUrls: number;
  runningUrls: number;
  pendingUrls: number;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  currentUrlId: number | null;
  updatedAt: Date | null;
};

type UrlDetailRecord = {
  id: number;
  url: string;
  sourceFile: string;
  createdAt: Date | string;
  shopifyStatus: string;
  siteKey: string | null;
  shopifyCheckedAt: Date | string | null;
  httpStatus: number | null;
  cmsName: string | null;
  siteCountryCode: string | null;
  siteCountryName: string | null;
  siteLanguageCode: string | null;
  siteLanguageName: string | null;
  seoMetaCheckedAt: Date | string | null;
  shopifyThemeStoreType: ShopifyThemeStoreType | null;
  shopifyThemeName: string | null;
  shopifyThemeId: string | null;
  shopifyThemeSchemaName: string | null;
  shopifyThemeJson: string | null;
  shopifyLegalNoticeStatus: string | null;
  shopifyLegalNoticeUrl: string | null;
  shopifyLegalNoticeCheckedAt: Date | string | null;
  redesignStatus: string | null;
  redesignDecision: string | null;
  scanShopifyMs: number | null;
  scanCmsDetectionMs: number | null;
  scanLanguageMs: number | null;
  scanSeoMetaMs: number | null;
  scanLegalNoticeMs: number | null;
  scanCatalogMs: number | null;
  scanContactMs: number | null;
  scanLinkedinMs: number | null;
  scanSocialMs: number | null;
  scanTechnicalMs: number | null;
  scanLighthouseMs: number | null;
  scanWorkflowTotalMs: number | null;
  scanTtfbMs: number | null;
  scanTotalMs: number | null;
  scanHtmlBytes: number | null;
  productCount: number | null;
  medianProductPrice: number | null;
  catalogCheckedAt: Date | string | null;
  giftCardDetected: boolean;
  lighthouseCheckedAt: Date | string | null;
  lighthouseScore: number | null;
  lighthousePerformanceScore: number | null;
  lighthouseAccessibilityScore: number | null;
  lighthouseBestPracticesScore: number | null;
  lighthouseSeoScore: number | null;
  lighthouseObservationsJson: string | null;
  lighthouseReportJson: string | null;
  rescanRequestedAt: Date | null;
  siteName: string | null;
  contactStatus: string;
  contactCheckedAt: Date | string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactSiret: string | null;
  contactSiren: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactOwnerName: string | null;
  contactCompanyName: string | null;
  contactCompanyAddress: string | null;
  contactCompanyAddressExtra: string | null;
  contactCompanyPostalCode: string | null;
  contactCompanyCity: string | null;
  contactCompanyLegalForm: string | null;
  contactCompanyCountry: string | null;
  contactSourceUrl: string | null;
  contactEvidence: string | null;
  contactLinkedinUrl: string | null;
  contactCompanyLinkedinUrl: string | null;
  contactSocialLinksJson: string | null;
  blacklistedAt: Date | null;
  qualification: SiteQualification | null;
};

type ResetTrashedUrlData = {
  sourceFile: string;
  trashedAt: null;
  shopifyStatus: 'unknown';
  shopifyCheckedAt: null;
  httpStatus: null;
  cmsName: null;
  shopifyThemeName: null;
  shopifyThemeId: null;
  shopifyThemeSchemaName: null;
  shopifyThemeJson: null;
  shopifyThemeStoreType: null;
  redesignStatus: null;
  scanTtfbMs: null;
  scanTotalMs: null;
  scanHtmlBytes: null;
  scanCmsDetectionMs: null;
  scanLanguageMs: null;
  scanSeoMetaMs: null;
  scanLegalNoticeMs: null;
  lighthouseCheckedAt: null;
  lighthouseScore: null;
  lighthousePerformanceScore: null;
  lighthouseAccessibilityScore: null;
  lighthouseBestPracticesScore: null;
  lighthouseSeoScore: null;
  lighthouseReportJson: null;
  siteName: null;
  seoMetaCheckedAt: null;
};

type SeoMetaObservationIssue = {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
};

export interface SearchUrlsOptions {
  page?: number;
  limit?: number;
  search?: string;
  cmsName?: string;
  shopifyStatus?: string;
  contactStatus?: string;
  sortBy?: UrlSortKey;
  direction?: SortDirection;
  shopifyOnly?: boolean;
  fields?: UrlListField[];
}

export function cleanUrl(rawUrl: string) {
  return rawUrl
    .replace(/[),.;:!?]+$/g, '')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
}

export function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [...new Set(matches.map(cleanUrl).filter(Boolean))];
}

export function parseInputUrl(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new BadRequestException('URL manquante.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    throw new BadRequestException(`URL invalide: ${value}`);
  }
}

export function getSiteKey(value: string) {
  const url = parseInputUrl(value);
  return url.hostname.replace(/^www\./i, '').toLowerCase();
}

export function normalizeInputUrl(value: string) {
  const url = parseInputUrl(value);
  url.hash = '';

  return url.toString();
}

export function normalizeSiteUrl(value: string) {
  const url = parseInputUrl(value);
  const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

  url.hostname = hostname;
  url.pathname = '/';
  url.search = '';
  url.hash = '';

  return url.toString();
}

export function extractSiteUrls(text: string) {
  const urls = extractUrls(text).map(normalizeSiteUrl);
  return [...new Set(urls)];
}

@Injectable()
export class UrlsService implements OnModuleInit {
  private urlsColumnsReady = false;
  private contactColumnsReady = false;
  private lighthouseColumnsReady = false;
  private leadScoreRecalcTableReady = false;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ProspectsService))
    private prospectsService: ProspectsService,
    private siteSettingsService: SiteSettingsService,
    private readonly urlLeadScoreRecalcEventsService: UrlLeadScoreRecalcEventsService,
    @InjectQueue(URL_LEAD_SCORE_RECALC_QUEUE)
    private readonly urlLeadScoreRecalcQueue: Queue<UrlLeadScoreRecalcJobData>,
  ) {}

  private prospectContactSelect() {
    return {
      contactStatus: true,
      contactCheckedAt: true,
      email: true,
      phone: true,
      siret: true,
      siren: true,
      firstName: true,
      lastName: true,
      owner: true,
      companyName: true,
      companyAddress: true,
      companyAddressExtra: true,
      companyPostalCode: true,
      companyCity: true,
      companyLegalForm: true,
      companyCountry: true,
      sourceUrl: true,
      evidence: true,
      linkedinUrl: true,
      companyLinkedinUrl: true,
      socialLinksJson: true,
    } as any;
  }

  private flattenProspectContactFields(site: any) {
    const prospect = site?.prospect || null;
    const { prospect: _prospect, ...base } = site || {};

    return {
      ...base,
      contactStatus: prospect?.contactStatus ?? 'unknown',
      contactCheckedAt: prospect?.contactCheckedAt ?? null,
      contactEmail: prospect?.email ?? null,
      contactPhone: prospect?.phone ?? null,
      contactSiret: prospect?.siret ?? null,
      contactSiren: prospect?.siren ?? null,
      contactFirstName: prospect?.firstName ?? null,
      contactLastName: prospect?.lastName ?? null,
      contactOwnerName: prospect?.owner ?? null,
      contactCompanyName: prospect?.companyName ?? null,
      contactCompanyAddress: prospect?.companyAddress ?? null,
      contactCompanyAddressExtra: prospect?.companyAddressExtra ?? null,
      contactCompanyPostalCode: prospect?.companyPostalCode ?? null,
      contactCompanyCity: prospect?.companyCity ?? null,
      contactCompanyLegalForm: prospect?.companyLegalForm ?? null,
      contactCompanyCountry: prospect?.companyCountry ?? null,
      contactSourceUrl: prospect?.sourceUrl ?? null,
      contactEvidence: prospect?.evidence ?? null,
      contactLinkedinUrl: prospect?.linkedinUrl ?? null,
      contactCompanyLinkedinUrl: prospect?.companyLinkedinUrl ?? null,
      contactSocialLinksJson: prospect?.socialLinksJson ?? null,
    };
  }

  async searchObservationTitleSuggestions(search: string, limit = 6): Promise<ObservationTitleSuggestion[]> {
    await ensureSiteQualificationTables(this.prisma);

    const normalizedSearch = String(search || '').trim().toLowerCase();
    if (normalizedSearch.length < 3) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(20, Math.round(Number(limit || 6))));
    const escapeLike = (value: string) =>
      value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "''")
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
    const containsPattern = escapeLike(`%${normalizedSearch}%`);
    const startsWithPattern = escapeLike(`${normalizedSearch}%`);
    const exactPattern = escapeLike(normalizedSearch);

    const rows = await this.prisma.$queryRawUnsafe<Array<{
      title: string;
      siteCount: number;
      exampleDetail: string | null;
    }>>(
      `
      SELECT
        MIN(title) AS title,
        COUNT(DISTINCT url_id) AS siteCount,
        MIN(detail) AS exampleDetail
      FROM "site_observations"
      WHERE title IS NOT NULL
        AND TRIM(title) <> ''
        AND (
          lower(title) LIKE '${containsPattern}' ESCAPE '\\'
          OR lower(detail) LIKE '${containsPattern}' ESCAPE '\\'
        )
      GROUP BY lower(TRIM(title))
      ORDER BY
        CASE
          WHEN lower(MIN(title)) = '${exactPattern}' THEN 0
          WHEN lower(MIN(title)) LIKE '${startsWithPattern}' ESCAPE '\\' THEN 1
          WHEN lower(MIN(title)) LIKE '${containsPattern}' ESCAPE '\\' THEN 2
          ELSE 3
        END,
        COUNT(DISTINCT url_id) DESC,
        LENGTH(MIN(title)) ASC,
        MIN(title) ASC
      LIMIT ${safeLimit}
      `,
    );

    return rows
      .map((row) => ({
        title: String(row.title || '').trim(),
        siteCount: Number(row.siteCount || 0),
        exampleDetail: row.exampleDetail == null ? null : String(row.exampleDetail),
      }))
      .filter((item) => item.title.length > 0);
  }

  async onModuleInit() {
    await ensureUrlsTable(this.prisma);
    await ensureProspectsTable(this.prisma);
    await this.ensureUrlThemeColumns();
    await this.ensureUrlContactColumns();
    await this.ensureLighthouseColumns();
    await this.ensureLeadScoreRecalcTable();
    await ensureSiteQualificationTables(this.prisma);
  }

  private async ensureUrlThemeColumns() {
    if (this.urlsColumnsReady) {
      return;
    }

    await ensureUrlsTable(this.prisma);

    const columns = await getTableColumnNames(this.prisma, 'urls');

    if (!columns.includes('shopify_theme_store_type')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_theme_store_type" TEXT',
      );
    }

    this.urlsColumnsReady = true;
  }

  private async ensureUrlContactColumns() {
    if (this.contactColumnsReady) {
      return;
    }

    await ensureProspectsTable(this.prisma);

    const columns = await getTableColumnNames(this.prisma, 'prospects');

    const missingColumns: Array<{ name: string; sql: string }> = [
      { name: 'contact_status', sql: 'ALTER TABLE "prospects" ADD COLUMN "contact_status" TEXT NOT NULL DEFAULT \'unknown\'' },
      { name: 'contact_checked_at', sql: 'ALTER TABLE "prospects" ADD COLUMN "contact_checked_at" TEXT' },
      { name: 'last_name', sql: 'ALTER TABLE "prospects" ADD COLUMN "last_name" TEXT' },
      { name: 'siret', sql: 'ALTER TABLE "prospects" ADD COLUMN "siret" TEXT' },
      { name: 'siren', sql: 'ALTER TABLE "prospects" ADD COLUMN "siren" TEXT' },
      { name: 'company_name', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_name" TEXT' },
      { name: 'company_address', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_address" TEXT' },
      { name: 'company_address_extra', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_address_extra" TEXT' },
      { name: 'company_postal_code', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_postal_code" TEXT' },
      { name: 'company_city', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_city" TEXT' },
      { name: 'company_legal_form', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_legal_form" TEXT' },
      { name: 'company_country', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_country" TEXT' },
      { name: 'company_linkedin_url', sql: 'ALTER TABLE "prospects" ADD COLUMN "company_linkedin_url" TEXT' },
    ];

    for (const column of missingColumns) {
      if (!columns.includes(column.name)) {
        await this.prisma.$executeRawUnsafe(column.sql);
      }
    }

    this.contactColumnsReady = true;
  }

  private isEmptyScanValue(value: unknown) {
    return value == null || (typeof value === 'string' && value.trim().length === 0);
  }

  private applyScanWriteMode<T>(current: T | null | undefined, next: T | null | undefined, mode: ScanWriteMode) {
    const normalizedCurrent = current ?? null;
    const normalizedNext = next ?? null;

    if (mode === 'clear') {
      return normalizedNext;
    }

    if (mode === 'fill_missing') {
      return this.isEmptyScanValue(normalizedCurrent) ? normalizedNext : normalizedCurrent;
    }

    return this.isEmptyScanValue(normalizedNext) ? normalizedCurrent : normalizedNext;
  }

  private async ensureLighthouseColumns() {
    if (this.lighthouseColumnsReady) {
      return;
    }

    await ensureUrlsTable(this.prisma);

    const columns = await getTableColumnNames(this.prisma, 'urls');

    if (!columns.includes('lighthouse_checked_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_checked_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('lighthouse_score')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_score" INTEGER',
      );
    }

    if (!columns.includes('lighthouse_performance_score')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_performance_score" INTEGER',
      );
    }

    if (!columns.includes('lighthouse_accessibility_score')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_accessibility_score" INTEGER',
      );
    }

    if (!columns.includes('lighthouse_best_practices_score')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_best_practices_score" INTEGER',
      );
    }

    if (!columns.includes('shopify_theme_id')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_theme_id" TEXT',
      );
    }

    if (!columns.includes('shopify_theme_json')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_theme_json" TEXT',
      );
    }

    if (!columns.includes('lighthouse_seo_score')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_seo_score" INTEGER',
      );
    }

    if (!columns.includes('lighthouse_report_json')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_report_json" TEXT',
      );
    }

    if (!columns.includes('lighthouse_observations_json')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "lighthouse_observations_json" TEXT',
      );
    }

    if (!columns.includes('rescan_requested_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "rescan_requested_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('redesign_decision')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "redesign_decision" TEXT',
      );
    }

    if (!columns.includes('scan_shopify_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_shopify_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_cms_detection_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_cms_detection_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_language_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_language_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_seo_meta_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_seo_meta_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_legal_notice_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_legal_notice_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_catalog_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_catalog_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_contact_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_contact_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_linkedin_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_linkedin_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_social_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_social_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_technical_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_technical_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_lighthouse_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_lighthouse_ms" INTEGER',
      );
    }

    if (!columns.includes('scan_workflow_total_ms')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "scan_workflow_total_ms" INTEGER',
      );
    }

    if (!columns.includes('seo_meta_checked_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "seo_meta_checked_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('product_count')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "product_count" INTEGER',
      );
    }

    if (!columns.includes('median_product_price')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "median_product_price" REAL',
      );
    }

    if (!columns.includes('catalog_checked_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "catalog_checked_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('gift_card_detected')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "gift_card_detected" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('blacklisted_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "blacklisted_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('site_country_code')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "site_country_code" TEXT',
      );
    }

    if (!columns.includes('site_country_name')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "site_country_name" TEXT',
      );
    }

    if (!columns.includes('site_language_code')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "site_language_code" TEXT',
      );
    }

    if (!columns.includes('site_language_name')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "site_language_name" TEXT',
      );
    }

    if (!columns.includes('shopify_legal_notice_status')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_legal_notice_status" TEXT',
      );
    }

    if (!columns.includes('shopify_legal_notice_url')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_legal_notice_url" TEXT',
      );
    }

    if (!columns.includes('shopify_legal_notice_checked_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "urls" ADD COLUMN "shopify_legal_notice_checked_at" TIMESTAMPTZ',
      );
    }

    this.lighthouseColumnsReady = true;
  }

  private async ensureLeadScoreRecalcTable() {
    if (this.leadScoreRecalcTableReady) {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lead_score_recalc_runs" (
        "id" SERIAL PRIMARY KEY,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "total_urls" INTEGER NOT NULL DEFAULT 0,
        "processed_urls" INTEGER NOT NULL DEFAULT 0,
        "running_urls" INTEGER NOT NULL DEFAULT 0,
        "pending_urls" INTEGER NOT NULL DEFAULT 0,
        "queued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "last_error" TEXT,
        "current_url_id" INTEGER,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columns = await getTableColumnNames(this.prisma, 'lead_score_recalc_runs');

    if (!columns.includes('running_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "lead_score_recalc_runs" ADD COLUMN "running_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('pending_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "lead_score_recalc_runs" ADD COLUMN "pending_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('current_url_id')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "lead_score_recalc_runs" ADD COLUMN "current_url_id" INTEGER',
      );
    }

    this.leadScoreRecalcTableReady = true;
  }

  private dbRowToLeadScoreRecalcStatus(row: any): LeadScoreRecalcStatus {
    return {
      id: Number(row.id),
      status: String(row.status || 'queued'),
      totalUrls: Number(row.total_urls || 0),
      processedUrls: Number(row.processed_urls || 0),
      runningUrls: Number(row.running_urls || 0),
      pendingUrls: Number(row.pending_urls || 0),
      queuedAt: row.queued_at ? new Date(row.queued_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      lastError: row.last_error ? String(row.last_error) : null,
      currentUrlId: row.current_url_id ? Number(row.current_url_id) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }

  async getLeadScoreRecalcStatus(): Promise<LeadScoreRecalcStatus> {
    await this.ensureLeadScoreRecalcTable();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "lead_score_recalc_runs" ORDER BY "id" DESC LIMIT 1',
    );
    const row = rows[0];
    const counts = await this.urlLeadScoreRecalcQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'paused',
    );
    const pendingJobs =
      (counts.waiting || 0)
      + (counts.active || 0)
      + (counts.delayed || 0)
      + (counts.paused || 0);

    if (!row) {
      return {
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
      };
    }

    const status = this.dbRowToLeadScoreRecalcStatus(row);

    if (['queued', 'running'].includes(status.status) && pendingJobs === 0) {
      return {
        ...status,
        status: 'idle',
      };
    }

    return status;
  }

  private async emitLeadScoreRecalcEvent(type: string) {
    this.urlLeadScoreRecalcEventsService.emit(type, await this.getLeadScoreRecalcStatus());
  }

  async startLeadScoreRecalculation() {
    await this.ensureLeadScoreRecalcTable();

    const urls = await this.prisma.url.findMany({
      where: { trashedAt: null, blacklistedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (urls.length === 0) {
      return {
        run: await this.getLeadScoreRecalcStatus(),
        queued: 0,
      };
    }

    const current = await this.getLeadScoreRecalcStatus();
    if (current.status === 'queued' || current.status === 'running') {
      throw new BadRequestException('Un recalcul de score est déjà en cours.');
    }

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "lead_score_recalc_runs" (
          "status",
          "total_urls",
          "processed_urls",
          "running_urls",
          "pending_urls",
          "queued_at",
          "started_at",
          "finished_at",
          "last_error",
          "current_url_id",
          "updated_at"
        ) VALUES (?, ?, 0, 0, ?, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)
      `,
      'queued',
      urls.length,
      urls.length,
    );

    const runRows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "lead_score_recalc_runs" ORDER BY "id" DESC LIMIT 1',
    );
    const run = this.dbRowToLeadScoreRecalcStatus(runRows[0]);
    const jobs = urls.map((url, index) => ({
      name: `url-${url.id}`,
      data: {
        runId: run.id,
        urlId: url.id,
        position: index + 1,
        total: urls.length,
      },
      opts: {
        jobId: `lead-score-recalc:${run.id}:${url.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));

    await this.urlLeadScoreRecalcQueue.addBulk(jobs);
    await this.emitLeadScoreRecalcEvent('lead-score-recalc.queued');

    return {
      run,
      queued: jobs.length,
    };
  }

  async markLeadScoreRecalcJobStarted(runId: number, urlId: number) {
    await this.ensureLeadScoreRecalcTable();

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "lead_score_recalc_runs"
        SET
          "status" = CASE WHEN "status" = 'queued' THEN 'running' ELSE "status" END,
          "started_at" = COALESCE("started_at", CURRENT_TIMESTAMP),
          "running_urls" = COALESCE("running_urls", 0) + 1,
          "pending_urls" = CASE WHEN "pending_urls" > 0 THEN "pending_urls" - 1 ELSE 0 END,
          "current_url_id" = ?,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      urlId,
      runId,
    );

    await this.emitLeadScoreRecalcEvent('lead-score-recalc.updated');
  }

  async markLeadScoreRecalcJobFinished(runId: number, errorMessage?: string | null) {
    await this.ensureLeadScoreRecalcTable();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT "pending_urls", "running_urls" FROM "lead_score_recalc_runs" WHERE "id" = ? LIMIT 1',
      runId,
    );
    const row = rows[0];
    const pendingUrls = Number(row?.pending_urls || 0);
    const runningUrls = Number(row?.running_urls || 0);
    const isCompleted = pendingUrls <= 0 && runningUrls <= 1;

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "lead_score_recalc_runs"
        SET
          "status" = ?,
          "processed_urls" = COALESCE("processed_urls", 0) + 1,
          "running_urls" = CASE WHEN "running_urls" > 0 THEN "running_urls" - 1 ELSE 0 END,
          "current_url_id" = NULL,
          "last_error" = COALESCE(?, "last_error"),
          "finished_at" = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE "finished_at" END,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      isCompleted ? 'completed' : 'running',
      errorMessage || null,
      isCompleted ? 1 : 0,
      runId,
    );

    await this.emitLeadScoreRecalcEvent(isCompleted ? 'lead-score-recalc.completed' : 'lead-score-recalc.updated');
  }

  async recalculateLeadScoreFromUrlId(urlId: number) {
    const current = await this.getSite(urlId);
    const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();
    const leadScore = computeLeadScore(current, leadScoreSettings);

    await this.prisma.prospect.updateMany({
      where: {
        urlId,
        trashedAt: null,
      },
      data: {
        leadScore,
      },
    });

    return { urlId, leadScore };
  }

  private buildResetTrashedUrlData(sourceFile: string): ResetTrashedUrlData {
    return {
      sourceFile,
      trashedAt: null,
      shopifyStatus: 'unknown',
      shopifyCheckedAt: null,
      httpStatus: null,
      cmsName: null,
      shopifyThemeName: null,
      shopifyThemeId: null,
      shopifyThemeSchemaName: null,
      shopifyThemeJson: null,
      shopifyThemeStoreType: null,
      redesignStatus: null,
      scanTtfbMs: null,
      scanTotalMs: null,
      scanHtmlBytes: null,
      scanCmsDetectionMs: null,
      scanLanguageMs: null,
      scanSeoMetaMs: null,
      scanLegalNoticeMs: null,
      lighthouseCheckedAt: null,
      lighthouseScore: null,
      lighthousePerformanceScore: null,
      lighthouseAccessibilityScore: null,
      lighthouseBestPracticesScore: null,
      lighthouseSeoScore: null,
      lighthouseReportJson: null,
      siteName: null,
      seoMetaCheckedAt: null,
    };
  }

  async importUrlText(text: string, sourceFile = 'upload') {
    const urls = extractSiteUrls(text);
    const importedSites: InsertSingleUrlResult['site'][] = [];
    const insertedSites: InsertSingleUrlResult['site'][] = [];

    for (const url of urls) {
      const result = await this.insertSingleUrl(url, sourceFile);
      if (!result.ignored) {
        importedSites.push(result.site);
      }
      if (result.created) insertedSites.push(result.site);
    }

    return {
      sourceFile,
      found: urls.length,
      inserted: insertedSites.length,
      ignored: urls.length - insertedSites.length,
      importedSites,
      insertedSites,
    };
  }

  async insertSingleUrl(url: string, sourceFile = 'manual'): Promise<InsertSingleUrlResult> {
    const normalizedUrl = normalizeSiteUrl(url);
    const siteKey = getSiteKey(normalizedUrl);

    const blacklisted = await this.prisma.url.findFirst({
      where: {
        url: normalizedUrl,
        blacklistedAt: { not: null },
      },
      orderBy: { id: 'asc' },
    });

    if (blacklisted) {
      return { site: blacklisted, created: false, ignored: true };
    }

    const existing = await this.prisma.url.findFirst({
      where: {
        siteKey,
        trashedAt: null,
        blacklistedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    if (existing) {
      return { site: existing, created: false };
    }

    const trashed = await this.prisma.url.findFirst({
      where: {
        url: normalizedUrl,
        trashedAt: { not: null },
      },
      orderBy: { id: 'asc' },
    });

    if (trashed) {
      await this.prospectsService.removeByUrlId(trashed.id);

      const restored = await this.prisma.url.update({
        where: { id: trashed.id },
        data: this.buildResetTrashedUrlData(sourceFile),
      });

      await this.prisma.$executeRawUnsafe(
        'UPDATE "urls" SET "lighthouse_observations_json" = NULL WHERE "id" = ?',
        restored.id,
      );
      await this.prisma.$executeRawUnsafe(
        'UPDATE "urls" SET "rescan_requested_at" = NULL WHERE "id" = ?',
        restored.id,
      );
      await this.clearScanTimingColumns(restored.id);
      await this.clearSiteProfileColumns(restored.id);

      return { site: restored, created: true };
    }

    const site = await this.prisma.url.create({
      data: {
        url: normalizedUrl,
        sourceFile,
        siteKey,
      },
    });

    return { site, created: true };
  }

  async findExistingSiteByUrl(url: string) {
    const normalizedUrl = normalizeSiteUrl(url);
    const siteKey = getSiteKey(normalizedUrl);
    const site = await this.prisma.url.findFirst({
      where: {
        siteKey,
        trashedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    return {
      exists: Boolean(site),
      site,
      normalizedUrl,
    };
  }

  async getSitesByIds(ids: number[]) {
    const normalizedIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.url.findMany({
      where: {
        id: { in: normalizedIds },
        trashedAt: null,
        blacklistedAt: null,
      },
      include: {
        prospect: {
          select: this.prospectContactSelect() as any,
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => this.flattenProspectContactFields(row));
  }

  async listUrls(options: { shopifyOnly?: boolean } = {}) {
    const rows = await this.prisma.url.findMany({
      where: {
        trashedAt: null,
        blacklistedAt: null,
        ...(options.shopifyOnly ? { shopifyStatus: 'shopify' } : {}),
      },
      include: {
        prospect: {
          select: this.prospectContactSelect() as any,
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => this.flattenProspectContactFields(row));
  }

  private buildUrlWhere(options: SearchUrlsOptions = {}): Prisma.UrlWhereInput {
    const search = options.search?.trim();
    const cmsName = options.cmsName?.trim();
    const normalizedCmsName = cmsName?.toLowerCase() || '';

    const cmsFilter =
      !cmsName || cmsName === 'all'
        ? undefined
        : normalizedCmsName === 'unknown'
          ? { OR: [{ cmsName: null }, { cmsName: 'Custom / Static' }] }
          : normalizedCmsName === 'custom_static'
            ? { cmsName: 'Custom / Static' }
            : { cmsName: { contains: cmsName } };

    return {
      trashedAt: null,
      blacklistedAt: null,
      ...(options.shopifyOnly ? { shopifyStatus: 'shopify' } : {}),
      ...(cmsFilter || {}),
      ...(options.shopifyStatus && !options.shopifyOnly ? { shopifyStatus: options.shopifyStatus } : {}),
      ...(options.contactStatus
        ? options.contactStatus === 'not_found'
          ? { prospect: { is: { contactStatus: { not: 'found' } } } }
          : options.contactStatus === 'unknown'
            ? { OR: [{ prospect: { is: null } }, { prospect: { is: { contactStatus: 'unknown' } } }] }
            : { prospect: { is: { contactStatus: options.contactStatus } } }
        : {}),
      ...(search
        ? {
            OR: [
              { url: { contains: search } },
              { sourceFile: { contains: search } },
              { siteKey: { contains: search } },
              { siteName: { contains: search } },
              { shopifyStatus: { contains: search } },
              {
                prospect: {
                  is: {
                    OR: [
                      { contactStatus: { contains: search } },
                      { contactCompanyName: { contains: search } },
                      { contactOwnerName: { contains: search } },
                      { contactEmail: { contains: search } },
                      { contactPhone: { contains: search } },
                      { contactSiren: { contains: search } },
                      { contactSiret: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    } as any;
  }

  private buildUrlOrderBy(sortBy: UrlSortKey = 'createdAt', direction: SortDirection = 'desc') {
    const sortDirection = direction === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'source') {
      return { sourceFile: sortDirection } as const;
    }

    if (sortBy === 'shopifyStatus') {
      return { shopifyStatus: sortDirection } as const;
    }

    if (sortBy === 'siteName') {
      return { siteName: sortDirection } as const;
    }

    if (sortBy === 'scanDate') {
      return { shopifyCheckedAt: sortDirection } as const;
    }

    return { createdAt: sortDirection } as const;
  }

  private projectUrlListItem(item: Record<string, unknown>, fields?: UrlListField[]) {
    if (!fields || fields.length === 0) {
      return item;
    }

    const projected: Record<string, unknown> = {};
    for (const field of new Set(fields)) {
      if (field in item) {
        projected[field] = item[field];
      }
    }

    return projected;
  }

  async searchUrls(options: SearchUrlsOptions = {}): Promise<UrlListResponse> {
    const page = Math.max(1, Math.floor(options.page || 1));
    const limit = Math.min(200, Math.max(10, Math.floor(options.limit || 50)));
    const skip = (page - 1) * limit;
    const where = this.buildUrlWhere(options);
    const orderBy = this.buildUrlOrderBy(options.sortBy, options.direction);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.url.count({ where }),
      this.prisma.url.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          prospect: {
            select: this.prospectContactSelect(),
          },
        },
      }),
    ]);

    return {
      items: items
        .map((item) => this.flattenProspectContactFields(item as Record<string, unknown>))
        .map((item) => this.projectUrlListItem(item as Record<string, unknown>, options.fields)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private buildScanLaunchWhere(filters: ScanLaunchFilters = {}): Prisma.UrlWhereInput {
    const cmsName = filters.cmsName?.trim();
    const normalizedCmsName = cmsName?.toLowerCase() || '';

    const cmsFilter =
      !cmsName || cmsName === 'all'
        ? undefined
        : normalizedCmsName === 'unknown'
          ? { OR: [{ cmsName: null }, { cmsName: 'Custom / Static' }] }
          : normalizedCmsName === 'custom_static'
            ? { cmsName: 'Custom / Static' }
            : { cmsName: { contains: cmsName } };

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) + 1);

    return {
      trashedAt: null,
      blacklistedAt: null,
      ...(cmsFilter || {}),
      ...(filters.prospectScope === 'with'
        ? { prospect: { isNot: null } }
        : filters.prospectScope === 'without'
          ? { prospect: { is: null } }
          : {}),
      ...(filters.importRange === 'today'
        ? { createdAt: { gte: startOfDay } }
        : filters.importRange === 'week'
          ? { createdAt: { gte: startOfWeek } }
          : {}),
    };
  }

  private matchesLaunchThemeType(item: {
    shopifyStatus: string;
    shopifyThemeName: string | null;
    shopifyThemeSchemaName: string | null;
    shopifyThemeJson: string | null;
  }, themeType: ScanLaunchThemeType) {
    if (themeType === 'all') {
      return true;
    }

    if (normalizeThemeText(item.shopifyStatus) !== 'shopify') {
      return false;
    }

    return classifyShopifyThemeType(item) === themeType;
  }

  async listScanLaunchTargets(
    filters: ScanLaunchFilters = {},
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: ScanLaunchTarget[]; total: number; page: number; limit: number; totalPages: number }> {
    const where = this.buildScanLaunchWhere(filters);
    const allItems = await this.prisma.url.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        siteName: true,
        createdAt: true,
        shopifyStatus: true,
        cmsName: true,
        shopifyThemeName: true,
        shopifyThemeSchemaName: true,
        shopifyThemeJson: true,
        prospect: { select: { id: true } },
      },
    });

    const filtered = allItems.filter((item) => this.matchesLaunchThemeType({
      shopifyStatus: item.shopifyStatus,
      shopifyThemeName: item.shopifyThemeName,
      shopifyThemeSchemaName: item.shopifyThemeSchemaName,
      shopifyThemeJson: item.shopifyThemeJson,
    }, filters.themeType || 'all'));

    const page = Math.max(1, Math.floor(options.page || 1));
    const limit = Math.min(200, Math.max(10, Math.floor(options.limit || 50)));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return {
      items: paged.map((item) => ({
        id: item.id,
        url: item.url,
        siteName: item.siteName,
        createdAt: item.createdAt.toISOString(),
        shopifyStatus: item.shopifyStatus,
        cmsName: item.cmsName,
        shopifyThemeStoreType: classifyShopifyThemeType({
          shopifyStatus: item.shopifyStatus,
          shopifyThemeName: item.shopifyThemeName,
          shopifyThemeSchemaName: item.shopifyThemeSchemaName,
          shopifyThemeJson: item.shopifyThemeJson,
        }),
        shopifyThemeName: item.shopifyThemeName,
        shopifyThemeSchemaName: item.shopifyThemeSchemaName,
        hasProspect: Boolean(item.prospect),
        themeType: classifyShopifyThemeType({
          shopifyStatus: item.shopifyStatus,
          shopifyThemeName: item.shopifyThemeName,
          shopifyThemeSchemaName: item.shopifyThemeSchemaName,
          shopifyThemeJson: item.shopifyThemeJson,
        }),
      })),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    };
  }

  async listAllScanLaunchTargets(filters: ScanLaunchFilters = {}) {
    const preview = await this.listScanLaunchTargets(filters, { page: 1, limit: 200 });
    if (preview.total <= preview.items.length) {
      return preview.items;
    }

    const where = this.buildScanLaunchWhere(filters);
    const allItems = await this.prisma.url.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        siteName: true,
        createdAt: true,
        shopifyStatus: true,
        cmsName: true,
        shopifyThemeName: true,
        shopifyThemeSchemaName: true,
        shopifyThemeJson: true,
        prospect: { select: { id: true } },
      },
    });

    return allItems
      .filter((item) => this.matchesLaunchThemeType({
        shopifyStatus: item.shopifyStatus,
        shopifyThemeName: item.shopifyThemeName,
        shopifyThemeSchemaName: item.shopifyThemeSchemaName,
        shopifyThemeJson: item.shopifyThemeJson,
      }, filters.themeType || 'all'))
      .map((item) => ({
        id: item.id,
        url: item.url,
        siteName: item.siteName,
        createdAt: item.createdAt.toISOString(),
        shopifyStatus: item.shopifyStatus,
        cmsName: item.cmsName,
        shopifyThemeStoreType: classifyShopifyThemeType({
          shopifyStatus: item.shopifyStatus,
          shopifyThemeName: item.shopifyThemeName,
          shopifyThemeSchemaName: item.shopifyThemeSchemaName,
          shopifyThemeJson: item.shopifyThemeJson,
        }),
        shopifyThemeName: item.shopifyThemeName,
        shopifyThemeSchemaName: item.shopifyThemeSchemaName,
        hasProspect: Boolean(item.prospect),
        themeType: classifyShopifyThemeType({
          shopifyStatus: item.shopifyStatus,
          shopifyThemeName: item.shopifyThemeName,
          shopifyThemeSchemaName: item.shopifyThemeSchemaName,
          shopifyThemeJson: item.shopifyThemeJson,
        }),
      }));
  }

  async getSite(id: number) {
    const site = await this.prisma.url.findFirst({
      where: { id, trashedAt: null },
      include: {
        prospect: {
          select: this.prospectContactSelect() as any,
        },
      },
    });
    if (!site) {
      throw new NotFoundException(`URL introuvable: ${id}`);
    }

    const flattenedSite: any = this.flattenProspectContactFields(site as any);
    const detail: UrlDetailRecord = {
      id: flattenedSite.id,
      url: flattenedSite.url,
      sourceFile: flattenedSite.sourceFile ?? '',
      createdAt: flattenedSite.createdAt,
      shopifyStatus: flattenedSite.shopifyStatus ?? 'unknown',
      siteKey: flattenedSite.siteKey ?? null,
      shopifyCheckedAt: flattenedSite.shopifyCheckedAt ?? null,
      httpStatus: flattenedSite.httpStatus ?? null,
      cmsName: flattenedSite.cmsName ?? null,
      siteCountryCode: flattenedSite.siteCountryCode ?? null,
      siteCountryName: flattenedSite.siteCountryName ?? null,
      siteLanguageCode: flattenedSite.siteLanguageCode ?? null,
      siteLanguageName: flattenedSite.siteLanguageName ?? null,
      seoMetaCheckedAt: flattenedSite.seoMetaCheckedAt ?? null,
      shopifyThemeStoreType: flattenedSite.shopifyThemeStoreType ?? null,
      shopifyThemeName: flattenedSite.shopifyThemeName ?? null,
      shopifyThemeId: flattenedSite.shopifyThemeId ?? null,
      shopifyThemeSchemaName: flattenedSite.shopifyThemeSchemaName ?? null,
      shopifyThemeJson: flattenedSite.shopifyThemeJson ?? null,
      shopifyLegalNoticeStatus: flattenedSite.shopifyLegalNoticeStatus ?? null,
      shopifyLegalNoticeUrl: flattenedSite.shopifyLegalNoticeUrl ?? null,
      shopifyLegalNoticeCheckedAt: flattenedSite.shopifyLegalNoticeCheckedAt ?? null,
      redesignStatus: flattenedSite.redesignStatus ?? null,
      redesignDecision: flattenedSite.redesignDecision ?? null,
      scanShopifyMs: flattenedSite.scanShopifyMs ?? null,
      scanCmsDetectionMs: flattenedSite.scanCmsDetectionMs ?? null,
      scanLanguageMs: flattenedSite.scanLanguageMs ?? null,
      scanSeoMetaMs: flattenedSite.scanSeoMetaMs ?? null,
      scanLegalNoticeMs: flattenedSite.scanLegalNoticeMs ?? null,
      scanCatalogMs: flattenedSite.scanCatalogMs ?? null,
      scanContactMs: flattenedSite.scanContactMs ?? null,
      scanLinkedinMs: flattenedSite.scanLinkedinMs ?? null,
      scanSocialMs: flattenedSite.scanSocialMs ?? null,
      scanTechnicalMs: flattenedSite.scanTechnicalMs ?? null,
      scanLighthouseMs: flattenedSite.scanLighthouseMs ?? null,
      scanWorkflowTotalMs: flattenedSite.scanWorkflowTotalMs ?? null,
      scanTtfbMs: flattenedSite.scanTtfbMs ?? null,
      scanTotalMs: flattenedSite.scanTotalMs ?? null,
      scanHtmlBytes: flattenedSite.scanHtmlBytes ?? null,
      productCount: flattenedSite.productCount ?? null,
      medianProductPrice: flattenedSite.medianProductPrice ?? null,
      catalogCheckedAt: flattenedSite.catalogCheckedAt ?? null,
      giftCardDetected: Boolean(flattenedSite.giftCardDetected ?? false),
      lighthouseCheckedAt: flattenedSite.lighthouseCheckedAt ?? null,
      lighthouseScore: flattenedSite.lighthouseScore ?? null,
      lighthousePerformanceScore: flattenedSite.lighthousePerformanceScore ?? null,
      lighthouseAccessibilityScore: flattenedSite.lighthouseAccessibilityScore ?? null,
      lighthouseBestPracticesScore: flattenedSite.lighthouseBestPracticesScore ?? null,
      lighthouseSeoScore: flattenedSite.lighthouseSeoScore ?? null,
      lighthouseObservationsJson: flattenedSite.lighthouseObservationsJson ?? null,
      lighthouseReportJson: flattenedSite.lighthouseReportJson ?? null,
      rescanRequestedAt: flattenedSite.rescanRequestedAt ?? null,
      siteName: flattenedSite.siteName ?? null,
      contactStatus: flattenedSite.contactStatus ?? 'unknown',
      contactCheckedAt: flattenedSite.contactCheckedAt ?? null,
      contactEmail: flattenedSite.contactEmail ?? null,
      contactPhone: flattenedSite.contactPhone ?? null,
      contactSiret: flattenedSite.contactSiret ?? null,
      contactSiren: flattenedSite.contactSiren ?? null,
      contactFirstName: flattenedSite.contactFirstName ?? null,
      contactLastName: flattenedSite.contactLastName ?? null,
      contactOwnerName: flattenedSite.contactOwnerName ?? null,
      contactCompanyName: flattenedSite.contactCompanyName ?? null,
      contactCompanyAddress: flattenedSite.contactCompanyAddress ?? null,
      contactCompanyAddressExtra: flattenedSite.contactCompanyAddressExtra ?? null,
      contactCompanyPostalCode: flattenedSite.contactCompanyPostalCode ?? null,
      contactCompanyCity: flattenedSite.contactCompanyCity ?? null,
      contactCompanyLegalForm: flattenedSite.contactCompanyLegalForm ?? null,
      contactCompanyCountry: flattenedSite.contactCompanyCountry ?? null,
      contactSourceUrl: flattenedSite.contactSourceUrl ?? null,
      contactEvidence: flattenedSite.contactEvidence ?? null,
      contactLinkedinUrl: flattenedSite.contactLinkedinUrl ?? null,
      contactCompanyLinkedinUrl: flattenedSite.contactCompanyLinkedinUrl ?? null,
      contactSocialLinksJson: flattenedSite.contactSocialLinksJson ?? null,
      blacklistedAt: flattenedSite.blacklistedAt ?? null,
      qualification: null,
    };

    detail.qualification = await loadSiteQualification(this.prisma, id);

    return detail;
  }

  async listTrashedUrls() {
    const rows = await this.prisma.url.findMany({
      where: {
        trashedAt: { not: null },
      },
      orderBy: { trashedAt: 'desc' },
      select: {
        id: true,
        url: true,
        sourceFile: true,
        siteName: true,
        shopifyStatus: true,
        cmsName: true,
        redesignStatus: true,
        trashedAt: true,
        createdAt: true,
        prospect: {
          select: {
            contactStatus: true,
          },
        },
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      url: row.url,
      sourceFile: row.sourceFile,
      siteName: row.siteName ?? null,
      shopifyStatus: row.shopifyStatus,
      cmsName: row.cmsName ?? null,
      redesignStatus: row.redesignStatus ?? null,
      contactStatus: row.prospect?.contactStatus ?? 'unknown',
      trashedAt: row.trashedAt,
      createdAt: row.createdAt,
    }));
  }

  async listBlacklistedUrls() {
    return this.prisma.url.findMany({
      where: {
        blacklistedAt: { not: null },
        trashedAt: null,
      },
      orderBy: [{ blacklistedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async blacklistSite(id: number) {
    const site = await this.prisma.url.findFirst({
      where: {
        id,
        trashedAt: null,
      },
    });

    if (!site) {
      throw new NotFoundException(`URL introuvable: ${id}`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextSite = await tx.url.update({
        where: { id },
        data: {
          blacklistedAt: now,
        },
      });

      await tx.prospect.updateMany({
        where: {
          urlId: id,
          trashedAt: null,
        },
        data: {
          trashedAt: now,
        },
      });

      return nextSite;
    });

    return { blacklisted: true, site: updated };
  }

  async unblacklistSite(id: number) {
    const site = await this.prisma.url.findFirst({
      where: {
        id,
        blacklistedAt: { not: null },
      },
    });

    if (!site) {
      throw new NotFoundException(`URL introuvable: ${id}`);
    }

    const updated = await this.prisma.url.update({
      where: { id },
      data: {
        blacklistedAt: null,
      },
    });

    return { blacklisted: false, site: updated };
  }

  async deleteSite(id: number) {
    const site = await this.getSite(id);

    await this.prisma.url.update({
      where: { id: site.id },
      data: {
        trashedAt: new Date(),
      },
    });

    return { trashed: true, id: site.id };
  }

  async deleteTrashedSite(id: number) {
    const trashed = await this.prisma.url.findFirst({
      where: {
        id,
        trashedAt: { not: null },
      },
    });

    if (!trashed) {
      throw new NotFoundException(`URL introuvable: ${id}`);
    }

    await this.prospectsService.removeByUrlId(trashed.id);
    await this.prisma.url.delete({
      where: { id: trashed.id },
    });

    return { deleted: true, id: trashed.id };
  }

  async emptyTrash() {
    const trashedUrls = await this.prisma.url.findMany({
      where: { trashedAt: { not: null } },
      select: { id: true },
    });

    for (const item of trashedUrls) {
      await this.prospectsService.removeByUrlId(item.id);
    }

    const deletedUrls = await this.prisma.url.deleteMany({
      where: { trashedAt: { not: null } },
    });

    return { deleted: deletedUrls.count };
  }

  async restoreSite(id: number) {
    const trashed = await this.prisma.url.findFirst({
      where: {
        id,
        trashedAt: { not: null },
      },
    });

    if (!trashed) {
      throw new NotFoundException(`URL introuvable: ${id}`);
    }

    await this.prospectsService.removeByUrlId(trashed.id);

    const restored = await this.prisma.url.update({
      where: { id: trashed.id },
      data: this.buildResetTrashedUrlData(trashed.sourceFile),
    });

    await this.prisma.$executeRawUnsafe(
      'UPDATE "urls" SET "lighthouse_observations_json" = NULL WHERE "id" = ?',
      restored.id,
    );
    await this.clearScanTimingColumns(restored.id);
    await this.clearSiteProfileColumns(restored.id);

    return { restored: true, site: restored };
  }

  async getPendingShopifySites(force = false) {
    return this.prisma.url.findMany({
      where: {
        trashedAt: null,
        blacklistedAt: null,
        ...(force
          ? {}
          : {
              OR: [
                { shopifyStatus: 'unknown' },
                { shopifyStatus: 'shopify', siteName: null },
              ],
            }),
      },
      orderBy: { id: 'asc' },
    });
  }

  async getPendingContactSites(force = false) {
    const rows = await this.prisma.url.findMany({
      where: {
        trashedAt: null,
        blacklistedAt: null,
        shopifyStatus: 'shopify',
        ...(force
          ? {}
          : {
              OR: [
                { prospect: { is: null } },
                { prospect: { is: { contactStatus: 'unknown' } } },
              ],
            }),
      } as any,
      include: {
        prospect: {
          select: this.prospectContactSelect() as any,
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => this.flattenProspectContactFields(row));
  }

  async getUnscannedSites() {
    return this.prisma.url.findMany({
      where: {
        trashedAt: null,
        blacklistedAt: null,
        shopifyCheckedAt: null,
      },
      orderBy: { id: 'asc' },
    });
  }

  private async refreshProspectLeadScore(url: {
    id: number;
    shopifyStatus: string;
    cmsName: string | null;
    shopifyThemeStoreType?: string | null;
    shopifyThemeName: string | null;
    shopifyThemeSchemaName: string | null;
    shopifyThemeJson: string | null;
    siteLanguageCode?: string | null;
    siteLanguageName?: string | null;
    siteCountryCode?: string | null;
    shopifyLegalNoticeStatus?: string | null;
    lighthousePerformanceScore: number | null;
    lighthouseAccessibilityScore: number | null;
    lighthouseBestPracticesScore: number | null;
    lighthouseSeoScore: number | null;
    productCount?: number | null;
    medianProductPrice?: number | null;
  }) {
    const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();
    const leadScore = computeLeadScore(url, leadScoreSettings);

    await this.prisma.prospect.updateMany({
      where: {
        urlId: url.id,
        trashedAt: null,
      },
      data: {
        leadScore,
      },
    });
  }

  async updateShopifyResult(id: number, result: ShopifyScanResult, options: { writeMode?: ScanWriteMode } = {}) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextSiteName = this.applyScanWriteMode(current.siteName, result.siteName ?? null, writeMode);
    const nextCmsName = result.shopifyStatus === 'shopify'
      ? this.applyScanWriteMode(current.cmsName, result.cmsName ?? 'Shopify', writeMode)
      : null;
    const nextShopifyThemeStoreType = result.shopifyStatus === 'shopify'
      ? this.applyScanWriteMode(current.shopifyThemeStoreType, result.shopifyThemeStoreType ?? null, writeMode)
      : null;
    const nextShopifyThemeName = this.applyScanWriteMode(current.shopifyThemeName, result.shopifyThemeName ?? null, writeMode);
    const nextShopifyThemeId = this.applyScanWriteMode(current.shopifyThemeId, result.shopifyThemeId ?? null, writeMode);
    const nextShopifyThemeSchemaName = this.applyScanWriteMode(current.shopifyThemeSchemaName, result.shopifyThemeSchemaName ?? null, writeMode);
    const nextShopifyThemeJson = this.applyScanWriteMode(current.shopifyThemeJson, result.shopifyThemeJson ?? null, writeMode);
    const nextRedesignStatus = current.redesignDecision && current.redesignDecision !== 'draft'
      ? current.redesignStatus
      : this.applyScanWriteMode(current.redesignStatus, result.redesignStatus ?? null, writeMode);
    const nextScanTtfbMs = this.applyScanWriteMode(current.scanTtfbMs, result.ttfbMs ?? null, writeMode);
    const nextScanTotalMs = this.applyScanWriteMode(current.scanTotalMs, result.totalMs ?? null, writeMode);
    const nextScanHtmlBytes = this.applyScanWriteMode(current.scanHtmlBytes, result.htmlBytes ?? null, writeMode);
    const nextShopifyLegalNoticeStatus = result.shopifyStatus === 'shopify'
      ? this.applyScanWriteMode(current.shopifyLegalNoticeStatus, result.shopifyLegalNoticeStatus ?? null, writeMode)
      : null;
    const nextShopifyLegalNoticeUrl = result.shopifyStatus === 'shopify'
      ? this.applyScanWriteMode(current.shopifyLegalNoticeUrl, result.shopifyLegalNoticeUrl ?? null, writeMode)
      : null;
    const nextSiteCountryCode = this.applyScanWriteMode(current.siteCountryCode, result.siteCountryCode ?? null, writeMode);
    const nextSiteCountryName = this.applyScanWriteMode(current.siteCountryName, result.siteCountryName ?? null, writeMode);

    const updatedUrl = await this.prisma.url.update({
      where: { id },
      data: {
        shopifyStatus: result.shopifyStatus,
        shopifyCheckedAt: new Date(),
        httpStatus: result.httpStatus,
        siteName: nextSiteName,
        cmsName: nextCmsName,
        shopifyThemeName: nextShopifyThemeName,
        shopifyThemeId: nextShopifyThemeId,
        shopifyThemeSchemaName: nextShopifyThemeSchemaName,
        shopifyThemeJson: nextShopifyThemeJson,
        redesignStatus: nextRedesignStatus,
        scanTtfbMs: nextScanTtfbMs,
        scanTotalMs: nextScanTotalMs,
        scanHtmlBytes: nextScanHtmlBytes,
      },
    });

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "urls"
        SET
          "site_country_code" = ?,
          "site_country_name" = ?,
          "shopify_theme_store_type" = ?,
          "shopify_legal_notice_status" = ?,
          "shopify_legal_notice_url" = ?,
          "shopify_legal_notice_checked_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      nextSiteCountryCode,
      nextSiteCountryName,
      nextShopifyThemeStoreType,
      nextShopifyLegalNoticeStatus,
      nextShopifyLegalNoticeUrl,
      id,
    );

    const enrichedUpdatedUrl = {
      ...updatedUrl,
      siteCountryCode: nextSiteCountryCode,
      siteCountryName: nextSiteCountryName,
      shopifyThemeStoreType: nextShopifyThemeStoreType,
      shopifyLegalNoticeStatus: nextShopifyLegalNoticeStatus,
      shopifyLegalNoticeUrl: nextShopifyLegalNoticeUrl,
    };

    const nextDecision =
      current.redesignDecision && current.redesignDecision !== 'draft'
        ? current.redesignDecision
        : result.redesignStatus
          ? 'draft'
          : current.redesignDecision ?? 'none';

    await this.prisma.$executeRawUnsafe(
      'UPDATE "urls" SET "redesign_decision" = ? WHERE "id" = ?',
      nextDecision,
      id,
    );

    await this.refreshProspectLeadScore(enrichedUpdatedUrl);

    return enrichedUpdatedUrl;
  }

  async updateCmsResult(
    id: number,
    cmsName: string | null,
    options: { writeMode?: ScanWriteMode } = {},
  ) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextCmsName = this.applyScanWriteMode(current.cmsName, cmsName, writeMode);

    const updatedUrl = await this.prisma.url.update({
      where: { id },
      data: {
        cmsName: nextCmsName,
      },
    });

    await this.refreshProspectLeadScore(updatedUrl);

    return updatedUrl;
  }

  async updateSiteLanguageResult(
    id: number,
    result: SiteLanguageResult,
    options: { writeMode?: ScanWriteMode } = {},
  ) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextSiteLanguageCode = this.applyScanWriteMode(current.siteLanguageCode, result.siteLanguageCode ?? null, writeMode);
    const nextSiteLanguageName = this.applyScanWriteMode(current.siteLanguageName, result.siteLanguageName ?? null, writeMode);

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "urls"
        SET
          "site_language_code" = ?,
          "site_language_name" = ?
        WHERE "id" = ?
      `,
      nextSiteLanguageCode,
      nextSiteLanguageName,
      id,
    );

    const updatedSite = await this.getSite(id);
    await this.refreshProspectLeadScore(updatedSite);

    return updatedSite;
  }

  async updateSeoMetaResult(id: number) {
    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "urls"
        SET
          "seo_meta_checked_at" = CURRENT_TIMESTAMP
        WHERE "id" = ?
      `,
      id,
    );

    return this.getSite(id);
  }

  async syncSeoMetaObservation(id: number, issues: SeoMetaObservationIssue[]) {
    if (!issues.length) {
      await removeSiteObservation(this.prisma, id, 'seo-meta-tags');
      return;
    }

    const severity = issues.some((issue) => issue.severity === 'critical') ? 'critical' : 'warning';
    const detail = issues
      .map((issue) => `• ${issue.title}: ${issue.detail}`)
      .join('\n');

    await upsertSiteObservation(this.prisma, id, {
      key: 'seo-meta-tags',
      title: 'Balises SEO à corriger',
      detail,
      severity,
      source: 'automatic',
    });
  }

  async updateShopifyLegalNoticeResult(
    id: number,
    result: {
      shopifyLegalNoticeStatus: string | null;
      shopifyLegalNoticeUrl: string | null;
    },
    options: { writeMode?: ScanWriteMode } = {},
  ) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextStatus = this.applyScanWriteMode(current.shopifyLegalNoticeStatus, result.shopifyLegalNoticeStatus, writeMode);
    const nextUrl = this.applyScanWriteMode(current.shopifyLegalNoticeUrl, result.shopifyLegalNoticeUrl, writeMode);
    const nextCheckedAtValue = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "urls"
        SET
          "shopify_legal_notice_status" = ?,
          "shopify_legal_notice_url" = ?,
          "shopify_legal_notice_checked_at" = ?
        WHERE "id" = ?
      `,
      nextStatus,
      nextUrl,
      nextCheckedAtValue,
      id,
    );

    const updatedSite = await this.getSite(id);
    await this.refreshProspectLeadScore(updatedSite);

    return updatedSite;
  }

  async updateShopifyLegalNoticeStatus(
    id: number,
    result: {
      shopifyLegalNoticeStatus: string | null;
    },
    options: { writeMode?: ScanWriteMode } = {},
  ) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextStatus = this.applyScanWriteMode(current.shopifyLegalNoticeStatus, result.shopifyLegalNoticeStatus, writeMode);
    const nextCheckedAtValue = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "urls"
        SET
          "shopify_legal_notice_status" = ?,
          "shopify_legal_notice_checked_at" = ?
        WHERE "id" = ?
      `,
      nextStatus,
      nextCheckedAtValue,
      id,
    );

    const updatedSite = await this.getSite(id);
    await this.refreshProspectLeadScore(updatedSite);

    return updatedSite;
  }

  async syncMissingLegalNoticeObservation(id: number, hasLegalNotice: boolean) {
    if (hasLegalNotice) {
      await removeSiteObservation(this.prisma, id, 'shopify-legal-notice');
      await removeSiteObservation(this.prisma, id, 'shopify-legal-notice-missing');
      return;
    }

    await upsertSiteObservation(this.prisma, id, {
      key: 'shopify-legal-notice',
      title: 'Page de mentions légales manquante',
      detail:
        'La page de mentions légales est absente du site.',
      severity: 'warning',
      source: 'automatic',
    });
    await removeSiteObservation(this.prisma, id, 'shopify-legal-notice-missing');
  }

  async updateLighthouseResult(id: number, result: LighthouseAuditResult, options: { writeMode?: ScanWriteMode } = {}) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextLighthouseScore = this.applyScanWriteMode(current.lighthouseScore, result.lighthouseScore, writeMode);
    const nextPerformance = this.applyScanWriteMode(current.lighthousePerformanceScore, result.lighthousePerformanceScore, writeMode);
    const nextAccessibility = this.applyScanWriteMode(current.lighthouseAccessibilityScore, result.lighthouseAccessibilityScore, writeMode);
    const nextBestPractices = this.applyScanWriteMode(current.lighthouseBestPracticesScore, result.lighthouseBestPracticesScore, writeMode);
    const nextSeo = this.applyScanWriteMode(current.lighthouseSeoScore, result.lighthouseSeoScore, writeMode);
    const nextReportJson = this.applyScanWriteMode(current.lighthouseReportJson, result.lighthouseReportJson, writeMode);
    const nextObservationsJson = this.applyScanWriteMode(current.lighthouseObservationsJson, result.lighthouseObservationsJson, writeMode);

    const updatedUrl = await this.prisma.url.update({
      where: { id },
      data: {
        lighthouseCheckedAt: new Date(),
        lighthouseScore: nextLighthouseScore,
        lighthousePerformanceScore: nextPerformance,
        lighthouseAccessibilityScore: nextAccessibility,
        lighthouseBestPracticesScore: nextBestPractices,
        lighthouseSeoScore: nextSeo,
        lighthouseReportJson: nextReportJson,
      },
    });

    await this.prisma.$executeRawUnsafe(
      'UPDATE "urls" SET "lighthouse_observations_json" = ? WHERE "id" = ?',
      nextObservationsJson,
      id,
    );

    await this.refreshProspectLeadScore({
      ...current,
      ...updatedUrl,
      lighthousePerformanceScore: result.lighthousePerformanceScore,
      lighthouseAccessibilityScore: result.lighthouseAccessibilityScore,
      lighthouseBestPracticesScore: result.lighthouseBestPracticesScore,
      lighthouseSeoScore: result.lighthouseSeoScore,
    });

    return updatedUrl;
  }

  async updateProductCatalogResult(id: number, result: ProductCatalogScanResult, options: { writeMode?: ScanWriteMode } = {}) {
    await this.ensureLighthouseColumns();
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const nextProductCount = this.applyScanWriteMode(current.productCount, result.productCount, writeMode);
    const nextMedianProductPrice = this.applyScanWriteMode(current.medianProductPrice, result.medianProductPrice, writeMode);
    const nextGiftCardDetected = this.applyScanWriteMode(current.giftCardDetected, result.giftCardDetected, writeMode);

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "urls"
      SET
        "product_count" = ?,
        "median_product_price" = ?,
        "gift_card_detected" = ?,
        "catalog_checked_at" = CURRENT_TIMESTAMP
      WHERE "id" = ? AND "trashed_at" IS NULL
      `,
      nextProductCount,
      nextMedianProductPrice,
      nextGiftCardDetected ? 1 : 0,
      id,
    );

    if (result.giftCardDetected) {
      await upsertSiteObservation(this.prisma, id, {
        key: 'catalog-gift-card',
        title: 'Carte cadeau détectée',
        detail: 'La page /collections/all contient un produit de type carte cadeau. Cela peut être un signal utile pour qualifier l’offre et la maturité e-commerce du site.',
        severity: 'info',
        source: 'automatic',
      });
    }

    const updatedSite = await this.getSite(id);
    await this.refreshProspectLeadScore(updatedSite);

    return updatedSite;
  }

  async markRescanRequested(ids: number[]) {
    const normalizedIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedIds.length === 0) {
      return { updated: 0 };
    }

    const placeholders = normalizedIds.map(() => '?').join(', ');
    const updated = await this.prisma.$executeRawUnsafe(
      `UPDATE "urls" SET "rescan_requested_at" = CURRENT_TIMESTAMP WHERE "id" IN (${placeholders})`,
      ...normalizedIds,
    );

    return { updated: Number(updated || 0) };
  }

  async clearRescanRequested(id: number) {
    await this.prisma.$executeRawUnsafe(
      'UPDATE "urls" SET "rescan_requested_at" = NULL WHERE "id" = ?',
      id,
    );
  }

  async clearScanTimingColumns(id: number) {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "urls"
      SET
        "scan_shopify_ms" = NULL,
        "scan_catalog_ms" = NULL,
        "scan_contact_ms" = NULL,
        "scan_linkedin_ms" = NULL,
        "scan_social_ms" = NULL,
        "scan_technical_ms" = NULL,
        "scan_seo_meta_ms" = NULL,
        "scan_lighthouse_ms" = NULL,
        "scan_workflow_total_ms" = NULL
      WHERE "id" = ?
      `,
      id,
    );
  }

  async clearSiteProfileColumns(id: number) {
    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "urls"
      SET
        "site_country_code" = NULL,
        "site_country_name" = NULL,
        "site_language_code" = NULL,
        "site_language_name" = NULL,
        "seo_meta_checked_at" = NULL,
        "shopify_theme_store_type" = NULL,
        "shopify_legal_notice_status" = NULL,
        "shopify_legal_notice_url" = NULL,
        "shopify_legal_notice_checked_at" = NULL
      WHERE "id" = ?
      `,
      id,
    );
  }

  async clearScanTimings(id: number) {
    await this.updateScanTimings(id, {
      scanShopifyMs: null,
      scanCmsDetectionMs: null,
      scanLanguageMs: null,
      scanSeoMetaMs: null,
      scanLegalNoticeMs: null,
      scanCatalogMs: null,
      scanContactMs: null,
      scanLinkedinMs: null,
      scanSocialMs: null,
      scanTechnicalMs: null,
      scanLighthouseMs: null,
      scanWorkflowTotalMs: null,
    });
  }

  async clearScanDataColumns(id: number, steps: ScanLaunchStepKey[]) {
    const normalized = new Set(steps);
    const assignments: string[] = [];

    if (normalized.has('shopify')) {
      assignments.push(
        '"shopify_status" = \'unknown\'',
        '"shopify_checked_at" = NULL',
        '"http_status" = NULL',
        '"site_name" = NULL',
        '"cms_name" = NULL',
        '"shopify_theme_name" = NULL',
        '"shopify_theme_id" = NULL',
        '"shopify_theme_schema_name" = NULL',
        '"shopify_theme_json" = NULL',
        '"shopify_theme_store_type" = NULL',
        '"redesign_status" = NULL',
        '"site_country_code" = NULL',
        '"site_country_name" = NULL',
      );
    }

    if (normalized.has('cms_detection') && !normalized.has('shopify')) {
      assignments.push(
        '"cms_name" = NULL',
      );
    }

    if (normalized.has('language')) {
      assignments.push(
        '"site_language_code" = NULL',
        '"site_language_name" = NULL',
      );
    }

    if (normalized.has('seo_meta')) {
      assignments.push(
        '"seo_meta_checked_at" = NULL',
      );
    }

    if (normalized.has('legal_notice')) {
      assignments.push(
        '"shopify_legal_notice_status" = NULL',
        '"shopify_legal_notice_url" = NULL',
        '"shopify_legal_notice_checked_at" = NULL',
      );
    }

    if (normalized.has('catalog')) {
      assignments.push(
        '"product_count" = NULL',
        '"median_product_price" = NULL',
        '"gift_card_detected" = 0',
        '"catalog_checked_at" = NULL',
      );
    }

    if (normalized.has('contact') || normalized.has('linkedin') || normalized.has('social')) {
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE "prospects"
        SET
          "contact_status" = 'unknown',
          "contact_checked_at" = NULL,
          "contact_email" = NULL,
          "contact_phone" = NULL,
          "contact_siret" = NULL,
          "contact_siren" = NULL,
          "contact_first_name" = NULL,
          "contact_last_name" = NULL,
          "contact_owner_name" = NULL,
          "contact_company_name" = NULL,
          "contact_company_address" = NULL,
          "contact_company_address_extra" = NULL,
          "contact_company_postal_code" = NULL,
          "contact_company_city" = NULL,
          "contact_company_legal_form" = NULL,
          "contact_company_country" = NULL,
          "contact_source_url" = NULL,
          "contact_evidence" = NULL,
          "contact_linkedin_url" = NULL,
          "contact_company_linkedin_url" = NULL,
          "contact_social_links_json" = NULL
        WHERE "url_id" = ? AND "trashed_at" IS NULL
        `,
        id,
      );
    }

    if (normalized.has('lighthouse')) {
      assignments.push(
        '"lighthouse_checked_at" = NULL',
        '"lighthouse_score" = NULL',
        '"lighthouse_performance_score" = NULL',
        '"lighthouse_accessibility_score" = NULL',
        '"lighthouse_best_practices_score" = NULL',
        '"lighthouse_seo_score" = NULL',
        '"lighthouse_report_json" = NULL',
        '"lighthouse_observations_json" = NULL',
      );
    }

    if (normalized.has('seo_meta')) {
      await removeSiteObservation(this.prisma, id, 'seo-meta-tags');
    }

    if (assignments.length === 0) {
      return;
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "urls" SET ${assignments.join(', ')} WHERE "id" = ?`,
      id,
    );
  }

  async updateScanTimings(id: number, timings: ScanTimingUpdate) {
    await this.ensureLighthouseColumns();

    const columnMap: Record<keyof ScanTimingUpdate, string> = {
      scanShopifyMs: 'scan_shopify_ms',
      scanCmsDetectionMs: 'scan_cms_detection_ms',
      scanLanguageMs: 'scan_language_ms',
      scanSeoMetaMs: 'scan_seo_meta_ms',
      scanLegalNoticeMs: 'scan_legal_notice_ms',
      scanCatalogMs: 'scan_catalog_ms',
      scanContactMs: 'scan_contact_ms',
      scanLinkedinMs: 'scan_linkedin_ms',
      scanSocialMs: 'scan_social_ms',
      scanTechnicalMs: 'scan_technical_ms',
      scanLighthouseMs: 'scan_lighthouse_ms',
      scanWorkflowTotalMs: 'scan_workflow_total_ms',
    };

    const entries = Object.entries(timings).filter(([, value]) => value !== undefined) as Array<
      [keyof ScanTimingUpdate, number | null]
    >;

    if (entries.length === 0) {
      return;
    }

    const assignments = entries.map(([key]) => `"${columnMap[key]}" = ?`).join(', ');
    const values = entries.map(([, value]) => value);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "urls" SET ${assignments} WHERE "id" = ?`,
      ...values,
      id,
    );
  }

  async updateContactResult(id: number, result: ContactResult, options: { writeMode?: ScanWriteMode } = {}) {
    const current = await this.getSite(id);
    const writeMode = options.writeMode || 'clear';
    const currentEmailIsPlaceholder = isPlaceholderContactEmail(current.contactEmail);
    const nextContactEmail = result.contactEmailWasPlaceholder
      ? (currentEmailIsPlaceholder ? null : current.contactEmail)
      : this.applyScanWriteMode(current.contactEmail, result.email, writeMode);
    const nextContactCompanyAddress = this.applyScanWriteMode(
      current.contactCompanyAddress,
      result.companyAddress,
      writeMode,
    );
    const nextContactCompanyAddressExtra = this.applyScanWriteMode(
      current.contactCompanyAddressExtra,
      result.companyAddressExtra,
      writeMode,
    );
    const nextContactCompanyPostalCode = this.applyScanWriteMode(
      current.contactCompanyPostalCode,
      result.companyPostalCode,
      writeMode,
    );
    const nextContactCompanyCity = this.applyScanWriteMode(
      current.contactCompanyCity,
      result.companyCity,
      writeMode,
    );
    const nextContactCompanyLegalForm = this.applyScanWriteMode(
      current.contactCompanyLegalForm,
      result.companyLegalForm,
      writeMode,
    );
    const nextContactCompanyCountry = this.applyScanWriteMode(
      current.contactCompanyCountry,
      result.companyCountry,
      writeMode,
    );

    const nextContactStatus = this.applyScanWriteMode(current.contactStatus, result.status, writeMode) ?? 'unknown';
    const nextContactCheckedAt = new Date();
    const flattenedProspect = {
      ...current,
      contactStatus: nextContactStatus,
      contactCheckedAt: nextContactCheckedAt,
      contactEmail: nextContactEmail,
      contactPhone: this.applyScanWriteMode(current.contactPhone, result.phone, writeMode),
      contactSiret: this.applyScanWriteMode(current.contactSiret, result.siret, writeMode),
      contactSiren: this.applyScanWriteMode(current.contactSiren, result.siren, writeMode),
      contactFirstName: this.applyScanWriteMode(current.contactFirstName, result.firstName, writeMode),
      contactLastName: this.applyScanWriteMode(current.contactLastName, result.lastName, writeMode),
      contactOwnerName: this.applyScanWriteMode(current.contactOwnerName, result.ownerName, writeMode),
      contactCompanyName: this.applyScanWriteMode(current.contactCompanyName, result.companyName, writeMode),
      contactCompanyAddress: nextContactCompanyAddress,
      contactCompanyAddressExtra: nextContactCompanyAddressExtra,
      contactCompanyPostalCode: nextContactCompanyPostalCode,
      contactCompanyCity: nextContactCompanyCity,
      contactCompanyLegalForm: nextContactCompanyLegalForm,
      contactCompanyCountry: nextContactCompanyCountry,
      contactSourceUrl: this.applyScanWriteMode(current.contactSourceUrl, result.sourceUrl, writeMode),
      contactEvidence: this.applyScanWriteMode(current.contactEvidence, result.evidence, writeMode),
      contactLinkedinUrl: this.applyScanWriteMode(current.contactLinkedinUrl, result.linkedinUrl, writeMode),
      contactCompanyLinkedinUrl: this.applyScanWriteMode(current.contactCompanyLinkedinUrl, result.companyLinkedinUrl, writeMode),
      contactSocialLinksJson: this.applyScanWriteMode(
        current.contactSocialLinksJson,
        result.socialLinks && result.socialLinks.length > 0 ? JSON.stringify(result.socialLinks) : null,
        writeMode,
      ),
    };

    if (result.contactObservation) {
      await upsertSiteObservation(this.prisma, id, {
        key: result.contactObservation.key,
        title: result.contactObservation.title,
        detail: result.contactObservation.detail,
        severity: result.contactObservation.severity,
        source: 'automatic',
      });
    } else {
      await removeSiteObservation(this.prisma, id, 'contact-placeholder-email');
    }

    if (result.status === 'found') {
      const nameParts = [flattenedProspect.contactFirstName, flattenedProspect.contactLastName].filter(Boolean);
      const prospectName =
        nameParts.join(' ').trim() ||
        flattenedProspect.contactCompanyName ||
        flattenedProspect.siteName ||
        flattenedProspect.url;
      const siteName =
        flattenedProspect.siteName ||
        flattenedProspect.siteKey ||
        flattenedProspect.url;
      const score =
        [
          flattenedProspect.contactEmail,
          flattenedProspect.contactPhone,
          flattenedProspect.contactOwnerName,
          flattenedProspect.contactCompanyName,
          flattenedProspect.contactLinkedinUrl,
          flattenedProspect.contactCompanyLinkedinUrl,
        ].filter(Boolean).length * 16;
      const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();
      const leadScore = computeLeadScore(flattenedProspect, leadScoreSettings);

      await this.prospectsService.upsertFromContactResult(id, {
        name: prospectName,
        siteName,
        sourceUrl: flattenedProspect.contactSourceUrl || flattenedProspect.url,
        sourceFile: flattenedProspect.sourceFile,
        contactStatus: flattenedProspect.contactStatus,
        contactCheckedAt: flattenedProspect.contactCheckedAt,
        email: flattenedProspect.contactEmail,
        phone: flattenedProspect.contactPhone,
        siret: flattenedProspect.contactSiret,
        siren: flattenedProspect.contactSiren,
        linkedinUrl: flattenedProspect.contactLinkedinUrl || flattenedProspect.contactCompanyLinkedinUrl,
        avatarUrl: result.avatarUrl,
        owner: flattenedProspect.contactOwnerName,
        lastName: flattenedProspect.contactLastName,
        lastChecked: flattenedProspect.contactCheckedAt,
        evidence: flattenedProspect.contactEvidence,
        score: Math.min(100, score),
        leadScore,
        firstName: flattenedProspect.contactFirstName,
        companyName: flattenedProspect.contactCompanyName,
        companyAddress: flattenedProspect.contactCompanyAddress,
        companyAddressExtra: flattenedProspect.contactCompanyAddressExtra,
        companyPostalCode: flattenedProspect.contactCompanyPostalCode,
        companyCity: flattenedProspect.contactCompanyCity,
        companyLegalForm: flattenedProspect.contactCompanyLegalForm,
        companyCountry: flattenedProspect.contactCompanyCountry,
        companyLinkedinUrl: flattenedProspect.contactCompanyLinkedinUrl,
        socialLinks: JSON.parse(flattenedProspect.contactSocialLinksJson || '[]'),
      });
    }

    return this.getSite(id);
  }

  async clearContactLinkedinResult(id: number) {
    await this.getSite(id);

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "prospects"
      SET
        "contact_linkedin_url" = NULL,
        "contact_company_linkedin_url" = NULL,
        "contact_social_links_json" = NULL
      WHERE "url_id" = ? AND "trashed_at" IS NULL
      `,
      id,
    );

    return this.getSite(id);
  }

  async clearContactResult(id: number) {
    await this.getSite(id);

    await removeSiteObservation(this.prisma, id, 'contact-placeholder-email');

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "prospects"
      SET
        "contact_status" = 'unknown',
        "contact_checked_at" = NULL,
        "contact_email" = NULL,
        "contact_phone" = NULL,
        "contact_siret" = NULL,
        "contact_siren" = NULL,
        "contact_first_name" = NULL,
        "contact_last_name" = NULL,
        "contact_owner_name" = NULL,
        "contact_company_name" = NULL,
        "contact_company_address" = NULL,
        "contact_company_address_extra" = NULL,
        "contact_company_postal_code" = NULL,
        "contact_company_city" = NULL,
        "contact_company_legal_form" = NULL,
        "contact_company_country" = NULL,
        "contact_source_url" = NULL,
        "contact_evidence" = NULL,
        "contact_linkedin_url" = NULL,
        "contact_company_linkedin_url" = NULL,
        "contact_social_links_json" = NULL
      WHERE "url_id" = ? AND "trashed_at" IS NULL
      `,
      id,
    );

    return this.getSite(id);
  }

  async setRedesignStatus(ids: number[], status: RedesignStatus = 'cible', decision: RedesignDecision = 'manual') {
    const allowedStatuses = new Set<RedesignStatus>([
      'cible',
      'candidat',
      'candidat migration',
      'candidat refonte',
      'ignore',
      'none',
    ]);
    if (!allowedStatuses.has(status)) {
      throw new BadRequestException(
        'Statut refonte invalide. Valeurs: cible, candidat, candidat migration, candidat refonte, ignore, none.',
      );
    }

    const normalizedIds = ids.filter((id) => Number.isInteger(id) && id > 0);
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Aucun ID valide fourni.');
    }

    const storedStatus = status === 'none' ? null : status;
    const nextDecision = storedStatus ? decision : 'none';
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE "urls" SET "redesign_status" = ?, "redesign_decision" = ? WHERE "id" IN (${normalizedIds.join(', ')}) AND "trashed_at" IS NULL AND "blacklisted_at" IS NULL`,
      storedStatus,
      nextDecision,
    );

    return {
      ids: normalizedIds,
      status: storedStatus,
      updated: Number(result || 0),
    };
  }

  async saveQualification(id: number, body: SaveSiteQualificationInput) {
    await this.getSite(id);
    const qualification = await saveSiteQualification(this.prisma, id, body);
    await this.recalculateLeadScoreFromUrlId(id);
    return qualification;
  }

  async purgeNonShopifyUrls() {
    const result = await this.prisma.url.updateMany({
      where: { shopifyStatus: 'not_shopify', trashedAt: null, blacklistedAt: null },
      data: { trashedAt: new Date() },
    });

    return { trashed: result.count };
  }

  async purgeUnknownCmsUrls() {
    const result = await this.prisma.url.updateMany({
      where: {
        trashedAt: null,
        blacklistedAt: null,
        OR: [{ cmsName: 'unknown' }, { cmsName: 'Custom / Static' }, { cmsName: null }],
      },
      data: { trashedAt: new Date() },
    });

    return { trashed: result.count };
  }

  async resetDatabase() {
    const result = await this.prisma.url.deleteMany();

    return { deleted: result.count };
  }
}

