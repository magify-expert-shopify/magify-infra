import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContactsService } from 'src/contacts/contacts.service';
import { ProspectsService } from 'src/prospects/prospects.service';
import { ScanningService } from 'src/scanning/scanning.service';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';
import {
  cleanUrl,
  normalizeSiteUrl,
  type ContactResult,
  UrlsService,
} from 'src/urls/urls.service';
import { getTableColumnNames } from 'src/database/sqlite-schema';
import { IMPORT_ANALYSIS_QUEUE } from 'src/queues/queue.constants';
import { ImportEventsService } from './import-events.service';
import type { ImportAnalysisJobData } from './imports.processor';

type ImportedUrlRow = {
  id: number;
  url: string;
  httpStatus: number | null;
  shopifyStatus: string;
  siteName: string | null;
  cmsName: string | null;
  shopifyThemeName: string | null;
  shopifyThemeId: string | null;
  shopifyThemeSchemaName: string | null;
  shopifyThemeJson: string | null;
  redesignStatus: string | null;
  scanTtfbMs: number | null;
  scanTotalMs: number | null;
  scanHtmlBytes: number | null;
  contactStatus: string;
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
};

type ImportBatchRecord = {
  id: number;
  sourceFile: string;
  urlsJson: string;
  urlIdsJson: string;
  existingUrlIdsJson: string;
  newUrlIdsJson: string;
  totalUrls: number;
  existingUrls: number;
  queuedUrls: number;
  processedUrls: number;
  failedUrls: number;
  status: string;
  currentStep: string;
  currentUrlId: number | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  shopifyDoneAt: Date | null;
  contactDoneAt: Date | null;
  linkedinDoneAt: Date | null;
  technicalDoneAt: Date | null;
  lighthouseDoneAt: Date | null;
  completedAt: Date | null;
  trashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ImportStepName = 'shopify' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse';
type ImportScanScope = 'new' | 'existing' | 'all';
type ImportStatusFilter = 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'error' | 'created';
type ImportUrlState = {
  id: number | null;
  url: string;
  state: 'done' | 'running' | 'pending' | 'missing';
};
type ImportUrlAnalysisCounts = {
  done: number;
  running: number;
  pending: number;
  total: number;
};
type ActiveImportJobState = {
  batchId: number;
  urlId: number | null;
  state: Awaited<ReturnType<Job<ImportAnalysisJobData>['getState']>>;
};
type SerializedImportBatch = {
  id: number;
  sourceFile: string;
  urls: string[];
  urlIds: number[];
  existingUrlIds?: number[];
  newUrlIds?: number[];
  totalUrls: number;
  existingUrls: number;
  queuedUrls: number;
  processedUrls: number;
  failedUrls: number;
  status: string;
  currentStep: string;
  currentUrlId: number | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  shopifyDoneAt: Date | null;
  contactDoneAt: Date | null;
  linkedinDoneAt: Date | null;
  technicalDoneAt: Date | null;
  lighthouseDoneAt: Date | null;
  completedAt: Date | null;
  trashedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  urlAnalysisCounts: ImportUrlAnalysisCounts;
};
type SerializedImportBatchDetail = SerializedImportBatch & {
  urlStates: ImportUrlState[];
};
type ImportViewMode = 'full' | 'page';
type SerializedImportProspect = {
  id: number;
  urlId: number | null;
  name: string | null;
  siteName: string | null;
  status: string | null;
  email: string | null;
  avatarUrl: string | null;
  linkedinImageUrl: string | null;
};
type SerializedImportUrlDetail = {
  id: number;
  url: string;
  siteName: string | null;
  shopifyStatus: string;
  contactStatus: string;
  cmsName: string | null;
  shopifyCheckedAt: string | null;
  contactCheckedAt: string | null;
  lighthouseCheckedAt: string | null;
  scanTotalMs: number | null;
  scanTtfbMs: number | null;
  lighthouseScore: number | null;
  redesignStatus: string | null;
  blacklistedAt: string | null;
  missing?: boolean;
  error?: string;
};
type SerializedImportRealtimePayload = {
  import: SerializedImportBatchDetail;
  prospects: { total: number; prospects: SerializedImportProspect[] };
  urls: SerializedImportUrlDetail[];
};

type SkippedImportCreationResult = {
  skipped: true;
  reason: 'all_urls_already_scanned';
  message: string;
  sourceFile: string;
  totalUrls: number;
  existingUrls: number;
  urlIds: number[];
  existingUrlIds: number[];
  newUrlIds: number[];
};

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private importsTableReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly urlsService: UrlsService,
    private readonly scanningService: ScanningService,
    private readonly contactsService: ContactsService,
    private readonly prospectsService: ProspectsService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly importEventsService: ImportEventsService,
    @InjectQueue(IMPORT_ANALYSIS_QUEUE) private readonly importAnalysisQueue: Queue<ImportAnalysisJobData>,
  ) {}

  private async buildImportRealtimePayload(importId: number): Promise<SerializedImportRealtimePayload> {
    return {
      import: await this.getImport(importId),
      prospects: await this.getImportProspects(importId),
      urls: await this.getImportUrls(importId),
    };
  }

  private async emitImportEvent(type: string, importId: number, extra: Record<string, unknown> = {}) {
    this.importEventsService.emit(importId, type, {
      ...extra,
      ...(await this.buildImportRealtimePayload(importId)),
    });
  }

  private isAnalyzedSite(site: {
    shopifyCheckedAt: Date | null;
    contactCheckedAt: Date | null;
    lighthouseCheckedAt: Date | null;
    shopifyStatus: string;
    contactStatus: string;
    lighthouseScore: number | null;
    scanTotalMs: number | null;
  }) {
    return Boolean(
      site.shopifyCheckedAt
      || site.contactCheckedAt
      || site.lighthouseCheckedAt
      || (site.shopifyStatus && site.shopifyStatus !== 'unknown')
      || (site.contactStatus && site.contactStatus !== 'unknown')
      || site.lighthouseScore != null
      || site.scanTotalMs != null,
    );
  }

  private async ensureImportsTable() {
    if (this.importsTableReady) {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "imports" (
        "id" SERIAL PRIMARY KEY,
        "source_file" TEXT NOT NULL,
        "urls_json" TEXT NOT NULL,
        "url_ids_json" TEXT NOT NULL,
        "existing_url_ids_json" TEXT NOT NULL DEFAULT '[]',
        "new_url_ids_json" TEXT NOT NULL DEFAULT '[]',
        "total_urls" INTEGER NOT NULL DEFAULT 0,
        "existing_urls" INTEGER NOT NULL DEFAULT 0,
        "queued_urls" INTEGER NOT NULL DEFAULT 0,
        "processed_urls" INTEGER NOT NULL DEFAULT 0,
        "failed_urls" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'created',
        "current_step" TEXT NOT NULL DEFAULT 'created',
        "current_url_id" INTEGER,
        "queued_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "last_error" TEXT,
        "shopify_done_at" TIMESTAMPTZ,
        "contact_done_at" TIMESTAMPTZ,
        "linkedin_done_at" TIMESTAMPTZ,
        "technical_done_at" TIMESTAMPTZ,
        "lighthouse_done_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "trashed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columns = await getTableColumnNames(this.prisma, 'imports');

    if (!columns.includes('existing_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "existing_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('queued_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "queued_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('processed_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "processed_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('failed_urls')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "failed_urls" INTEGER NOT NULL DEFAULT 0',
      );
    }

    if (!columns.includes('current_url_id')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "current_url_id" INTEGER',
      );
    }

    if (!columns.includes('queued_at')) {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "imports" ADD COLUMN "queued_at" TIMESTAMPTZ');
    }

    if (!columns.includes('started_at')) {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "imports" ADD COLUMN "started_at" TIMESTAMPTZ');
    }

    if (!columns.includes('finished_at')) {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "imports" ADD COLUMN "finished_at" TIMESTAMPTZ');
    }

    if (!columns.includes('last_error')) {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "imports" ADD COLUMN "last_error" TEXT');
    }

    if (!columns.includes('existing_url_ids_json')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "existing_url_ids_json" TEXT NOT NULL DEFAULT \'[]\'',
      );
    }

    if (!columns.includes('new_url_ids_json')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "new_url_ids_json" TEXT NOT NULL DEFAULT \'[]\'',
      );
    }

    if (!columns.includes('lighthouse_done_at')) {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "imports" ADD COLUMN "lighthouse_done_at" TIMESTAMPTZ',
      );
    }

    if (!columns.includes('trashed_at')) {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "imports" ADD COLUMN "trashed_at" TIMESTAMPTZ');
    }

    this.importsTableReady = true;
  }

  private dbRowToRecord(row: any): ImportBatchRecord {
    return {
      id: Number(row.id),
      sourceFile: String(row.source_file),
      urlsJson: String(row.urls_json),
      urlIdsJson: String(row.url_ids_json),
      existingUrlIdsJson: String(row.existing_url_ids_json || '[]'),
      newUrlIdsJson: String(row.new_url_ids_json || '[]'),
      totalUrls: Number(row.total_urls || 0),
      existingUrls: Number(row.existing_urls || 0),
      queuedUrls: Number(row.queued_urls || 0),
      processedUrls: Number(row.processed_urls || 0),
      failedUrls: Number(row.failed_urls || 0),
      status: String(row.status || 'created'),
      currentStep: String(row.current_step || 'created'),
      currentUrlId: row.current_url_id ? Number(row.current_url_id) : null,
      queuedAt: row.queued_at ? new Date(row.queued_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      lastError: row.last_error ? String(row.last_error) : null,
      shopifyDoneAt: row.shopify_done_at ? new Date(row.shopify_done_at) : null,
      contactDoneAt: row.contact_done_at ? new Date(row.contact_done_at) : null,
      linkedinDoneAt: row.linkedin_done_at ? new Date(row.linkedin_done_at) : null,
      technicalDoneAt: row.technical_done_at ? new Date(row.technical_done_at) : null,
      lighthouseDoneAt: row.lighthouse_done_at ? new Date(row.lighthouse_done_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      trashedAt: row.trashed_at ? new Date(row.trashed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private parseJsonList(value: string | null | undefined) {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private interpolateSql(query: string, params: unknown[]) {
    let index = 0;

    return query.replace(/\?/g, () => this.toSqlLiteral(params[index++]));
  }

  private toSqlLiteral(value: unknown) {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (value instanceof Date) {
      return `'${value.toISOString().replace(/'/g, "''")}'`;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private async getActiveImportJobs() {
    const jobs = await this.importAnalysisQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);

    const jobStates = await Promise.all(
      (Array.isArray(jobs) ? jobs : [])
        .filter((job): job is NonNullable<typeof job> => Boolean(job && job.data))
        .map(async (job) => ({
          batchId: Number(job.data?.batchId),
          urlId: Number.isInteger(Number(job.data?.urlId)) ? Number(job.data?.urlId) : null,
          state: await job.getState(),
        })),
    );

    return jobStates.filter((job): job is ActiveImportJobState => Number.isInteger(job.batchId) && job.batchId > 0);
  }

  private async getQueuedImportUrlIds() {
    const jobs = await this.importAnalysisQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'paused',
    ]);

    return new Set(
      (Array.isArray(jobs) ? jobs : [])
        .filter((job): job is NonNullable<typeof job> => Boolean(job && job.data))
        .map((job) => Number(job.data?.urlId))
        .filter((value) => Number.isInteger(value) && value > 0),
    );
  }

  private getQueuedImportBatchIds(jobs: ActiveImportJobState[]) {
    return new Set(jobs.map((job) => job.batchId));
  }

  private getCurrentImportUrlIdFromQueue(batchId: number, jobs: ActiveImportJobState[]) {
    return jobs.find((job) => job.batchId === batchId && job.state === 'active')?.urlId ?? null;
  }

  private hasRealScanEvidence(site: {
    shopifyCheckedAt: Date | null;
    contactCheckedAt: Date | null;
    lighthouseCheckedAt: Date | null;
    scanTtfbMs: number | null;
    scanTotalMs: number | null;
    scanHtmlBytes: number | null;
    lighthouseScore: number | null;
  }) {
    return Boolean(
      site.shopifyCheckedAt
      || site.contactCheckedAt
      || site.lighthouseCheckedAt
      || site.scanTtfbMs != null
      || site.scanTotalMs != null
      || site.scanHtmlBytes != null
      || site.lighthouseScore != null,
    );
  }

  private getImportUrlAnalysisCounts(urlStates: ImportUrlState[]): ImportUrlAnalysisCounts {
    const done = urlStates.filter((row) => row.state === 'done').length;
    const running = urlStates.filter((row) => row.state === 'running').length;
    const pending = urlStates.filter((row) => row.state === 'pending' || row.state === 'missing').length;

    return {
      done,
      running,
      pending,
      total: urlStates.length,
    };
  }

  private async reconcileImportBatch(
    batch: ImportBatchRecord,
    activeImportJobs: ActiveImportJobState[],
    view: ImportViewMode = 'full',
  ): Promise<SerializedImportBatchDetail> {
    const activeBatchIds = this.getQueuedImportBatchIds(activeImportJobs);
    const queueCurrentUrlId = this.getCurrentImportUrlIdFromQueue(batch.id, activeImportJobs);
    const batchWithQueueState = queueCurrentUrlId
      ? { ...batch, currentUrlId: batch.currentUrlId || queueCurrentUrlId }
      : batch;

    if (!['queued', 'processing'].includes(batch.status)) {
      const urlStates = await this.buildImportUrlStates(batchWithQueueState, queueCurrentUrlId);
      return {
        ...this.serializeImport(batchWithQueueState, view),
        urlStates,
        urlAnalysisCounts: this.getImportUrlAnalysisCounts(urlStates),
      };
    }

    if (activeBatchIds.has(batch.id)) {
      const urlStates = await this.buildImportUrlStates(batchWithQueueState, queueCurrentUrlId);
      return {
        ...this.serializeImport(batchWithQueueState, view),
        urlStates,
        urlAnalysisCounts: this.getImportUrlAnalysisCounts(urlStates),
      };
    }

    const processedAndFailed = batch.processedUrls + batch.failedUrls;
    const isFinished = processedAndFailed >= batch.queuedUrls;
    const nextStatus = isFinished
      ? (batch.failedUrls > 0 ? 'completed_with_errors' : 'completed')
      : 'error';
    const nextStep = isFinished ? 'completed' : 'error';
    const nextLastError = isFinished
      ? batch.lastError
      : batch.lastError || 'Import interrompu: aucune tâche restante dans la queue.';

    let nextBatch = { ...batch };

    if (isFinished) {
      await this.prisma.$executeRawUnsafe(
        `
          UPDATE "imports"
          SET
            "status" = ?,
            "current_step" = ?,
            "last_error" = ?,
            "finished_at" = CURRENT_TIMESTAMP,
            "completed_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        nextStatus,
        nextStep,
        nextLastError,
        batch.id,
      );
      nextBatch = {
        ...batch,
        status: nextStatus,
        currentStep: nextStep,
        lastError: nextLastError,
        finishedAt: new Date(),
        completedAt: new Date(),
      };
    } else {
      await this.prisma.$executeRawUnsafe(
        `
          UPDATE "imports"
          SET
            "status" = 'error',
            "current_step" = 'error',
            "last_error" = ?,
            "finished_at" = CURRENT_TIMESTAMP,
            "completed_at" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        nextLastError,
        batch.id,
      );
      nextBatch = {
        ...batch,
        status: 'error',
        currentStep: 'error',
        lastError: nextLastError,
        finishedAt: new Date(),
        completedAt: null,
      };
    }

    const urlStates = await this.buildImportUrlStates(nextBatch);
    return {
      ...this.serializeImport(nextBatch, view),
      urlStates,
      urlAnalysisCounts: this.getImportUrlAnalysisCounts(urlStates),
    };
  }

  private serializeImport(batch: ImportBatchRecord, view: ImportViewMode = 'full'): SerializedImportBatch {
    const base = {
      id: batch.id,
      sourceFile: batch.sourceFile,
      urls: this.parseJsonList(batch.urlsJson),
      urlIds: this.parseJsonList(batch.urlIdsJson),
      totalUrls: batch.totalUrls,
      existingUrls: batch.existingUrls,
      queuedUrls: batch.queuedUrls,
      processedUrls: batch.processedUrls,
      failedUrls: batch.failedUrls,
      status: batch.status,
      currentStep: batch.currentStep,
      currentUrlId: batch.currentUrlId,
      queuedAt: batch.queuedAt,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
      lastError: batch.lastError,
      shopifyDoneAt: batch.shopifyDoneAt,
      contactDoneAt: batch.contactDoneAt,
      linkedinDoneAt: batch.linkedinDoneAt,
      technicalDoneAt: batch.technicalDoneAt,
      lighthouseDoneAt: batch.lighthouseDoneAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      urlAnalysisCounts: {
        done: 0,
        running: 0,
        pending: 0,
        total: 0,
      },
    };

    if (view === 'page') {
      return base;
    }

    return {
      ...base,
      existingUrlIds: this.parseJsonList(batch.existingUrlIdsJson),
      newUrlIds: this.parseJsonList(batch.newUrlIdsJson),
      trashedAt: batch.trashedAt,
    };
  }

  private async buildImportUrlStates(batch: ImportBatchRecord, queueCurrentUrlId: number | null = null): Promise<ImportUrlState[]> {
    const urlIds = this.parseJsonList(batch.urlIdsJson)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const urls = this.parseJsonList(batch.urlsJson).map((value) => String(value || ''));
    const sites = await this.urlsService.getSitesByIds(urlIds);
    const sitesById = new Map(sites.map((site) => [Number(site.id), site]));
    const fallbackPendingUrlIds = urlIds.filter((urlId) => {
      const site = sitesById.get(urlId);
      return Boolean(site && !this.hasRealScanEvidence(site));
    });
    const nextPendingIndex = Math.max(0, batch.processedUrls + batch.failedUrls);
    const fallbackRunningUrlId =
      ['queued', 'processing'].includes(batch.status) && nextPendingIndex < fallbackPendingUrlIds.length
        ? fallbackPendingUrlIds[nextPendingIndex]
        : null;
    const runningUrlId =
      ['queued', 'processing'].includes(batch.status) && (batch.currentUrlId || queueCurrentUrlId)
        ? batch.currentUrlId || queueCurrentUrlId
        : fallbackRunningUrlId;

    return urlIds.map((urlId, index) => {
      const url = urls[index] || '';
      const site = sitesById.get(urlId);

      if (!site) {
        return {
          id: urlId,
          url,
          state: 'missing',
        };
      }

      if (runningUrlId === urlId) {
        return {
          id: urlId,
          url,
          state: 'running',
        };
      }

      if (this.hasRealScanEvidence(site)) {
        return {
          id: urlId,
          url,
          state: 'done',
        };
      }

      return {
        id: urlId,
        url,
        state: 'pending',
      };
    });
  }

  async getImport(id: number, options: { view?: ImportViewMode } = {}): Promise<SerializedImportBatchDetail> {
    await this.ensureImportsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql('SELECT * FROM "imports" WHERE "id" = ? LIMIT 1', [id]),
    );
    const batch = rows[0];

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${id}`);
    }

    const activeImportJobs = await this.getActiveImportJobs();
    return this.reconcileImportBatch(this.dbRowToRecord(batch), activeImportJobs, options.view ?? 'full');
  }

  async getImportProspects(id: number): Promise<{ total: number; prospects: SerializedImportProspect[] }> {
    await this.ensureImportsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql('SELECT * FROM "imports" WHERE "id" = ? LIMIT 1', [id]),
    );
    const batch = rows[0];

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${id}`);
    }

    const record = this.dbRowToRecord(batch);
    const urlIds = this.parseJsonList(record.urlIdsJson)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const prospects = await this.prospectsService.listProspectsByUrlIds(urlIds);

    return {
      total: prospects.length,
      prospects: prospects.map((prospect) => ({
        id: prospect.id,
        urlId: prospect.urlId,
        name: prospect.name,
        siteName: prospect.siteName,
        status: prospect.status,
        email: prospect.email,
        avatarUrl: prospect.avatarUrl,
        linkedinImageUrl: prospect.linkedinImageUrl,
      })),
    };
  }

  async getImportUrls(id: number): Promise<SerializedImportUrlDetail[]> {
    await this.ensureImportsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql('SELECT * FROM "imports" WHERE "id" = ? LIMIT 1', [id]),
    );
    const batch = rows[0];

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${id}`);
    }

    const record = this.dbRowToRecord(batch);
    const urlIds = this.parseJsonList(record.urlIdsJson)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const urls = this.parseJsonList(record.urlsJson).map((value) => String(value || ''));
    const sites = await this.urlsService.getSitesByIds(urlIds);
    const sitesById = new Map(sites.map((site) => [Number(site.id), site]));

    return urlIds.map((urlId, index) => {
      const url = urls[index] || '';
      const site = sitesById.get(urlId);

      if (!site) {
        return {
          id: urlId,
          url,
          siteName: null,
          shopifyStatus: 'unknown',
          contactStatus: 'unknown',
          cmsName: null,
          shopifyCheckedAt: null,
          contactCheckedAt: null,
          lighthouseCheckedAt: null,
          scanTotalMs: null,
          scanTtfbMs: null,
          lighthouseScore: null,
          redesignStatus: null,
          blacklistedAt: null,
          missing: true,
          error: 'URL introuvable ou supprimée.',
        };
      }

      return {
        id: urlId,
        url,
        siteName: site.siteName ?? null,
        shopifyStatus: site.shopifyStatus ?? 'unknown',
        contactStatus: site.contactStatus ?? 'unknown',
        cmsName: site.cmsName ?? null,
        shopifyCheckedAt: site.shopifyCheckedAt ? new Date(site.shopifyCheckedAt).toISOString() : null,
        contactCheckedAt: site.contactCheckedAt ? new Date(site.contactCheckedAt).toISOString() : null,
        lighthouseCheckedAt: site.lighthouseCheckedAt ? new Date(site.lighthouseCheckedAt).toISOString() : null,
        scanTotalMs: site.scanTotalMs == null ? null : Number(site.scanTotalMs),
        scanTtfbMs: site.scanTtfbMs == null ? null : Number(site.scanTtfbMs),
        lighthouseScore: site.lighthouseScore == null ? null : Number(site.lighthouseScore),
        redesignStatus: site.redesignStatus ?? null,
        blacklistedAt: site.blacklistedAt ? new Date(site.blacklistedAt).toISOString() : null,
      };
    });
  }

  async getImportRealtimeSnapshot(id: number): Promise<SerializedImportRealtimePayload> {
    return this.buildImportRealtimePayload(id);
  }

  async listImports(status?: string): Promise<SerializedImportBatchDetail[]> {
    await this.ensureImportsTable();

    const filters = (status || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is ImportStatusFilter =>
        ['queued', 'processing', 'completed', 'completed_with_errors', 'error', 'created'].includes(value),
      );

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql(
        `
        SELECT *
        FROM "imports"
        ${filters.length ? `WHERE "status" IN (${filters.map(() => '?').join(', ')}) AND "trashed_at" IS NULL` : 'WHERE "trashed_at" IS NULL'}
        ORDER BY "created_at" DESC
        `,
        filters,
      ),
    );

    const activeImportJobs = await this.getActiveImportJobs();
    const serializedRows: SerializedImportBatchDetail[] = [];

    for (const row of rows) {
      serializedRows.push(await this.reconcileImportBatch(this.dbRowToRecord(row), activeImportJobs));
    }

    return serializedRows;
  }

  async countImports(status?: string) {
    await this.ensureImportsTable();

    const filters = (status || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is ImportStatusFilter =>
        ['queued', 'processing', 'completed', 'completed_with_errors', 'error', 'created'].includes(value),
      );

    const rows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
      this.interpolateSql(
        `
        SELECT COUNT(*) AS total
        FROM "imports"
        ${filters.length ? `WHERE "status" IN (${filters.map(() => '?').join(', ')}) AND "trashed_at" IS NULL` : 'WHERE "trashed_at" IS NULL'}
        `,
        filters,
      ),
    );

    return { total: Number(rows[0]?.total || 0) };
  }

  async createImport(urls: string[], sourceFile = 'manual'): Promise<SerializedImportBatchDetail | SkippedImportCreationResult> {
    await this.ensureImportsTable();
    const normalizedUrls = [...new Set(
      urls
        .map((value) => cleanUrl(String(value || '')))
        .filter(Boolean)
        .map((value) => {
          try {
            return normalizeSiteUrl(value);
          } catch {
            return null;
          }
        })
      .filter((value): value is string => Boolean(value)),
    )];

    if (normalizedUrls.length === 0) {
      throw new BadRequestException('Aucune URL exploitable n’a été fournie.');
    }

    const urlIds: number[] = [];
    const existingUrlIds: number[] = [];
    const newUrlIds: number[] = [];
    let existingUrls = 0;
    for (const url of normalizedUrls) {
      const result = await this.urlsService.insertSingleUrl(url, sourceFile);
      urlIds.push(result.site.id);
      if (!result.created) {
        existingUrls += 1;
        existingUrlIds.push(result.site.id);
      } else {
        newUrlIds.push(result.site.id);
      }
    }

    const sites = await this.urlsService.getSitesByIds(urlIds);
    const queuedUrlIds = await this.getQueuedImportUrlIds();
    const analyzableSites = sites.filter((site) => !this.isAnalyzedSite(site) && !queuedUrlIds.has(site.id));

    if (analyzableSites.length === 0) {
      return {
        skipped: true,
        reason: 'all_urls_already_scanned',
        message: 'Toutes les URLs sont déjà scannées ou déjà présentes dans la queue. Rien à mettre en file.',
        sourceFile,
        totalUrls: urlIds.length,
        existingUrls,
        urlIds,
        existingUrlIds,
        newUrlIds,
      };
    }

    const analyzableUrlIds = analyzableSites.map((site) => site.id);
    const analyzableUrlSet = new Set(analyzableUrlIds);
    const filteredUrls = normalizedUrls.filter((_, index) => analyzableUrlSet.has(urlIds[index]));
    const filteredUrlIds = urlIds.filter((urlId) => analyzableUrlSet.has(urlId));
    const filteredExistingUrlIds = existingUrlIds.filter((urlId) => analyzableUrlSet.has(urlId));
    const filteredNewUrlIds = newUrlIds.filter((urlId) => analyzableUrlSet.has(urlId));
    const filteredExistingUrls = filteredExistingUrlIds.length;

    const [inserted] = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      this.interpolateSql(
        'INSERT INTO "imports" ("source_file", "urls_json", "url_ids_json", "existing_url_ids_json", "new_url_ids_json", "total_urls", "existing_urls", "queued_urls", "processed_urls", "failed_urls", "status", "current_step", "queued_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING "id"',
        [
          sourceFile,
          JSON.stringify(filteredUrls),
          JSON.stringify(filteredUrlIds),
          JSON.stringify(filteredExistingUrlIds),
          JSON.stringify(filteredNewUrlIds),
          filteredUrlIds.length,
          filteredExistingUrls,
          filteredNewUrlIds.length,
          0,
          0,
          'queued',
          'queued',
        ],
      ),
    );
    const batchId = Number(inserted?.id || 0);

    if (!batchId) {
      throw new BadRequestException("Impossible de créer l'import.");
    }

    await this.scheduleImportAnalysis(batchId, filteredUrlIds);

    return this.getImport(batchId);
  }

  async listTrashedImports() {
    await this.ensureImportsTable();

    const rows = await (this.prisma as any).importBatch.findMany({
      where: {
        trashedAt: { not: null },
      },
      orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        sourceFile: true,
        totalUrls: true,
        existingUrls: true,
        queuedUrls: true,
        processedUrls: true,
        failedUrls: true,
        status: true,
        currentStep: true,
        queuedAt: true,
        startedAt: true,
        finishedAt: true,
        trashedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      sourceFile: row.sourceFile,
      totalUrls: row.totalUrls,
      existingUrls: row.existingUrls,
      queuedUrls: row.queuedUrls,
      processedUrls: row.processedUrls,
      failedUrls: row.failedUrls,
      status: row.status,
      currentStep: row.currentStep,
      queuedAt: row.queuedAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      trashedAt: row.trashedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async trashImport(id: number) {
    await this.ensureImportsTable();
    const batch = await this.getImport(id);

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${id}`);
    }

    if (batch.status === 'queued' || batch.status === 'processing') {
      throw new BadRequestException('Impossible de mettre un import en cours à la corbeille.');
    }

    await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        'UPDATE "imports" SET "trashed_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = ? AND "trashed_at" IS NULL',
        [id],
      ),
    );

    return this.getImport(id);
  }

  async deleteTrashedImport(id: number) {
    await this.ensureImportsTable();
    const result = await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        'DELETE FROM "imports" WHERE "id" = ? AND "trashed_at" IS NOT NULL',
        [id],
      ),
    );

    return { deleted: Number(result || 0) > 0 ? 1 : 0 };
  }

  async emptyTrash() {
    await this.ensureImportsTable();
    const result = await this.prisma.$executeRawUnsafe('DELETE FROM "imports" WHERE "trashed_at" IS NOT NULL');

    return { deleted: Number(result || 0) || 0 };
  }

  private async scheduleImportAnalysis(batchId: number, urlIds: number[]) {
    const sites = await this.urlsService.getSitesByIds(urlIds);
    const analyzableSites = sites.filter((site) => !this.isAnalyzedSite(site));
    const analyzableUrlIds = analyzableSites.map((site) => site.id);
    if (analyzableUrlIds.length === 0) {
      await this.prisma.$executeRawUnsafe(
        this.interpolateSql(
          `
            UPDATE "imports"
            SET
              "status" = 'completed',
              "current_step" = 'completed',
              "queued_urls" = 0,
              "processed_urls" = 0,
              "failed_urls" = 0,
              "last_error" = NULL,
              "finished_at" = CURRENT_TIMESTAMP,
              "completed_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
            WHERE "id" = ?
          `,
          [batchId],
        ),
      );
      return;
    }

    await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        `
          UPDATE "imports"
          SET
            "status" = 'queued',
            "current_step" = 'queued',
            "queued_urls" = ?,
            "processed_urls" = 0,
            "failed_urls" = 0,
            "queued_at" = CURRENT_TIMESTAMP,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        [analyzableUrlIds.length, batchId],
      ),
    );

    try {
      for (const [position, urlId] of analyzableUrlIds.entries()) {
        await this.importAnalysisQueue.add(
          'analyze-url',
          {
            batchId,
            urlId,
            position: position + 1,
            total: analyzableUrlIds.length,
          },
          {
            jobId: `import-${batchId}-url-${urlId}`,
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 1,
          },
        );
      }
    } catch (error) {
      await this.markImportError(batchId, error);
      throw error;
    }
  }

  private async updateImportCounters(
    batchId: number,
    patch: Partial<Pick<ImportBatchRecord, 'status' | 'currentStep' | 'currentUrlId' | 'processedUrls' | 'failedUrls' | 'startedAt' | 'finishedAt' | 'lastError'>>,
  ) {
    const batch = await this.getImport(batchId);
    const nextStatus = patch.status ?? batch.status;
    const nextStep = patch.currentStep ?? batch.currentStep;
    const currentUrlId = patch.currentUrlId ?? batch.currentUrlId;
    const processedUrls = patch.processedUrls ?? batch.processedUrls;
    const failedUrls = patch.failedUrls ?? batch.failedUrls;
    const startedAt = patch.startedAt ?? batch.startedAt;
    const finishedAt = patch.finishedAt ?? batch.finishedAt;
    const lastError = patch.lastError ?? batch.lastError;

    await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        `
          UPDATE "imports"
          SET
            "status" = ?,
            "current_step" = ?,
            "current_url_id" = ?,
            "processed_urls" = ?,
            "failed_urls" = ?,
            "started_at" = ?,
            "finished_at" = ?,
            "last_error" = ?,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        [
          nextStatus,
          nextStep,
          currentUrlId,
          processedUrls,
          failedUrls,
          startedAt ? new Date(startedAt).toISOString() : null,
          finishedAt ? new Date(finishedAt).toISOString() : null,
          lastError,
          batchId,
        ],
      ),
    );

    return this.getImport(batchId);
  }

  private async markImportError(batchId: number, error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    this.logger.error(`Import #${batchId} en erreur`, error instanceof Error ? error.stack : undefined);

    return this.updateImportCounters(batchId, {
      status: 'error',
      currentStep: 'error',
      currentUrlId: null,
      lastError: message,
      finishedAt: new Date(),
    });
  }

  async rescanImportUrls(batchId: number, urlIds: number[]) {
    await this.ensureImportsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql('SELECT * FROM "imports" WHERE "id" = ? LIMIT 1', [batchId]),
    );
    const batch = rows[0];

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${batchId}`);
    }

    const record = this.dbRowToRecord(batch);
    if (['queued', 'processing'].includes(record.status)) {
      throw new BadRequestException('Impossible de rescanner un import en cours.');
    }

    const importUrlIds = new Set(
      this.parseJsonList(record.urlIdsJson)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    );
    const importUrlIdList = this.parseJsonList(record.urlIdsJson)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const importUrls = this.parseJsonList(record.urlsJson).map((value) => String(value || ''));

    const selectedIds = [...new Set(
      (urlIds || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
        .filter((value) => importUrlIds.has(value)),
    )];

    if (selectedIds.length === 0) {
      throw new BadRequestException('Sélection vide ou URLs invalides.');
    }

    const sites = await this.urlsService.getSitesByIds(selectedIds);
    const sitesById = new Map(sites.map((site) => [Number(site.id), site]));
    const results: Array<{
      id: number;
      url: string;
      processed: boolean;
      reason?: string;
    }> = [];

    await this.urlsService.markRescanRequested(selectedIds);
    await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        `
          UPDATE "imports"
          SET
            "status" = 'processing',
            "current_step" = 'Rescan en cours',
            "current_url_id" = NULL,
            "finished_at" = NULL,
            "completed_at" = NULL,
            "last_error" = NULL,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        [batchId],
      ),
    );

    for (const id of selectedIds) {
      const site = sitesById.get(id);
      const urlIndex = importUrlIdList.indexOf(id);
      if (!site) {
        results.push({
          id,
          url: urlIndex >= 0 ? (importUrls[urlIndex] || '') : '',
          processed: false,
          reason: 'url_not_found',
        });
        continue;
      }

      try {
        await this.importAnalysisQueue.add(
          'analyze-url',
          {
            batchId,
            urlId: site.id,
            position: results.length + 1,
            total: selectedIds.length,
            rescan: true,
          },
          {
            jobId: `rescan-import-${batchId}-url-${site.id}`,
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 1,
          },
        );
        results.push({
          id: site.id,
          url: site.url,
          processed: true,
        });
      } catch (error) {
        await this.urlsService.clearRescanRequested(site.id);
        results.push({
          id: site.id,
          url: site.url,
          processed: false,
          reason: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    return {
      scanned: results.filter((result) => result.processed).length,
      results,
    };
  }

  async processRescanQueuedUrl(job: ImportAnalysisJobData) {
    await this.ensureImportsTable();
    const site = (await this.urlsService.getSitesByIds([job.urlId]))[0];

    if (!site) {
      await this.urlsService.clearRescanRequested(job.urlId);
      this.logger.warn(`Rescan: URL #${job.urlId} introuvable.`);
      return {
        urlId: job.urlId,
        processed: false,
        reason: 'url_not_found',
      };
    }

    try {
      await this.scanningService.rescanSite(site.id, { force: true });
      await this.urlsService.clearRescanRequested(site.id);

      this.logger.log(`URL #${job.urlId} rescannée via la queue.`);

      return {
        urlId: job.urlId,
        processed: true,
      };
    } catch (error) {
      this.logger.error(
        `Échec du rescan de l'URL #${job.urlId}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        urlId: job.urlId,
        processed: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
      };
    }
  }

  async processQueuedImportUrl(job: ImportAnalysisJobData) {
    await this.ensureImportsTable();
    const batch = await this.getImport(job.batchId);
    const site = (await this.urlsService.getSitesByIds([job.urlId]))[0];

    if (!site) {
      const missingImport = await this.updateImportCounters(job.batchId, {
        status: 'processing',
        currentStep: `URL ${job.position}/${job.total} introuvable`,
        failedUrls: batch.failedUrls + 1,
        startedAt: batch.startedAt ?? new Date(),
      });
      await this.emitImportEvent('import.url.failed', job.batchId, {
        urlId: job.urlId,
        reason: 'url_not_found',
      });

      return {
        batchId: job.batchId,
        urlId: job.urlId,
        processed: false,
        reason: 'url_not_found',
      };
    }

    const startedImport = await this.updateImportCounters(job.batchId, {
      status: 'processing',
      currentStep: `Analyse ${job.position}/${job.total}`,
      currentUrlId: job.urlId,
      startedAt: batch.startedAt ?? new Date(),
    });
    await this.emitImportEvent('import.url.started', job.batchId, {
      urlId: job.urlId,
    });

    try {
      await this.scanningService.rescanSite(site.id, { force: true });

      const nextProcessedUrls = batch.processedUrls + 1;
      const nextFailedUrls = batch.failedUrls;
      const finished = nextProcessedUrls + nextFailedUrls >= batch.queuedUrls;

      const completedImport = await this.updateImportCounters(job.batchId, {
        status: finished ? nextFailedUrls > 0 ? 'completed_with_errors' : 'completed' : 'processing',
        currentStep: finished ? 'completed' : `Analyse ${Math.min(job.position + 1, job.total)}/${job.total}`,
        currentUrlId: null,
        processedUrls: nextProcessedUrls,
        failedUrls: nextFailedUrls,
        finishedAt: finished ? new Date() : null,
      });
      await this.emitImportEvent(finished ? 'import.completed' : 'import.url.completed', job.batchId, {
        urlId: job.urlId,
      });

      this.logger.log(
        `URL #${job.urlId} analysee pour l'import #${job.batchId} (${job.position}/${job.total}).`,
      );

      return {
        batchId: job.batchId,
        urlId: job.urlId,
        processed: true,
      };
    } catch (error) {
      const nextFailedUrls = batch.failedUrls + 1;
      const finished = batch.processedUrls + nextFailedUrls >= batch.queuedUrls;
      const failedImport = await this.updateImportCounters(job.batchId, {
        status: finished ? 'completed_with_errors' : 'processing',
        currentStep: finished ? 'completed_with_errors' : `Analyse ${Math.min(job.position + 1, job.total)}/${job.total}`,
        currentUrlId: null,
        processedUrls: batch.processedUrls,
        failedUrls: nextFailedUrls,
        lastError: error instanceof Error ? error.message : 'Erreur inconnue',
        startedAt: batch.startedAt ?? new Date(),
        finishedAt: finished ? new Date() : null,
      });
      await this.emitImportEvent(finished ? 'import.completed' : 'import.url.failed', job.batchId, {
        urlId: job.urlId,
        reason: error instanceof Error ? error.message : 'unknown_error',
      });

      this.logger.error(
        `Échec de l'analyse de l'URL #${job.urlId} dans l'import #${job.batchId}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        batchId: job.batchId,
        urlId: job.urlId,
        processed: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
      };
    }
  }

  private async loadSites(batchId: number, force = false) {
    await this.ensureImportsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      this.interpolateSql('SELECT * FROM "imports" WHERE "id" = ? LIMIT 1', [batchId]),
    );
    const batch = rows[0];

    if (!batch) {
      throw new NotFoundException(`Import introuvable: ${batchId}`);
    }

    const record = this.dbRowToRecord(batch);
    const siteIds = this.parseJsonList(record.urlIdsJson).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
    const sites = await this.urlsService.getSitesByIds(siteIds);
    const existingSiteIds = new Set(this.parseJsonList(record.existingUrlIdsJson).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0));
    const newSiteIds = new Set(this.parseJsonList(record.newUrlIdsJson).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0));

    return {
      batch: record,
      sites,
      existingSiteIds,
      newSiteIds,
      force,
    };
  }

  private async setStepState(batchId: number, patch: Partial<Pick<ImportBatchRecord, 'status' | 'currentStep' | 'shopifyDoneAt' | 'contactDoneAt' | 'linkedinDoneAt' | 'technicalDoneAt' | 'lighthouseDoneAt' | 'completedAt'>>) {
    await this.ensureImportsTable();

    const batch = await this.getImport(batchId);
    const nextStatus = patch.status ?? batch.status;
    const nextStep = patch.currentStep ?? batch.currentStep;
    const shopifyDoneAt = patch.shopifyDoneAt ?? batch.shopifyDoneAt;
    const contactDoneAt = patch.contactDoneAt ?? batch.contactDoneAt;
    const linkedinDoneAt = patch.linkedinDoneAt ?? batch.linkedinDoneAt;
    const technicalDoneAt = patch.technicalDoneAt ?? batch.technicalDoneAt;
    const lighthouseDoneAt = patch.lighthouseDoneAt ?? batch.lighthouseDoneAt;
    const completedAt = patch.completedAt ?? batch.completedAt;

    await this.prisma.$executeRawUnsafe(
      this.interpolateSql(
        `
          UPDATE "imports"
          SET
            "status" = ?,
            "current_step" = ?,
            "shopify_done_at" = ?,
            "contact_done_at" = ?,
            "linkedin_done_at" = ?,
            "technical_done_at" = ?,
            "lighthouse_done_at" = ?,
            "completed_at" = ?,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ?
        `,
        [
          nextStatus,
          nextStep,
          shopifyDoneAt ? new Date(shopifyDoneAt).toISOString() : null,
          contactDoneAt ? new Date(contactDoneAt).toISOString() : null,
          linkedinDoneAt ? new Date(linkedinDoneAt).toISOString() : null,
          technicalDoneAt ? new Date(technicalDoneAt).toISOString() : null,
          lighthouseDoneAt ? new Date(lighthouseDoneAt).toISOString() : null,
          completedAt ? new Date(completedAt).toISOString() : null,
          batchId,
        ],
      ),
    );

    return this.getImport(batchId);
  }

  async runShopifyStep(batchId: number, options: { timeoutMs?: number; force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const scanSteps = await this.siteSettingsService.getScanSteps();
    const enabledScanSteps = new Set(
      scanSteps.steps.filter((step) => step.enabled).map((step) => step.key),
    );
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const scopeTotal = selectedSites.length;
    const eligibleSites = options.force ? selectedSites : selectedSites.filter((site) => !site.shopifyCheckedAt);
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
      const result = await this.scanningService.inspectShopifySite(site.url, options);
      await this.urlsService.updateShopifyResult(site.id, {
        httpStatus: result.httpStatus,
        shopifyStatus: result.shopifyStatus,
        siteName: result.siteName,
        cmsName: result.cmsName,
        siteCountryCode: result.siteCountryCode,
        siteCountryName: result.siteCountryName,
        shopifyThemeName: null,
        shopifyThemeId: null,
        shopifyThemeSchemaName: null,
        shopifyThemeJson: null,
        redesignStatus: result.redesignStatus,
        ttfbMs: result.ttfbMs,
        totalMs: result.totalMs,
        htmlBytes: result.htmlBytes,
      }, { writeMode: 'clear' });

      if (enabledScanSteps.has('cms_detection') && result.shopifyStatus !== 'shopify') {
        const cmsDetection = await this.scanningService.inspectCmsDetectionSite(site.url, options);
        await this.urlsService.updateCmsResult(
          site.id,
          cmsDetection.cmsName,
          { writeMode: 'clear' },
        );
      }

      const language = await this.scanningService.inspectSiteLanguage(site.url, options);
      await this.urlsService.updateSiteLanguageResult(
        site.id,
        {
          siteLanguageCode: language.siteLanguageCode,
          siteLanguageName: language.siteLanguageName,
        },
        { writeMode: 'clear' },
      );

      if (enabledScanSteps.has('legal_notice') && result.shopifyStatus === 'shopify') {
        const legalNotice = await this.scanningService.inspectShopifyLegalNoticeSite(site.url, options);
        await this.urlsService.updateShopifyLegalNoticeStatus(site.id, {
          shopifyLegalNoticeStatus: legalNotice.shopifyLegalNoticeStatus,
        }, { writeMode: 'clear' });
      }
      processed += 1;
      if (result.shopifyStatus === 'shopify') {
        matched += 1;
      }
    }

    await this.setStepState(batch.id, {
      status: 'processing',
      currentStep: 'contact',
      shopifyDoneAt: new Date(),
    });

    return {
      step: 'shopify' as ImportStepName,
      processed,
      matched,
      total: scopeTotal,
    };
  }

  async runContactStep(batchId: number, options: { timeoutMs?: number; force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const scopeTotal = selectedSites.length;
    const eligibleSites = (options.force ? selectedSites : selectedSites.filter((site) => !site.contactCheckedAt))
      .filter((site) => options.force || site.shopifyStatus === 'shopify');
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
      const contactResult = await this.contactsService.findOneContact(
        {
          id: site.id,
          url: site.url,
          siteName: site.siteName,
          siren: site.contactSiren,
          companyName: site.contactCompanyName,
          firstName: site.contactFirstName,
          lastName: site.contactLastName,
          ownerName: site.contactOwnerName,
        },
        {
          timeoutMs: options.timeoutMs,
          includeLinkedin: false,
          preferLegalNoticeFirst: site.shopifyStatus === 'shopify',
        },
      );

      if (contactResult.status === 'found') {
        await this.urlsService.updateContactResult(site.id, contactResult, { writeMode: 'clear' });
      } else {
        await this.urlsService.clearContactResult(site.id);
      }

      processed += 1;
      if (contactResult.status === 'found') {
        matched += 1;
      }
    }

    await this.setStepState(batch.id, {
      status: 'processing',
      currentStep: 'linkedin',
      contactDoneAt: new Date(),
    });

    return {
      step: 'contact' as ImportStepName,
      processed,
      matched,
      total: scopeTotal,
    };
  }

  private buildContactResultFromSite(site: ImportedUrlRow, linkedinUrl: string | null): Omit<ContactResult, 'status'> {
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
      socialLinks: this.parseJsonList(site.contactSocialLinksJson),
    };
  }

  async runLinkedinStep(batchId: number, options: { timeoutMs?: number; force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const scopeTotal = selectedSites.length;
    const eligibleSites = (options.force ? selectedSites : selectedSites.filter((site) => !site.contactLinkedinUrl))
      .filter((site) => site.contactStatus === 'found');
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
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
          socialLinks: this.parseJsonList(site.contactSocialLinksJson),
          sourceUrl: site.contactSourceUrl,
          evidence: site.contactEvidence,
        },
        { timeoutMs: options.timeoutMs },
      );

      const resolvedLinkedinUrl = linkedinUrl || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl || null;
      processed += 1;

      if (!resolvedLinkedinUrl) {
        continue;
      }

      const contactResult = this.buildContactResultFromSite(site, resolvedLinkedinUrl);
      await this.urlsService.updateContactResult(site.id, {
        ...contactResult,
        status: 'found',
      }, { writeMode: 'clear' });

      matched += 1;
    }

    await this.setStepState(batch.id, {
      status: 'processing',
      currentStep: 'technical',
      linkedinDoneAt: new Date(),
    });

    return {
      step: 'linkedin' as ImportStepName,
      processed,
      matched,
      total: scopeTotal,
    };
  }

  async runSocialStep(batchId: number, options: { force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const eligibleSites = selectedSites.filter((site) => (site.contactSocialLinksJson || '').trim().length > 2 || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl);
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
      processed += 1;
      if ((site.contactSocialLinksJson || '').trim().length > 2 || site.contactLinkedinUrl || site.contactCompanyLinkedinUrl) {
        matched += 1;
      }
    }

    await this.setStepState(batch.id, {
      status: 'processing',
      currentStep: 'technical',
      linkedinDoneAt: batch.linkedinDoneAt,
    });

    return {
      step: 'social' as ImportStepName,
      processed,
      matched,
      total: selectedSites.length,
    };
  }

  async runTechnicalStep(batchId: number, options: { timeoutMs?: number; force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const scopeTotal = selectedSites.length;
    const eligibleSites = (options.force ? selectedSites : selectedSites.filter((site) => !site.shopifyThemeJson))
      .filter((site) => site.shopifyStatus === 'shopify');
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
      const technical = await this.scanningService.inspectShopifyTechnical(site.url, options);

      await this.urlsService.updateShopifyResult(site.id, {
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
      }, { writeMode: 'clear' });

      processed += 1;
      if (technical.shopifyThemeJson || technical.shopifyThemeName || technical.shopifyThemeId) {
        matched += 1;
      }
    }

    await this.setStepState(batch.id, {
      status: 'completed',
      currentStep: 'lighthouse',
      technicalDoneAt: new Date(),
    });

    return {
      step: 'technical' as ImportStepName,
      processed,
      matched,
      total: scopeTotal,
    };
  }

  async runLighthouseStep(batchId: number, options: { timeoutMs?: number; force?: boolean; scope?: ImportScanScope } = {}) {
    const { batch, sites, existingSiteIds, newSiteIds } = await this.loadSites(batchId, options.force);
    const selectedSites = options.force
      ? (options.scope === 'existing'
        ? sites.filter((site) => existingSiteIds.has(site.id))
        : options.scope === 'new'
          ? sites.filter((site) => newSiteIds.has(site.id))
          : sites)
      : sites.filter((site) => newSiteIds.has(site.id));
    const scopeTotal = selectedSites.length;
    const eligibleSites = (options.force ? selectedSites : selectedSites.filter((site) => !site.lighthouseCheckedAt))
      .filter((site) => this.scanningService.shouldRunLighthouse(site));
    let processed = 0;
    let matched = 0;

    for (const site of eligibleSites) {
      const lighthouse = await this.scanningService.inspectLighthouseSite(site.url, options);
      await this.urlsService.updateLighthouseResult(site.id, lighthouse, { writeMode: 'clear' });

      processed += 1;
      if (lighthouse.lighthouseScore !== null) {
        matched += 1;
      }
    }

    await this.setStepState(batch.id, {
      status: 'completed',
      currentStep: 'completed',
      lighthouseDoneAt: new Date(),
      completedAt: new Date(),
    });

    return {
      step: 'lighthouse' as ImportStepName,
      processed,
      matched,
      total: scopeTotal,
    };
  }
}

