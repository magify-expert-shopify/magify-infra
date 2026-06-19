import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SiteSettingsService } from 'src/site-settings/site-settings.service';
import { ensureProspectEmailSendHistoryTable } from 'src/prospects/prospect-email-history';

export type StatsMetricKey = 'emailsSent' | 'contactsFound' | 'shopifyDetected' | 'urlsImported';
export type StatsDurationMetricKey =
  | 'shopify'
  | 'cmsDetection'
  | 'language'
  | 'seoMeta'
  | 'legalNotice'
  | 'catalog'
  | 'contact'
  | 'linkedin'
  | 'social'
  | 'technical'
  | 'lighthouse'
  | 'workflowTotal';

export type StatsSeriesPoint = {
  date: string;
  label: string;
  value: number;
};

export type StatsMetricSeries = {
  key: StatsMetricKey;
  label: string;
  description: string;
  total: number;
  points: StatsSeriesPoint[];
};

export type StatsDurationSeries = {
  key: StatsDurationMetricKey;
  label: string;
  description: string;
  average: number;
  points: StatsSeriesPoint[];
};

export type StatsKpi = {
  key: string;
  label: string;
  value: number;
  numerator: number;
  denominator: number;
  helper: string;
  format: 'percent' | 'number' | 'score';
};

export type StatsDashboardResponse = {
  period: {
    range: StatsDateRangeKey;
    label: string;
    days: number;
    from: string;
    to: string;
  };
  charts: StatsMetricSeries[];
  durationCharts: StatsDurationSeries[];
  kpis: StatsKpi[];
};

export type StatsDateRangeKey = 'week' | 'month' | 'quarter' | 'year' | 'all';

const DEFAULT_PERIOD_RANGE: StatsDateRangeKey = 'week';

type CountByDayRow = {
  day: string | null;
  total: number;
};

type AverageByDayRow = {
  day: string | null;
  average: number | null;
};

type DurationMetricConfig = {
  key: StatsDurationMetricKey;
  label: string;
  description: string;
  timingColumn: string;
  dateColumn: string;
  dateAlias: string;
  fromClause: string;
  whereClause: string;
};

