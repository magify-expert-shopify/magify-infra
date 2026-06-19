import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const TRASHABLE_TARGETS = [
  'competitor-agency-sites',
  'blogs',
  'authors',
  'blog-articles',
  'keyword-groups',
  'seo-clusters',
] as const;

const CACHE_TARGETS = [
  'openai-cache',
  'dataforseo-cache',
  'google-suggest-cache',
] as const;
const PURGE_TABLE_TARGETS = [
  ...TRASHABLE_TARGETS,
  ...CACHE_TARGETS,
  'keyword-group-relations',
  'keyword-groups',
  'keyword',
  'subject',
  'internal-link',
  'page',
  'app-setting',
] as const;

type TrashableTarget = (typeof TRASHABLE_TARGETS)[number];
type CacheTarget = (typeof CACHE_TARGETS)[number];
type PurgeTableTarget = (typeof PURGE_TABLE_TARGETS)[number];
type ExportTableTarget = PurgeTableTarget;

type MaintenanceSummaryItem = {
  key: string;
  label: string;
  totalCount: number;
  trashedCount: number | null;
  tablePurgeable: boolean;
  action:
    | 'purge-trash'
    | 'clear-cache'
    | 'clear-keyword-templates'
    | 'unlink-group-relations'
    | 'none';
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      competitorAgencySiteTotalCount,
      competitorAgencySiteTrashedCount,
      blogTotalCount,
      blogTrashedCount,
      authorTotalCount,
      authorTrashedCount,
      blogArticleTotalCount,
      blogArticleTrashedCount,
      keywordGroupTotalCount,
      keywordGroupTrashedCount,
      keywordGroupLinkedCount,
      subjectTotalCount,
      keywordTotalCount,
      keywordTemplateCount,
      internalLinkTotalCount,
      pageTotalCount,
      seoClusterTotalCount,
      seoClusterTrashedCount,
      dataForSeoCacheTotalCount,
      googleSuggestCacheTotalCount,
      openAiCacheTotalCount,
      appSettingTotalCount,
    ] = await Promise.all([
      (this.prisma as any).competitorAgencySite.count(),
      (this.prisma as any).competitorAgencySite.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).blog.count(),
      (this.prisma as any).blog.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).author.count(),
      (this.prisma as any).author.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).blogArticle.count(),
      (this.prisma as any).blogArticle.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).keywordGroup.count(),
      (this.prisma as any).keywordGroup.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).keywordGroup.count({
        where: {
          OR: [
            { parentGroupId: { not: null } },
            { childKeywordGroups: { some: {} } },
          ],
        },
      }),
      this.safeCount('subject'),
      (this.prisma as any).keyword.count(),
      (this.prisma as any).keyword.count({
        where: { template: { not: null } },
      }),
      (this.prisma as any).internalLink.count(),
      (this.prisma as any).page.count(),
      (this.prisma as any).seoCluster.count(),
      (this.prisma as any).seoCluster.count({
        where: { trashedAt: { not: null } },
      }),
      (this.prisma as any).dataForSeoCache.count(),
      (this.prisma as any).googleSuggestCache.count(),
      (this.prisma as any).openAiCache.count(),
      (this.prisma as any).appSetting.count(),
    ]);

    return {
      items: [
        this.createTrashableSummaryItem(
          'competitor-agency-sites',
          'CompetitorAgencySite',
          competitorAgencySiteTotalCount,
          competitorAgencySiteTrashedCount,
        ),
        this.createTrashableSummaryItem(
          'blogs',
          'Blog',
          blogTotalCount,
          blogTrashedCount,
        ),
        this.createTrashableSummaryItem(
          'authors',
          'Author',
          authorTotalCount,
          authorTrashedCount,
        ),
        this.createTrashableSummaryItem(
          'blog-articles',
          'BlogArticle',
          blogArticleTotalCount,
          blogArticleTrashedCount,
        ),
        this.createTrashableSummaryItem(
          'keyword-groups',
          'KeywordGroup',
          keywordGroupTotalCount,
          keywordGroupTrashedCount,
        ),
        this.createSummaryItem(
          'keyword-group-relations',
          'Relations de groupes',
          keywordGroupLinkedCount,
          null,
          false,
          'unlink-group-relations',
        ),
        this.createSummaryItem(
          'subject',
          'Subject',
          subjectTotalCount,
          null,
          false,
          'none',
        ),
        this.createSummaryItem(
          'keyword',
          'Keyword',
          keywordTotalCount,
          null,
          true,
          'none',
        ),
        this.createSummaryItem(
          'keyword-templates',
          'Templates des mots-clés',
          keywordTemplateCount,
          null,
          false,
          'clear-keyword-templates',
        ),
        this.createSummaryItem(
          'internal-link',
          'InternalLink',
          internalLinkTotalCount,
          null,
          true,
          'none',
        ),
        this.createSummaryItem(
          'page',
          'Page',
          pageTotalCount,
          null,
          true,
          'none',
        ),
        this.createTrashableSummaryItem(
          'seo-clusters',
          'SeoCluster',
          seoClusterTotalCount,
          seoClusterTrashedCount,
        ),
        this.createSummaryItem(
          'dataforseo-cache',
          'DataForSeoCache',
          dataForSeoCacheTotalCount,
          null,
          true,
          'clear-cache',
        ),
        this.createSummaryItem(
          'google-suggest-cache',
          'GoogleSuggestCache',
          googleSuggestCacheTotalCount,
          null,
          true,
          'clear-cache',
        ),
        this.createSummaryItem(
          'openai-cache',
          'OpenAiCache',
          openAiCacheTotalCount,
          null,
          true,
          'clear-cache',
        ),
        this.createSummaryItem(
          'app-setting',
          'AppSetting',
          appSettingTotalCount,
          null,
          true,
          'none',
        ),
      ] satisfies MaintenanceSummaryItem[],
    };
  }

  async purge(target: string) {
    if ((TRASHABLE_TARGETS as readonly string[]).includes(target)) {
      return {
        target,
        deletedCount: await this.purgeTrash(target as TrashableTarget),
      };
    }

    if ((CACHE_TARGETS as readonly string[]).includes(target)) {
      return {
        target,
        deletedCount: await this.clearCache(target as CacheTarget),
      };
    }

    if (target === 'keyword-templates') {
      return {
        target,
        deletedCount: await this.clearKeywordTemplates(),
      };
    }

    if (target === 'keyword-group-relations') {
      return {
        target,
        deletedCount: await this.unlinkKeywordGroupRelations(),
      };
    }

    throw new BadRequestException(
      `Maintenance target "${target}" is not supported.`,
    );
  }

  async purgeTrashAll() {
    const deletedCounts = await Promise.all(
      [...TRASHABLE_TARGETS].map((target) => this.purgeTrash(target)),
    );

    return {
      target: 'trash',
      deletedCount: deletedCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  async purgeTable(target: string) {
    if ((PURGE_TABLE_TARGETS as readonly string[]).includes(target)) {
      return {
        target,
        deletedCount: await this.purgeTableTarget(target as PurgeTableTarget),
      };
    }

    throw new BadRequestException(
      `Maintenance target "${target}" is not supported.`,
    );
  }

  async exportCsv(targets: string[]) {
    const uniqueTargets = [
      ...new Set(targets.map((target) => target.trim()).filter(Boolean)),
    ];

    if (!uniqueTargets.length) {
      throw new BadRequestException(
        'At least one maintenance target is required.',
      );
    }

    const files: Array<{
      target: string;
      filename: string;
      rowCount: number;
      csv: string;
    }> = [];

    for (const target of uniqueTargets) {
      if (!(PURGE_TABLE_TARGETS as readonly string[]).includes(target)) {
        throw new BadRequestException(
          `Maintenance target "${target}" is not supported.`,
        );
      }

      const rows = await this.fetchExportRows(target as ExportTableTarget);

      files.push({
        target,
        filename: `${target}-${new Date().toISOString().slice(0, 10)}.csv`,
        rowCount: rows.length,
        csv: this.toCsv(rows),
      });
    }

    return { files };
  }

  private createTrashableSummaryItem(
    key: string,
    label: string,
    totalCount: number,
    trashedCount: number,
  ) {
    return this.createSummaryItem(
      key,
      label,
      totalCount,
      trashedCount,
      true,
      'purge-trash',
    );
  }

  private createSummaryItem(
    key: string,
    label: string,
    totalCount: number,
    trashedCount: number | null,
    tablePurgeable: boolean,
    action: MaintenanceSummaryItem['action'],
  ): MaintenanceSummaryItem {
    return {
      key,
      label,
      totalCount,
      trashedCount,
      tablePurgeable,
      action,
    };
  }

  private async purgeTrash(target: TrashableTarget) {
    switch (target) {
      case 'competitor-agency-sites':
        return (
          (await (this.prisma as any).competitorAgencySite.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
      case 'blogs':
        return (
          (await (this.prisma as any).blog.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
      case 'authors':
        return (
          (await (this.prisma as any).author.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
      case 'blog-articles':
        return (
          (await (this.prisma as any).blogArticle.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
      case 'keyword-groups':
        return (
          (await (this.prisma as any).keywordGroup.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
      case 'seo-clusters':
        return (
          (await (this.prisma as any).seoCluster.deleteMany({
            where: { trashedAt: { not: null } },
          })) as { count: number }
        ).count;
    }
  }

  private async purgeTableTarget(target: PurgeTableTarget) {
    switch (target) {
      case 'competitor-agency-sites':
        return (
          (await (this.prisma as any).competitorAgencySite.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'blogs':
        return (
          (await (this.prisma as any).blog.deleteMany()) as { count: number }
        ).count;
      case 'authors':
        return (
          (await (this.prisma as any).author.deleteMany()) as { count: number }
        ).count;
      case 'blog-articles':
        return (
          (await (this.prisma as any).blogArticle.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'keyword-groups':
        return (
          (await (this.prisma as any).keywordGroup.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'seo-clusters':
        return (
          (await (this.prisma as any).seoCluster.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'keyword':
        return (
          (await (this.prisma as any).keyword.deleteMany()) as { count: number }
        ).count;
      case 'internal-link':
        return (
          (await (this.prisma as any).internalLink.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'page':
        return (
          (await (this.prisma as any).page.deleteMany()) as { count: number }
        ).count;
      case 'subject':
        return (
          (await (this.prisma as any).subject.deleteMany()) as { count: number }
        ).count;
      case 'dataforseo-cache':
        return (
          (await (this.prisma as any).dataForSeoCache.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'google-suggest-cache':
        return (
          (await (this.prisma as any).googleSuggestCache.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'openai-cache':
        return (
          (await (this.prisma as any).openAiCache.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'app-setting':
        return (
          (await (this.prisma as any).appSetting.deleteMany()) as {
            count: number;
          }
        ).count;
    }
  }

  private async clearCache(target: CacheTarget) {
    switch (target) {
      case 'openai-cache':
        return (
          (await (this.prisma as any).openAiCache.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'dataforseo-cache':
        return (
          (await (this.prisma as any).dataForSeoCache.deleteMany()) as {
            count: number;
          }
        ).count;
      case 'google-suggest-cache':
        return (
          (await (this.prisma as any).googleSuggestCache.deleteMany()) as {
            count: number;
          }
        ).count;
    }
  }

  private async clearKeywordTemplates() {
    const result = await (this.prisma as any).keyword.updateMany({
      where: {
        template: { not: null },
      },
      data: {
        template: null,
      },
    });

    return result.count ?? 0;
  }

  async unlinkKeywordGroupRelations() {
    const keywordGroups = await (this.prisma as any).keywordGroup.findMany({
      where: {
        OR: [
          { parentGroupId: { not: null } },
          { childKeywordGroups: { some: {} } },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!keywordGroups.length) {
      return 0;
    }

    const result = await this.prisma.$transaction(
      keywordGroups.map((keywordGroup: { id: string }) =>
        (this.prisma as any).keywordGroup.update({
          where: {
            id: keywordGroup.id,
          },
          data: {
            parentGroupId: null,
          },
        }),
      ),
    );

    if (!Array.isArray(result)) {
      return 0;
    }

    return result.length;
  }

  private async fetchExportRows(target: ExportTableTarget) {
    switch (target) {
      case 'competitor-agency-sites':
        return (await (
          this.prisma as any
        ).competitorAgencySite.findMany()) as Record<string, unknown>[];
      case 'blogs':
        return (await (this.prisma as any).blog.findMany()) as Record<
          string,
          unknown
        >[];
      case 'authors':
        return (await (this.prisma as any).author.findMany()) as Record<
          string,
          unknown
        >[];
      case 'blog-articles':
        return (await (this.prisma as any).blogArticle.findMany()) as Record<
          string,
          unknown
        >[];
      case 'keyword-groups':
        return (await (this.prisma as any).keywordGroup.findMany()) as Record<
          string,
          unknown
        >[];
      case 'keyword-group-relations': {
        const keywordGroups = (await (this.prisma as any).keywordGroup.findMany(
          {
            select: {
              id: true,
              name: true,
              parentGroupId: true,
              parentGroup: {
                select: {
                  id: true,
                  name: true,
                },
              },
              childKeywordGroups: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          },
        )) as Array<{
          id: string;
          name: string;
          parentGroupId: string | null;
          parentGroup: { id: string; name: string } | null;
          childKeywordGroups: Array<{ id: string; name: string }>;
        }>;

        return keywordGroups.flatMap((keywordGroup) => {
          const rows: Record<string, unknown>[] = [];

          if (keywordGroup.parentGroupId && keywordGroup.parentGroup) {
            rows.push({
              relationType: 'parentGroupId',
              childId: keywordGroup.id,
              childName: keywordGroup.name,
              parentId: keywordGroup.parentGroup.id,
              parentName: keywordGroup.parentGroup.name,
            });
          }

          for (const parentGroup of keywordGroup.childKeywordGroups ?? []) {
            rows.push({
              relationType: 'parentGroups',
              childId: keywordGroup.id,
              childName: keywordGroup.name,
              parentId: parentGroup.id,
              parentName: parentGroup.name,
            });
          }

          return rows;
        });
      }
      case 'seo-clusters':
        return (await (this.prisma as any).seoCluster.findMany()) as Record<
          string,
          unknown
        >[];
      case 'keyword':
        return (await (this.prisma as any).keyword.findMany()) as Record<
          string,
          unknown
        >[];
      case 'internal-link':
        return (await (this.prisma as any).internalLink.findMany()) as Record<
          string,
          unknown
        >[];
      case 'page':
        return (await (this.prisma as any).page.findMany()) as Record<
          string,
          unknown
        >[];
      case 'subject':
        return this.safeFindMany('subject');
      case 'dataforseo-cache':
        return (await (
          this.prisma as any
        ).dataForSeoCache.findMany()) as Record<string, unknown>[];
      case 'google-suggest-cache':
        return (await (
          this.prisma as any
        ).googleSuggestCache.findMany()) as Record<string, unknown>[];
      case 'openai-cache':
        return (await (this.prisma as any).openAiCache.findMany()) as Record<
          string,
          unknown
        >[];
      case 'app-setting':
        return (await (this.prisma as any).appSetting.findMany()) as Record<
          string,
          unknown
        >[];
    }
  }

  private toCsv(rows: Record<string, unknown>[]) {
    if (!rows.length) {
      return '';
    }

    const columns = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    ).sort((left, right) => left.localeCompare(right));

    const escapeCell = (value: unknown) => {
      if (value === null || value === undefined) {
        return '';
      }

      const normalizedValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);

      return `"${normalizedValue.replaceAll('"', '""')}"`;
    };

    const header = columns.join(',');
    const lines = rows.map((row) =>
      columns.map((column) => escapeCell(row[column])).join(','),
    );

    return [header, ...lines].join('\n');
  }

  private async safeCount(modelName: string) {
    const model = (this.prisma as any)[modelName];

    if (!model?.count) {
      return 0;
    }

    return model.count();
  }

  private async safeFindMany(modelName: string) {
    const model = (this.prisma as any)[modelName];

    if (!model?.findMany) {
      return [];
    }

    return (await model.findMany()) as Record<string, unknown>[];
  }
}
