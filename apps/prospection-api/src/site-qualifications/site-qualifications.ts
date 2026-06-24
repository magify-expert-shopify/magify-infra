import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTableColumnNames } from 'src/database/sqlite-schema';

export type SiteObservationSeverity = 'info' | 'warning' | 'critical';
export type SiteObservationSource = 'manual' | 'automatic';

export type SiteQualificationChecklistKey =
  | 'legalNotice'
  | 'legalNoticeStatus'
  | 'dawnTheme'
  | 'dawnThemeStatus'
  | 'visualAnomaly'
  | 'visualAnomalyStatus'
  | 'collectionVisualAnomaly'
  | 'collectionVisualAnomalyStatus'
  | 'productVisualAnomaly'
  | 'productVisualAnomalyStatus'
  | 'aboutVisualAnomaly'
  | 'aboutVisualAnomalyStatus'
  | 'translated'
  | 'translatedStatus';

export type SiteQualificationLegalNoticeStatus = 'missing' | 'invalid' | 'valid' | null;
export type SiteQualificationChecklistStatus = 'valid' | 'invalid' | null;

export type SiteQualificationChecklist = {
  legalNotice: boolean;
  legalNoticeStatus: SiteQualificationLegalNoticeStatus;
  dawnTheme: boolean;
  dawnThemeStatus: SiteQualificationChecklistStatus;
  visualAnomaly: boolean;
  visualAnomalyStatus: SiteQualificationChecklistStatus;
  collectionVisualAnomaly: boolean;
  collectionVisualAnomalyStatus: SiteQualificationChecklistStatus;
  productVisualAnomaly: boolean;
  productVisualAnomalyStatus: SiteQualificationChecklistStatus;
  aboutVisualAnomaly: boolean;
  aboutVisualAnomalyStatus: SiteQualificationChecklistStatus;
  translated: boolean;
  translatedStatus: SiteQualificationChecklistStatus;
};

export type SiteQualificationPositioning =
  | 'support-with-error'
  | 'support-without-observation'
  | 'refonte'
  | 'migration'
  | 'optimisation'
  | 'abandon';

export type SiteObservation = {
  key: string;
  title: string;
  detail: string;
  severity: SiteObservationSeverity;
  isMain: boolean;
  source?: SiteObservationSource;
};

export type SiteQualification = {
  positioning: SiteQualificationPositioning | null;
  abandonReason: string | null;
  mainObservationKey: string | null;
  mainObservation: SiteObservation | null;
  observations: SiteObservation[];
  verificationChecklist: SiteQualificationChecklist;
};

export const SITE_QUALIFICATION_POSITIONINGS: SiteQualificationPositioning[] = [
  'support-with-error',
  'support-without-observation',
  'refonte',
  'migration',
  'optimisation',
  'abandon',
];

let siteQualificationTablesReady = false;

const AUTOMATIC_OBSERVATION_KEYS = new Set([
  'shopify-legal-notice',
  'shopify-legal-notice-missing',
  'legal-notice-checklist',
  'seo-meta-tags',
  'contact-placeholder-email',
  'dawn-theme-checklist',
  'translated-checklist',
  'visual-anomaly-home-checklist',
  'visual-anomaly-collection-checklist',
  'visual-anomaly-product-checklist',
  'visual-anomaly-about-checklist',
  'catalog-gift-card',
]);

function normalizePositioning(value: unknown): SiteQualificationPositioning | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'support-with-error') return 'support-with-error';
  if (normalized === 'support-without-observation') return 'support-without-observation';
  if (normalized === 'refonte') return 'refonte';
  if (normalized === 'migration') return 'migration';
  if (normalized === 'optimisation' || normalized === 'optimization') return 'optimisation';
  if (normalized === 'abandon') return 'abandon';
  return null;
}

function normalizeSeverity(value: unknown): SiteObservationSeverity {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'warning';
  return 'info';
}

function normalizeObservationSource(value: unknown, key: string): SiteObservationSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'automatic' || normalized === 'auto') return 'automatic';
  if (normalized === 'manual') return 'manual';
  return AUTOMATIC_OBSERVATION_KEYS.has(String(key || '').trim()) ? 'automatic' : 'manual';
}