const DURATION_METRICS: DurationMetricConfig[] = [
  {
    key: 'shopify',
    label: 'Temps Shopify',
    description: 'Durée moyenne de l’inspection Shopify.',
    timingColumn: 'scan_shopify_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'cmsDetection',
    label: 'Détection CMS',
    description: 'Durée moyenne de la détection CMS hors Shopify.',
    timingColumn: 'scan_cms_detection_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'language',
    label: 'Détection langue',
    description: 'Durée moyenne de la détection de langue du site.',
    timingColumn: 'scan_language_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'seoMeta',
    label: 'Balises SEO',
    description: 'Durée moyenne de la vérification des balises SEO.',
    timingColumn: 'scan_seo_meta_ms',
    dateColumn: 'seo_meta_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'legalNotice',
    label: 'Mentions légales',
    description: 'Durée moyenne de la vérification des mentions légales.',
    timingColumn: 'scan_legal_notice_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'catalog',
    label: 'Catalogue',
    description: 'Durée moyenne de l’inspection du catalogue produits.',
    timingColumn: 'scan_catalog_ms',
    dateColumn: 'catalog_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'contact',
    label: 'Contact',
    description: 'Durée moyenne de la recherche de contact.',
    timingColumn: 'scan_contact_ms',
    dateColumn: 'contact_checked_at',
    dateAlias: 'p',
    fromClause: 'FROM "urls" s INNER JOIN "prospects" p ON p."url_id" = s."id" AND p."trashed_at" IS NULL',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL AND p.contact_status = 'found' AND p.contact_checked_at IS NOT NULL`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    description: 'Durée moyenne de la recherche LinkedIn.',
    timingColumn: 'scan_linkedin_ms',
    dateColumn: 'contact_checked_at',
    dateAlias: 'p',
    fromClause: 'FROM "urls" s INNER JOIN "prospects" p ON p."url_id" = s."id" AND p."trashed_at" IS NULL',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL AND p.contact_status = 'found' AND p.contact_checked_at IS NOT NULL`,
  },
  {
    key: 'social',
    label: 'Autres réseaux',
    description: 'Durée moyenne de la recherche sur les réseaux sociaux.',
    timingColumn: 'scan_social_ms',
    dateColumn: 'contact_checked_at',
    dateAlias: 'p',
    fromClause: 'FROM "urls" s INNER JOIN "prospects" p ON p."url_id" = s."id" AND p."trashed_at" IS NULL',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL AND p.contact_status = 'found' AND p.contact_checked_at IS NOT NULL`,
  },
  {
    key: 'technical',
    label: 'Technique',
    description: 'Durée moyenne de l’inspection technique Shopify.',
    timingColumn: 'scan_technical_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'lighthouse',
    label: 'Lighthouse',
    description: 'Durée moyenne de l’audit Lighthouse.',
    timingColumn: 'scan_lighthouse_ms',
    dateColumn: 'lighthouse_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
  {
    key: 'workflowTotal',
    label: 'Workflow total',
    description: 'Durée moyenne totale d’un scan lancé.',
    timingColumn: 'scan_workflow_total_ms',
    dateColumn: 'shopify_checked_at',
    dateAlias: 's',
    fromClause: 'FROM "urls" s',
    whereClause: `s.trashed_at IS NULL AND s.blacklisted_at IS NULL`,
  },
];

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  private getRangeConfig(range: StatsDateRangeKey) {
    if (range === 'week') return { days: 7, label: 'La semaine' };
    if (range === 'quarter') return { days: 90, label: 'Le trimestre' };
    if (range === 'year') return { days: 365, label: 'L’année' };
    if (range === 'all') return { days: null, label: 'Depuis toujours' };
    return { days: 30, label: 'Le mois' };
  }

  private async getAllTimeStartDate() {
    const rows = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT MIN(created_at) AS value FROM "urls" WHERE trashed_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT MIN(first_contact_email_sent_at) AS value FROM "prospects" WHERE trashed_at IS NULL AND first_contact_email_sent_at IS NOT NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT MIN(contact_checked_at) AS value FROM "prospects" WHERE trashed_at IS NULL AND contact_status = 'found' AND contact_checked_at IS NOT NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT MIN(shopify_checked_at) AS value FROM "urls" WHERE trashed_at IS NULL AND shopify_checked_at IS NOT NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT MIN(seo_meta_checked_at) AS value FROM "urls" WHERE trashed_at IS NULL AND seo_meta_checked_at IS NOT NULL`,
      ),
    ]);

    const dates = rows
      .flatMap((rowSet) => rowSet.map((row) => row.value).filter(Boolean))
      .map((value) => new Date(String(value)))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (!dates.length) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 29);
      return fallback;
    }

    return new Date(Math.min(...dates.map((date) => date.getTime())));
  }

  private getLeadScoreMax(settings: Awaited<ReturnType<SiteSettingsService['getLeadScoreSettings']>>) {
    const maxOf = (...values: number[]) => Math.max(0, ...values.map((value) => Number(value || 0)));

    return [
      maxOf(settings.shopify.shopify, settings.shopify.cms, settings.shopify.other),
      maxOf(settings.siren.found, settings.siren.missing),
      maxOf(settings.theme.dawn, settings.theme.other, settings.theme.custom),
      maxOf(settings.language.french, settings.language.english, settings.language.other),
      maxOf(settings.companyCountry.france, settings.companyCountry.missing, settings.companyCountry.other),
      maxOf(settings.legalNotice.missing, settings.legalNotice.found),
      maxOf(
        settings.catalog.productCount.points.high,
        settings.catalog.productCount.points.medium,
        settings.catalog.productCount.points.low,
        settings.catalog.productCount.points.none,
      ),
      maxOf(
        settings.catalog.medianProductPrice.points.high,
        settings.catalog.medianProductPrice.points.medium,
        settings.catalog.medianProductPrice.points.low,
        settings.catalog.medianProductPrice.points.none,
      ),
      maxOf(
        settings.lighthouse.points.excellent,
        settings.lighthouse.points.good,
        settings.lighthouse.points.average,
        settings.lighthouse.points.poor,
        settings.lighthouse.points.critical,
      ),
    ].reduce((sum, value) => sum + value, 0);
  }

  private formatDay(value: Date) {
    return value.toISOString().slice(0, 10);
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

  private formatDayLabel(value: Date) {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(value);
  }

  private getEasterSunday(year: number) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  private getFrenchPublicHolidays(year: number) {
    const easter = this.getEasterSunday(year);
    const easterSunday = new Date(Date.UTC(year, easter.month - 1, easter.day));
    const addDays = (days: number) => {
      const date = new Date(easterSunday.getTime());
      date.setUTCDate(date.getUTCDate() + days);
      return this.formatDay(date);
    };

    return new Set<string>([
      this.formatDay(new Date(Date.UTC(year, 0, 1))),
      addDays(1),
      this.formatDay(new Date(Date.UTC(year, 4, 1))),
      this.formatDay(new Date(Date.UTC(year, 4, 8))),
      addDays(39),
      addDays(50),
      this.formatDay(new Date(Date.UTC(year, 6, 14))),
      this.formatDay(new Date(Date.UTC(year, 7, 15))),
      this.formatDay(new Date(Date.UTC(year, 10, 1))),
      this.formatDay(new Date(Date.UTC(year, 10, 11))),
      this.formatDay(new Date(Date.UTC(year, 11, 25))),
    ]);
  }

  private isBusinessDay(date: Date) {
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    return !this.getFrenchPublicHolidays(date.getUTCFullYear()).has(this.formatDay(date));
  }

  private buildSeries(points: CountByDayRow[], from: Date, to: Date, options: { annotateBusinessDays?: boolean } = {}) {
    const byDay = new Map(points.filter((row) => row.day).map((row) => [String(row.day), Number(row.total || 0)]));
    const cursor = new Date(from);
    const series: StatsSeriesPoint[] = [];

    while (cursor <= to) {
      const day = this.formatDay(cursor);
      series.push({
        date: day,
        label: this.formatDayLabel(cursor),
        value: byDay.get(day) || 0,
        ...(options.annotateBusinessDays ? { isBusinessDay: this.isBusinessDay(cursor) } : {}),
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private buildAverageSeries(points: AverageByDayRow[], from: Date, to: Date) {
    const byDay = new Map(
      points
        .filter((row) => row.day)
        .map((row) => [String(row.day), Number(row.average || 0)]),
    );
    const cursor = new Date(from);
    const series: StatsSeriesPoint[] = [];

    while (cursor <= to) {
      const day = this.formatDay(cursor);
      series.push({
        date: day,
        label: this.formatDayLabel(cursor),
        value: byDay.get(day) || 0,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return series;
  }

  private async fetchCountByDay(query: string, params: unknown[] = []) {
    return this.prisma.$queryRawUnsafe<CountByDayRow[]>(
      this.interpolateSql(query, params),
    );
  }

  private async fetchAverageByDay(query: string, params: unknown[] = []) {
    return this.prisma.$queryRawUnsafe<AverageByDayRow[]>(
      this.interpolateSql(query, params),
    );
  }

  async getDashboard(range: StatsDateRangeKey = DEFAULT_PERIOD_RANGE): Promise<StatsDashboardResponse> {
    await ensureProspectEmailSendHistoryTable(this.prisma);

    const leadScoreSettings = await this.siteSettingsService.getLeadScoreSettings();
    const rangeConfig = this.getRangeConfig(range);
    const to = new Date();
    const from = rangeConfig.days === null
      ? await this.getAllTimeStartDate()
      : new Date(new Date().setDate(to.getDate() - (rangeConfig.days - 1)));
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [emailsRows, contactsRows, shopifyRows, importedRows] = await Promise.all([
      this.fetchCountByDay(
        `
        SELECT
          date(h.sent_at) AS day,
          COUNT(*) AS total
        FROM "prospect_email_send_history" h
        INNER JOIN "prospects" p ON p.id = h.prospect_id
        WHERE p.trashed_at IS NULL
          AND h.sent_at IS NOT NULL
          AND h.sent_at >= ?
          AND EXTRACT(DOW FROM h.sent_at) NOT IN (0, 6)
        GROUP BY date(h.sent_at)
        ORDER BY day ASC
        `,
        [fromIso],
      ),
      this.fetchCountByDay(
        `
        SELECT
          date(p.contact_checked_at) AS day,
          COUNT(*) AS total
        FROM "prospects" p
        WHERE p.trashed_at IS NULL
          AND p.contact_status = 'found'
          AND p.contact_checked_at IS NOT NULL
          AND p.contact_checked_at >= ?
        GROUP BY date(p.contact_checked_at)
        ORDER BY day ASC
        `,
        [fromIso],
      ),
      this.fetchCountByDay(
        `
        SELECT
          date(u.shopify_checked_at) AS day,
          COUNT(*) AS total
        FROM "urls" u
        WHERE u.trashed_at IS NULL
          AND u.blacklisted_at IS NULL
          AND u.shopify_status = 'shopify'
          AND u.shopify_checked_at IS NOT NULL
          AND u.shopify_checked_at >= ?
        GROUP BY date(u.shopify_checked_at)
        ORDER BY day ASC
        `,
        [fromIso],
      ),
      this.fetchCountByDay(
        `
        SELECT
          date(u.created_at) AS day,
          COUNT(*) AS total
        FROM "urls" u
        WHERE u.created_at >= ?
        GROUP BY date(u.created_at)
        ORDER BY day ASC
        `,
        [fromIso],
      ),
    ]);

    const [
      importedTotalRow,
      shopifyDetectedRow,
      contactsFoundRow,
      emailsSentRow,
      leadScoreRow,
      exploitableLeadsRow,
      contactedProspectsRow,
      responseRow,
      relaunchUsefulRow,
      clientRow,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "urls" WHERE trashed_at IS NULL AND blacklisted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "urls" WHERE trashed_at IS NULL AND blacklisted_at IS NULL AND shopify_status = 'shopify'`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND contact_status = 'found'`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospect_email_send_history" h INNER JOIN "prospects" p ON p.id = h.prospect_id WHERE p.trashed_at IS NULL AND h.sent_at IS NOT NULL AND EXTRACT(DOW FROM h.sent_at) NOT IN (0, 6)`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ average: number | null }>>(
        `SELECT AVG(lead_score) AS average FROM "prospects" WHERE trashed_at IS NULL AND email IS NOT NULL AND TRIM(email) <> ''`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND email IS NOT NULL AND TRIM(email) <> ''`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND status IN ('Prospect contacté', 'Prospect en attente réponse', 'Prospect en discussion', 'Prospect qualifié (opportunité)', 'Prospect non qualifié', 'Offre envoyée', 'Relance en cours', 'Client')`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND status IN ('Prospect en discussion', 'Prospect qualifié (opportunité)', 'Offre envoyée', 'Relance en cours', 'Client')`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND status IN ('Offre envoyée', 'Relance en cours', 'Client')`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT COUNT(*) AS total FROM "prospects" WHERE trashed_at IS NULL AND status = 'Client'`,
      ),
    ]);

    const durationCharts = await Promise.all(
      DURATION_METRICS.map(async (metric) => {
        const rows = await this.fetchAverageByDay(
          `
          SELECT
            date(${metric.dateAlias}.${metric.dateColumn}) AS day,
            AVG(s.${metric.timingColumn}) AS average
          ${metric.fromClause}
          WHERE ${metric.whereClause}
            AND s.${metric.timingColumn} IS NOT NULL
            AND ${metric.dateAlias}.${metric.dateColumn} IS NOT NULL
            AND ${metric.dateAlias}.${metric.dateColumn} >= ?
          GROUP BY date(${metric.dateAlias}.${metric.dateColumn})
          ORDER BY day ASC
          `,
          [fromIso],
        );

        const totalRow = await this.prisma.$queryRawUnsafe<Array<{ average: number | null }>>(
          this.interpolateSql(
            `
            SELECT AVG(s.${metric.timingColumn}) AS average
            ${metric.fromClause}
            WHERE ${metric.whereClause}
              AND s.${metric.timingColumn} IS NOT NULL
              AND ${metric.dateAlias}.${metric.dateColumn} IS NOT NULL
              AND ${metric.dateAlias}.${metric.dateColumn} >= ?
            `,
            [fromIso],
          ),
        );

        return {
          key: metric.key,
          label: metric.label,
          description: metric.description,
          average: Number(totalRow[0]?.average ?? 0),
          points: this.buildAverageSeries(rows, from, to),
        };
      }),
    );

    const importedTotal = Number(importedTotalRow[0]?.total || 0);
    const shopifyDetectedTotal = Number(shopifyDetectedRow[0]?.total || 0);
    const contactsFoundTotal = Number(contactsFoundRow[0]?.total || 0);
    const emailsSentTotal = Number(emailsSentRow[0]?.total || 0);
    const leadScoreAverage = Number(leadScoreRow[0]?.average ?? 0);
    const exploitableLeadsTotal = Number(exploitableLeadsRow[0]?.total || 0);
    const contactedProspectsTotal = Number(contactedProspectsRow[0]?.total || 0);
    const responseTotal = Number(responseRow[0]?.total || 0);
    const relaunchUsefulTotal = Number(relaunchUsefulRow[0]?.total || 0);
    const clientTotal = Number(clientRow[0]?.total || 0);
    const leadScoreMax = this.getLeadScoreMax(leadScoreSettings);

    const toPercent = (numerator: number, denominator: number) => {
      if (!denominator) return 0;
      return Math.round((numerator / denominator) * 1000) / 10;
    };

    return {
      period: {
        range,
        label: rangeConfig.label,
        days: rangeConfig.days ?? Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))),
        from: fromIso,
        to: toIso,
      },
      charts: [
        {
          key: 'emailsSent',
          label: 'Emails envoyés',
          description: 'Prospects avec une vraie date d’envoi de premier contact.',
          total: emailsSentTotal,
          points: this.buildSeries(emailsRows, from, to, { annotateBusinessDays: true }),
        },
        {
          key: 'contactsFound',
          label: 'Contacts trouvés',
          description: 'Contacts détectés lors des scans.',
          total: contactsFoundTotal,
          points: this.buildSeries(contactsRows, from, to),
        },
        {
          key: 'shopifyDetected',
          label: 'Shopify détectés',
          description: 'URLs identifiées comme Shopify.',
          total: shopifyDetectedTotal,
          points: this.buildSeries(shopifyRows, from, to),
        },
        {
          key: 'urlsImported',
          label: 'URLs importées',
          description: 'Nouvelles URLs créées dans la base.',
          total: importedTotal,
          points: this.buildSeries(importedRows, from, to),
        },
      ],
      durationCharts,
      kpis: [
        {
          key: 'shopifyDetectionRate',
          label: 'Taux de détection Shopify',
          value: toPercent(shopifyDetectedTotal, importedTotal),
          numerator: shopifyDetectedTotal,
          denominator: importedTotal,
          helper: 'Shopify détectés / URLs importées',
          format: 'percent',
        },
        {
          key: 'contactFoundRate',
          label: 'Taux de contact trouvé',
          value: toPercent(contactsFoundTotal, importedTotal),
          numerator: contactsFoundTotal,
          denominator: importedTotal,
          helper: 'Contacts trouvés / URLs importées',
          format: 'percent',
        },
        {
          key: 'exploitablesRate',
          label: 'Taux de leads exploitables',
          value: toPercent(exploitableLeadsTotal, importedTotal),
          numerator: exploitableLeadsTotal,
          denominator: importedTotal,
          helper: 'Prospects avec email / URLs importées',
          format: 'percent',
        },
        {
          key: 'leadScoreAverage',
          label: 'Lead score moyen',
          value: Math.round((leadScoreAverage || 0) * 10) / 10,
          numerator: Math.round((leadScoreAverage || 0) * 10) / 10,
          denominator: leadScoreMax,
          helper: 'Moyenne des prospects exploitables',
          format: 'score',
        },
        {
          key: 'contactedProspectsRate',
          label: 'Taux de prospects contactés',
          value: toPercent(contactedProspectsTotal, exploitableLeadsTotal),
          numerator: contactedProspectsTotal,
          denominator: exploitableLeadsTotal,
          helper: 'Prospects contactés / prospects exploitables',
          format: 'percent',
        },
        {
          key: 'responseRate',
          label: 'Taux de réponse',
          value: toPercent(responseTotal, contactedProspectsTotal),
          numerator: responseTotal,
          denominator: contactedProspectsTotal,
          helper: 'Prospects en discussion / prospects contactés',
          format: 'percent',
        },
        {
          key: 'relaunchUsefulRate',
          label: 'Taux de relance utile',
          value: toPercent(relaunchUsefulTotal, contactedProspectsTotal),
          numerator: relaunchUsefulTotal,
          denominator: contactedProspectsTotal,
          helper: 'Prospects avancés après contact / prospects contactés',
          format: 'percent',
        },
        {
          key: 'clientConversionRate',
          label: 'Taux de conversion client',
          value: toPercent(clientTotal, contactedProspectsTotal),
          numerator: clientTotal,
          denominator: contactedProspectsTotal,
          helper: 'Clients / prospects contactés',
          format: 'percent',
        },
      ],
    };
  }
}