function normalizeChecklist(value: unknown): SiteQualificationChecklist {
  const raw = value && typeof value === 'object' ? value as Partial<SiteQualificationChecklist> : {};
  const legalNoticeStatus = String(raw.legalNoticeStatus || '').toLowerCase();
  const dawnThemeStatus = String(raw.dawnThemeStatus || '').toLowerCase();
  const visualAnomalyStatus = String(raw.visualAnomalyStatus || '').toLowerCase();
  const collectionVisualAnomalyStatus = String(raw.collectionVisualAnomalyStatus || '').toLowerCase();
  const productVisualAnomalyStatus = String(raw.productVisualAnomalyStatus || '').toLowerCase();
  const aboutVisualAnomalyStatus = String(raw.aboutVisualAnomalyStatus || '').toLowerCase();
  const translatedStatus = String(raw.translatedStatus || '').toLowerCase();

  return {
    legalNotice: Boolean(raw.legalNotice || raw.legalNoticeStatus),
    legalNoticeStatus:
      legalNoticeStatus === 'missing' || legalNoticeStatus === 'invalid' || legalNoticeStatus === 'valid'
        ? (legalNoticeStatus as SiteQualificationLegalNoticeStatus)
        : null,
    dawnTheme: Boolean(raw.dawnTheme || raw.dawnThemeStatus),
    dawnThemeStatus:
      dawnThemeStatus === 'valid' || dawnThemeStatus === 'invalid'
        ? (dawnThemeStatus as SiteQualificationChecklistStatus)
        : null,
    visualAnomaly: Boolean(raw.visualAnomaly || raw.visualAnomalyStatus),
    visualAnomalyStatus:
      visualAnomalyStatus === 'valid' || visualAnomalyStatus === 'invalid'
        ? (visualAnomalyStatus as SiteQualificationChecklistStatus)
        : null,
    collectionVisualAnomaly: Boolean(raw.collectionVisualAnomaly || raw.collectionVisualAnomalyStatus),
    collectionVisualAnomalyStatus:
      collectionVisualAnomalyStatus === 'valid' || collectionVisualAnomalyStatus === 'invalid'
        ? (collectionVisualAnomalyStatus as SiteQualificationChecklistStatus)
        : null,
    productVisualAnomaly: Boolean(raw.productVisualAnomaly || raw.productVisualAnomalyStatus),
    productVisualAnomalyStatus:
      productVisualAnomalyStatus === 'valid' || productVisualAnomalyStatus === 'invalid'
        ? (productVisualAnomalyStatus as SiteQualificationChecklistStatus)
        : null,
    aboutVisualAnomaly: Boolean(raw.aboutVisualAnomaly || raw.aboutVisualAnomalyStatus),
    aboutVisualAnomalyStatus:
      aboutVisualAnomalyStatus === 'valid' || aboutVisualAnomalyStatus === 'invalid'
        ? (aboutVisualAnomalyStatus as SiteQualificationChecklistStatus)
        : null,
    translated: Boolean(raw.translated || raw.translatedStatus),
    translatedStatus:
      translatedStatus === 'valid' || translatedStatus === 'invalid'
        ? (translatedStatus as SiteQualificationChecklistStatus)
        : null,
  };
}

function normalizeObservation(value: any, index: number): SiteObservation {
  const key = String(value?.key || value?.observationKey || value?.clientKey || '').trim() || randomUUID();
  const title = String(value?.title || value?.name || '').trim();
  const detail = String(value?.detail || value?.explanation || '').trim();

  if (!title && !detail) {
    throw new BadRequestException('Chaque observation doit avoir un titre ou un détail.');
  }

  return {
    key,
    title: title || detail || `Observation ${index + 1}`,
    detail: detail || title || 'Observation sans détail.',
    severity: normalizeSeverity(value?.severity),
    isMain: Boolean(value?.isMain),
    source: normalizeObservationSource(value?.source, key),
  };
}

export async function ensureSiteQualificationTables(prisma: PrismaService) {
  if (siteQualificationTablesReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "site_qualifications" (
      "id" SERIAL PRIMARY KEY,
      "url_id" INTEGER NOT NULL UNIQUE,
      "positioning" TEXT,
      "abandon_reason" TEXT,
      "main_observation_key" TEXT,
      "verification_checklist_json" TEXT,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "site_observations" (
      "id" SERIAL PRIMARY KEY,
      "url_id" INTEGER NOT NULL,
      "observation_key" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "detail" TEXT NOT NULL,
      "severity" TEXT NOT NULL DEFAULT 'info',
      "source" TEXT NOT NULL DEFAULT 'manual',
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "site_observations_url_key_unique" ON "site_observations" ("url_id", "observation_key")',
  );

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "site_observations_url_id_idx" ON "site_observations" ("url_id")',
  );

  const qualificationColumns = await getTableColumnNames(prisma, 'site_qualifications');

  if (!qualificationColumns.includes('verification_checklist_json')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "site_qualifications" ADD COLUMN "verification_checklist_json" TEXT',
    );
  }

  const observationColumns = await getTableColumnNames(prisma, 'site_observations');

  if (!observationColumns.includes('source')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "site_observations" ADD COLUMN "source" TEXT NOT NULL DEFAULT \'manual\'',
    );
  }

  siteQualificationTablesReady = true;
}

export async function loadSiteQualification(prisma: PrismaService, urlId: number): Promise<SiteQualification | null> {
  await ensureSiteQualificationTables(prisma);

  const [qualificationRows, observationRows] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT "positioning", "abandon_reason", "main_observation_key", "verification_checklist_json"
      FROM "site_qualifications"
      WHERE "url_id" = ${urlId}
      LIMIT 1
    `,
    prisma.$queryRaw<any[]>`
      SELECT "observation_key", "title", "detail", "severity", "source"
      FROM "site_observations"
      WHERE "url_id" = ${urlId}
      ORDER BY "id" ASC
    `,
  ]);

  const qualification = qualificationRows[0] || null;
  const observations = observationRows.map((row) => ({
    key: String(row.observation_key),
    title: String(row.title || ''),
    detail: String(row.detail || ''),
    severity: normalizeSeverity(row.severity),
    isMain: false,
    source: normalizeObservationSource(row.source, row.observation_key),
  }));

  if (!qualification && observations.length === 0) {
    return null;
  }

  const mainObservationKey = qualification?.main_observation_key == null
    ? null
    : String(qualification.main_observation_key);

  const mainObservation =
    (mainObservationKey
      ? observations.find((item) => item.key === mainObservationKey)
      : null) ||
    observations[0] ||
    null;

  const normalizedObservations = observations.map((item) => ({
    ...item,
    isMain: mainObservation ? item.key === mainObservation.key : false,
  }));
  const normalizedMainObservation =
    mainObservation
      ? normalizedObservations.find((item) => item.key === mainObservation.key) || mainObservation
      : null;

  return {
    positioning: normalizePositioning(qualification?.positioning),
    abandonReason: qualification?.abandon_reason == null ? null : String(qualification.abandon_reason),
    mainObservationKey,
    mainObservation: normalizedMainObservation,
    observations: normalizedObservations,
    verificationChecklist: normalizeChecklist(
      (() => {
        try {
          return JSON.parse(String(qualification?.verification_checklist_json || '{}'));
        } catch {
          return {};
        }
      })(),
    ),
  };
}

export async function upsertSiteObservation(
  prisma: PrismaService,
  urlId: number,
  observation: Partial<SiteObservation> & { key: string },
) {
  await ensureSiteQualificationTables(prisma);

  const normalized = normalizeObservation(observation, 0);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "site_observations" ("url_id", "observation_key", "title", "detail", "severity", "source", "created_at", "updated_at")
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("url_id", "observation_key") DO UPDATE SET
      "title" = EXCLUDED."title",
      "detail" = EXCLUDED."detail",
      "severity" = EXCLUDED."severity",
      "source" = EXCLUDED."source",
      "updated_at" = CURRENT_TIMESTAMP
    `,
    urlId,
    normalized.key,
    normalized.title,
    normalized.detail,
    normalizeSeverity(normalized.severity),
    normalizeObservationSource((normalized as any).source, normalized.key),
  );

  return loadSiteQualification(prisma, urlId);
}

export async function removeSiteObservation(prisma: PrismaService, urlId: number, observationKey: string) {
  await ensureSiteQualificationTables(prisma);

  await prisma.$executeRawUnsafe(
    'DELETE FROM "site_observations" WHERE "url_id" = ? AND "observation_key" = ?',
    urlId,
    String(observationKey || '').trim(),
  );

  return loadSiteQualification(prisma, urlId);
}

export type SaveSiteQualificationInput = {
  positioning: SiteQualificationPositioning;
  abandonReason?: string | null;
  mainObservationKey?: string | null;
  observations?: Array<Partial<SiteObservation> & { key?: string; clientKey?: string }>;
  deletedObservationKeys?: string[];
  verificationChecklist?: Partial<SiteQualificationChecklist>;
};

export async function saveSiteQualification(
  prisma: PrismaService,
  urlId: number,
  payload: SaveSiteQualificationInput,
) {
  await ensureSiteQualificationTables(prisma);

  const positioning = normalizePositioning(payload.positioning);
  if (!positioning) {
    throw new BadRequestException('Positionnement invalide.');
  }

  const observations = (Array.isArray(payload.observations) ? payload.observations : [])
    .map((item, index) => normalizeObservation(item, index))
    .filter((item) => item.title.trim().length > 0 || item.detail.trim().length > 0);
  const deletedObservationKeys = new Set(
    (Array.isArray(payload.deletedObservationKeys) ? payload.deletedObservationKeys : [])
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  );

  const abandonReason = payload.abandonReason == null ? null : String(payload.abandonReason).trim() || null;
  const mainObservationKey = payload.mainObservationKey == null ? null : String(payload.mainObservationKey).trim() || null;
  const verificationChecklist = normalizeChecklist(payload.verificationChecklist);
  const redesignDecision = positioning === 'abandon' ? 'rejected' : 'accepted';

  if (positioning === 'abandon' && !abandonReason) {
    throw new BadRequestException('La raison d’abandon est requise.');
  }

  if (positioning === 'support-with-error') {
    if (observations.length === 0) {
      throw new BadRequestException('Ajoute au moins une observation pour un support avec erreur.');
    }

    const effectiveMainKey = mainObservationKey || observations[0]?.key || null;
    if (!effectiveMainKey) {
      throw new BadRequestException('Choisis l’observation principale à mettre en avant.');
    }

    if (!observations.some((item) => item.key === effectiveMainKey)) {
      throw new BadRequestException('L’observation principale doit appartenir à la liste d’observations.');
    }
  }

  const effectiveMainKey =
    mainObservationKey ||
    (positioning === 'support-with-error' ? observations[0]?.key || null : null);

  await prisma.$transaction(async (tx: any) => {
    const existingObservationRows = (await tx.$queryRawUnsafe(
      'SELECT "observation_key", "title", "detail", "severity", "source" FROM "site_observations" WHERE "url_id" = ? ORDER BY "id" ASC',
      urlId,
    )) as Array<{
      observation_key: string;
      title: string;
      detail: string;
      severity: string;
      source: string | null;
    }>;

    const existingManualObservations = existingObservationRows
      .map((row) => normalizeObservation({
        key: row.observation_key,
        title: row.title,
        detail: row.detail,
        severity: row.severity,
        source: row.source,
      }, 0))
      .filter((observation) => observation.source === 'manual');

    const incomingAutomaticObservations = observations.filter((observation) => observation.source === 'automatic');
    const incomingManualObservations = observations.filter((observation) => observation.source !== 'automatic');

    const mergedManualObservations = new Map<string, SiteObservation>();
    for (const observation of existingManualObservations) {
      if (!deletedObservationKeys.has(observation.key)) {
        mergedManualObservations.set(observation.key, observation);
      }
    }
    for (const observation of incomingManualObservations) {
      if (!deletedObservationKeys.has(observation.key)) {
        mergedManualObservations.set(observation.key, observation);
      }
    }

    const nextObservationMap = new Map<string, SiteObservation>();
    for (const observation of mergedManualObservations.values()) {
      nextObservationMap.set(observation.key, observation);
    }
    for (const observation of incomingAutomaticObservations) {
      nextObservationMap.set(observation.key, observation);
    }
    const nextObservations = [...nextObservationMap.values()];

    await tx.$executeRawUnsafe(
      `
      INSERT INTO "site_qualifications" ("url_id", "positioning", "abandon_reason", "main_observation_key", "created_at", "updated_at")
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("url_id") DO UPDATE SET
        "positioning" = EXCLUDED."positioning",
        "abandon_reason" = EXCLUDED."abandon_reason",
        "main_observation_key" = EXCLUDED."main_observation_key",
        "updated_at" = CURRENT_TIMESTAMP
      `,
      urlId,
      positioning,
      abandonReason,
      effectiveMainKey,
    );

    await tx.$executeRawUnsafe(
      `
      UPDATE "site_qualifications"
      SET "verification_checklist_json" = ?,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "url_id" = ?
      `,
      JSON.stringify(verificationChecklist),
      urlId,
    );

    await tx.$executeRawUnsafe(
      'UPDATE "urls" SET "redesign_decision" = ? WHERE "id" = ?',
      redesignDecision,
      urlId,
    );

    await tx.$executeRawUnsafe(
      'DELETE FROM "site_observations" WHERE "url_id" = ?',
      urlId,
    );

    for (const observation of nextObservations) {
      await tx.$executeRawUnsafe(
        `
        INSERT INTO "site_observations" ("url_id", "observation_key", "title", "detail", "severity", "source", "created_at", "updated_at")
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        urlId,
        observation.key || randomUUID(),
        observation.title,
        observation.detail,
        normalizeSeverity(observation.severity),
        normalizeObservationSource((observation as any).source, observation.key || ''),
      );
    }
  });

  return loadSiteQualification(prisma, urlId);
}

