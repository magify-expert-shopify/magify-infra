import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseStructuredOpenAiResponse } from '../../common/utils/openai-response';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSeoClusterDto } from './dto/create-seo-cluster.dto';
import { UpdateSeoClusterDto } from './dto/update-seo-cluster.dto';
import { OpenAiPlatformService } from '../openai-platform/openai-platform.service';
import {
  SEO_CLUSTER_SUGGESTION_OPENAI_JSON_SCHEMA,
  seoClusterSuggestionResponseSchema,
  type SeoClusterSuggestionResponse,
} from './seo-cluster-suggestion.schemas';
import { SettingsPromptConfigsService } from '../admin/settings/settings-prompt-configs.service';

type SeoClusterSuggestionCandidate = {
  id: string;
  name: string;
  description?: string | null;
};

@Injectable()
export class SeoClustersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  findAll(projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();

    return (this.prisma as any).seoCluster.findMany({
      where: this.buildProjectScopedWhere(normalizedProjectId),
      include: {
        _count: {
          select: {
            blogArticles: true,
          },
        },
        pages: {
          where: {
            seoRole: 'PILLAR',
          },
          select: {
            id: true,
            seoRole: true,
          },
          take: 1,
        },
        parentCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        pillarKeywordGroup: {
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
          },
        },
        keywordGroups: {
          where: { trashedAt: null },
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
            description: true,
            isFavorite: true,
            seoClusterId: true,
          },
        },
        childClusters: {
          where: { trashedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  search(query: string) {
    return (this.prisma as any).seoCluster.findMany({
      where: {
        trashedAt: null,
        OR: [
          { name: { contains: query } },
          { slug: { contains: query } },
          { topic: { contains: query } },
          { description: { contains: query } },
          { primaryKeyword: { contains: query } },
        ],
      },
      include: {
        _count: {
          select: {
            blogArticles: true,
          },
        },
        pages: {
          where: {
            seoRole: 'PILLAR',
          },
          select: {
            id: true,
            seoRole: true,
          },
          take: 1,
        },
        parentCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        pillarKeywordGroup: {
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
          },
        },
        keywordGroups: {
          where: { trashedAt: null },
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
            description: true,
            isFavorite: true,
            seoClusterId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  async findOne(clusterId: string, projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();
    const cluster = await (this.prisma as any).seoCluster.findFirst({
      where: {
        id: clusterId,
        trashedAt: null,
      },
      include: {
        _count: {
          select: {
            blogArticles: true,
          },
        },
        parentCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        pillarKeywordGroup: {
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
          },
        },
        keywordGroups: {
          where: { trashedAt: null },
          select: {
            id: true,
            name: true,
            primaryKeyword: true,
            description: true,
            isFavorite: true,
            seoClusterId: true,
          },
        },
        childClusters: {
          where: { trashedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        pages: {
          select: {
            id: true,
            title: true,
            slug: true,
            url: true,
            status: true,
            pageType: true,
            seoRole: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        blogArticles: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            url: true,
            status: true,
          },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!cluster) {
      throw new NotFoundException(`SeoCluster ${clusterId} not found`);
    }

    if (
      normalizedProjectId &&
      !this.isClusterScopedToProject(cluster, normalizedProjectId)
    ) {
      throw new NotFoundException(`SeoCluster ${clusterId} not found`);
    }

    const clusterHierarchy = await (this.prisma as any).seoCluster.findMany({
      where: this.buildProjectScopedWhere(normalizedProjectId),
      select: {
        id: true,
        parentClusterId: true,
        name: true,
        slug: true,
      },
    });

    const descendantClusterIds = this.getDescendantClusterIds(
      cluster.id,
      clusterHierarchy,
    );
    const parentClusters = this.getParentClusters(cluster, clusterHierarchy);
    const descendantBlogArticles = descendantClusterIds.length
      ? await (this.prisma as any).blogArticle.findMany({
          where: {
            trashedAt: null,
            seoClusterId: {
              in: descendantClusterIds,
            },
            ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            url: true,
            status: true,
            seoCluster: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    return {
      ...cluster,
      parentClusters,
      descendantBlogArticles,
    };
  }

  async create(dto: CreateSeoClusterDto) {
    return this.prisma.$transaction(async (tx) => {
      const pillarKeywordGroup = await this.resolvePillarKeywordGroup(
        tx,
        dto.pillarKeywordGroupId,
        true,
      );
      const slug = this.resolveClusterSlug(dto, pillarKeywordGroup);

      if (!slug) {
        throw new BadRequestException(
          'Un slug ne peut pas être généré sans mot-clé principal de groupe pilier.',
        );
      }

      const cluster = await (tx as any).seoCluster.create({
        data: this.toPersistenceData({
          ...dto,
          projectId: pillarKeywordGroup?.projectId ?? null,
          slug,
          pillarKeywordGroupId: pillarKeywordGroup?.id ?? null,
          primaryKeyword:
            pillarKeywordGroup?.primaryKeyword ?? dto.primaryKeyword,
        }),
      });

      await this.syncSecondaryKeywordGroups(
        tx,
        cluster.id,
        dto.secondaryKeywordGroupIds ?? [],
        pillarKeywordGroup?.id ?? null,
      );
      await this.syncChildClusters(tx, cluster.id, dto.childClusterIds ?? []);

      return cluster;
    });
  }

  async update(clusterId: string, dto: UpdateSeoClusterDto) {
    const currentCluster = await this.findOne(clusterId);

    return this.prisma.$transaction(async (tx) => {
      const pillarKeywordGroup = await this.resolvePillarKeywordGroup(
        tx,
        dto.pillarKeywordGroupId ??
          currentCluster.pillarKeywordGroup?.id ??
          null,
        false,
      );
      const slug = this.resolveClusterSlug(
        dto,
        pillarKeywordGroup,
        currentCluster.slug ?? null,
      );
      const primaryKeyword =
        pillarKeywordGroup?.primaryKeyword ??
        dto.primaryKeyword ??
        currentCluster.primaryKeyword;

      const cluster = await (tx as any).seoCluster.update({
        where: { id: clusterId },
        data: this.toPersistenceData({
          ...dto,
          slug: slug ?? undefined,
          pillarKeywordGroupId:
            pillarKeywordGroup?.id ?? dto.pillarKeywordGroupId ?? null,
          primaryKeyword,
        }),
      });

      if (dto.secondaryKeywordGroupIds !== undefined) {
        await this.syncSecondaryKeywordGroups(
          tx,
          cluster.id,
          dto.secondaryKeywordGroupIds ?? [],
          pillarKeywordGroup?.id ??
            currentCluster.pillarKeywordGroup?.id ??
            null,
        );
      }

      if (dto.childClusterIds !== undefined) {
        await this.syncChildClusters(tx, cluster.id, dto.childClusterIds ?? []);
      }

      return cluster;
    });
  }

  async setPillarFromArticle(clusterId: string, articleId: string) {
    const [cluster, article] = await Promise.all([
      (this.prisma as any).seoCluster.findFirst({
        where: { id: clusterId, trashedAt: null },
      }),
      (this.prisma as any).blogArticle.findFirst({
        where: {
          id: articleId,
          clusterId,
          trashedAt: null,
        },
      }),
    ]);

    if (!cluster) {
      throw new NotFoundException(`SeoCluster ${clusterId} not found`);
    }

    if (!article) {
      throw new NotFoundException(`Blog article ${articleId} not found`);
    }

    const normalizedTitle = article.title?.trim() || 'Sans titre';
    const normalizedSlug =
      article.slug?.trim() ||
      this.buildFallbackSlug(normalizedTitle, article.id);
    const normalizedUrl =
      article.url?.trim() || this.getInternalArticleEditorUrl(article.id);
    const pageStatus = this.toPageStatus(article.status);

    return this.prisma.$transaction(async (tx) => {
      await (tx as any).page.updateMany({
        where: {
          clusterId,
          seoRole: 'PILLAR',
          NOT: {
            OR: [{ url: normalizedUrl }, { slug: normalizedSlug }],
          },
        },
        data: {
          seoRole: 'SATELLITE',
        },
      });

      const existingPage = await (tx as any).page.findFirst({
        where: {
          clusterId,
          OR: [{ url: normalizedUrl }, { slug: normalizedSlug }],
        },
      });

      if (existingPage) {
        return (tx as any).page.update({
          where: { id: existingPage.id },
          data: {
            title: normalizedTitle,
            slug: normalizedSlug,
            url: normalizedUrl,
            status: pageStatus,
            pageType: 'BLOG_ARTICLE',
            seoRole: 'PILLAR',
          },
        });
      }

      return (tx as any).page.create({
        data: {
          clusterId,
          title: normalizedTitle,
          slug: normalizedSlug,
          url: normalizedUrl,
          status: pageStatus,
          pageType: 'BLOG_ARTICLE',
          seoRole: 'PILLAR',
        },
      });
    });
  }

  async createPillarArticle(clusterId: string) {
    const cluster = await (this.prisma as any).seoCluster.findFirst({
      where: { id: clusterId, trashedAt: null },
    });

    if (!cluster) {
      throw new NotFoundException(`SeoCluster ${clusterId} not found`);
    }

    const baseTitle = `Pilier ${cluster.name}`.trim();

    return this.prisma.$transaction(async (tx) => {
      const article = await (tx as any).blogArticle.create({
        data: {
          title: baseTitle || 'Sans titre',
          slug: this.buildUniqueDraftSlug(baseTitle || 'sans-titre'),
          status: 'DRAFT',
          seoClusterId: clusterId,
          content: '',
        },
        include: {
          blog: true,
          seoCluster: true,
          author: true,
        },
      });

      await (tx as any).page.updateMany({
        where: {
          seoClusterId: clusterId,
          seoRole: 'PILLAR',
        },
        data: {
          seoRole: 'SATELLITE',
        },
      });

      await (tx as any).page.create({
        data: {
          seoClusterId: clusterId,
          title: article.title,
          slug:
            article.slug || this.buildFallbackSlug(article.title, article.id),
          url: this.getInternalArticleEditorUrl(article.id),
          status: 'DRAFT',
          pageType: 'BLOG_ARTICLE',
          seoRole: 'PILLAR',
        },
      });

      return article;
    });
  }

  async suggestClusterForKeywordGroup(
    keywordGroupId: string,
    projectId: string,
  ) {
    const normalizedKeywordGroupId = keywordGroupId.trim();

    if (!normalizedKeywordGroupId) {
      throw new BadRequestException('KeywordGroup invalide.');
    }

    const [keywordGroup, clusters, promptConfig] = await Promise.all([
      (this.prisma as any).keywordGroup.findFirst({
        where: {
          id: normalizedKeywordGroupId,
          projectId,
          trashedAt: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          primaryKeyword: true,
          projectId: true,
          seoClusterId: true,
        },
      }),
      (this.prisma as any).seoCluster.findMany({
        where: {
          trashedAt: null,
          projectId,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: [{ name: 'asc' }],
      }) as Promise<SeoClusterSuggestionCandidate[]>,
      this.promptConfigsService.getSeoClusterSuggestionPrompt(),
    ]);

    if (!keywordGroup) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedKeywordGroupId} not found`,
      );
    }

    if (!clusters.length) {
      return {
        keywordGroup: {
          id: keywordGroup.id,
          name: keywordGroup.name,
          description: keywordGroup.description ?? null,
          primaryKeyword: keywordGroup.primaryKeyword ?? null,
        },
        suggestedClusterId: null,
        suggestedCluster: null,
        reason: 'Aucun cluster disponible.',
        responseId: null,
        usage: null,
      };
    }

    if (!this.openAiPlatformService.isConfigured()) {
      throw new BadRequestException(
        'OpenAI n’est pas configuré pour suggérer un cluster.',
      );
    }

    const clusterLines = clusters
      .map((cluster: SeoClusterSuggestionCandidate) =>
        [
          `- [${cluster.id}] ${cluster.name.trim()}`,
          cluster.description?.trim()
            ? `description: ${cluster.description.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');

    const response = await this.openAiPlatformService.createResponse({
      model:
        promptConfig.model ||
        process.env.OPENAI_SEO_CLUSTER_SUGGESTION_MODEL ||
        'gpt-4.1-mini',
      promptType: 'SEO_CLUSTER_SUGGESTION',
      instructions: promptConfig.instructions,
      input: this.interpolatePromptTemplate(promptConfig.input, {
        keywordGroupName: keywordGroup.name.trim(),
        keywordGroupDescription: keywordGroup.description?.trim() ?? '',
        clusters: clusterLines,
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'seo_cluster_suggestion',
          strict: true,
          schema: SEO_CLUSTER_SUGGESTION_OPENAI_JSON_SCHEMA,
        },
      },
      max_output_tokens: promptConfig.maxOutputTokens,
    });

    let parsed: SeoClusterSuggestionResponse;

    try {
      parsed = parseStructuredOpenAiResponse(
        response,
        seoClusterSuggestionResponseSchema,
      ) as SeoClusterSuggestionResponse;
    } catch (error) {
      console.warn(
        '[SeoCluster suggestion] parse failed',
        error instanceof Error ? error.message : error,
      );

      return {
        keywordGroup: {
          id: keywordGroup.id,
          name: keywordGroup.name,
          description: keywordGroup.description ?? null,
          primaryKeyword: keywordGroup.primaryKeyword ?? null,
        },
        suggestedClusterId: null,
        suggestedCluster: null,
        reason: 'La suggestion OpenAI est invalide.',
        responseId: response.id,
        usage: response.usage ?? null,
      };
    }

    const suggestedCluster = parsed.suggestedClusterId
      ? (clusters.find(
          (cluster: SeoClusterSuggestionCandidate) =>
            cluster.id === parsed.suggestedClusterId,
        ) ?? null)
      : null;

    return {
      keywordGroup: {
        id: keywordGroup.id,
        name: keywordGroup.name,
        description: keywordGroup.description ?? null,
        primaryKeyword: keywordGroup.primaryKeyword ?? null,
      },
      suggestedClusterId: suggestedCluster?.id ?? null,
      suggestedCluster,
      reason: parsed.reason,
      responseId: response.id,
      usage: response.usage ?? null,
    };
  }

  async clearPillar(clusterId: string) {
    await this.findOne(clusterId);

    await (this.prisma as any).page.updateMany({
      where: {
        clusterId,
        seoRole: 'PILLAR',
      },
      data: {
        seoRole: 'SUPPORT',
      },
    });

    return {
      success: true,
    };
  }

  async remove(clusterId: string) {
    await this.findOne(clusterId);

    return (this.prisma as any).seoCluster.update({
      where: { id: clusterId },
      data: { trashedAt: new Date() },
    });
  }

  private buildProjectScopedWhere(projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      return {
        trashedAt: null,
      };
    }

    return {
      trashedAt: null,
      OR: [
        {
          projectId: normalizedProjectId,
        },
        {
          projectId: null,
          OR: [
            {
              keywordGroups: {
                some: {
                  projectId: normalizedProjectId,
                  trashedAt: null,
                },
              },
            },
            {
              pages: {
                some: {
                  projectId: normalizedProjectId,
                  trashedAt: null,
                },
              },
            },
            {
              blogArticles: {
                some: {
                  projectId: normalizedProjectId,
                  trashedAt: null,
                },
              },
            },
          ],
        },
      ],
    };
  }

  private isClusterScopedToProject(
    cluster: {
      projectId?: string | null;
      keywordGroups?: Array<{ projectId?: string | null }>;
      pages?: Array<{ projectId?: string | null }>;
      blogArticles?: Array<{ projectId?: string | null }>;
    },
    projectId: string,
  ) {
    if (cluster.projectId === projectId) {
      return true;
    }

    if (cluster.projectId && cluster.projectId !== projectId) {
      return false;
    }

    return Boolean(
      cluster.keywordGroups?.some(
        (keywordGroup) => keywordGroup.projectId === projectId,
      ) ||
      cluster.pages?.some((page) => page.projectId === projectId) ||
      cluster.blogArticles?.some(
        (blogArticle) => blogArticle.projectId === projectId,
      ),
    );
  }

  private toPersistenceData(
    dto: (CreateSeoClusterDto | UpdateSeoClusterDto) & {
      projectId?: string | null;
    },
  ): Record<string, string | boolean | null> {
    const trimmedName = dto.name?.trim();

    return {
      ...(dto.name !== undefined ? { name: trimmedName } : {}),
      ...(dto.parentClusterId !== undefined
        ? { parentClusterId: this.toNullableTrimmed(dto.parentClusterId) }
        : {}),
      ...(dto.pillarKeywordGroupId !== undefined
        ? {
            pillarKeywordGroupId: this.toNullableTrimmed(
              dto.pillarKeywordGroupId,
            ),
          }
        : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
      ...(dto.icon !== undefined
        ? { icon: this.toNullableTrimmed(dto.icon) }
        : {}),
      ...(dto.isFavorite !== undefined ? { isFavorite: dto.isFavorite } : {}),
      ...(dto.isSprintCluster !== undefined
        ? { isSprintCluster: dto.isSprintCluster }
        : {}),
      ...(dto.name !== undefined ? { topic: trimmedName } : {}),
      ...(dto.description !== undefined
        ? { description: this.toNullableTrimmed(dto.description) }
        : {}),
      ...(dto.primaryKeyword !== undefined
        ? { primaryKeyword: dto.primaryKeyword.trim() }
        : {}),
      ...(dto.projectId !== undefined
        ? { projectId: this.toNullableTrimmed(dto.projectId) }
        : {}),
      ...(dto.notes !== undefined
        ? { notes: this.toNullableTrimmed(dto.notes) }
        : {}),
    };
  }

  private toNullableTrimmed(value?: string | null) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }

  private interpolatePromptTemplate(
    template: string,
    values: Record<string, string>,
  ) {
    return Object.entries(values).reduce(
      (accumulator, [key, value]) =>
        accumulator.replaceAll(`{{${key}}}`, value ?? ''),
      template,
    );
  }

  private async resolvePillarKeywordGroup(
    tx: unknown,
    pillarKeywordGroupId: string | null | undefined,
    isRequired: boolean,
  ) {
    const normalizedPillarKeywordGroupId =
      this.toNullableTrimmed(pillarKeywordGroupId);

    if (!normalizedPillarKeywordGroupId) {
      if (isRequired) {
        throw new BadRequestException(
          'Un KeywordGroup pilier est requis pour créer un cluster.',
        );
      }

      return null;
    }

    const keywordGroup = await (tx as any).keywordGroup.findFirst({
      where: {
        id: normalizedPillarKeywordGroupId,
        trashedAt: null,
      },
      select: {
        id: true,
        name: true,
        primaryKeyword: true,
        projectId: true,
      },
    });

    if (!keywordGroup) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedPillarKeywordGroupId} not found`,
      );
    }

    if (!keywordGroup.primaryKeyword?.trim()) {
      throw new BadRequestException(
        `Le KeywordGroup ${keywordGroup.name} n'a pas de mot-clé principal.`,
      );
    }

    return keywordGroup;
  }

  private resolveClusterSlug(
    dto: CreateSeoClusterDto | UpdateSeoClusterDto,
    pillarKeywordGroup: {
      id: string;
      name: string;
      primaryKeyword: string;
      projectId?: string | null;
    } | null,
    fallbackSlug?: string | null,
  ) {
    if (pillarKeywordGroup) {
      return this.toSlug(pillarKeywordGroup.primaryKeyword);
    }

    const normalizedSlug = dto.slug?.trim();

    if (normalizedSlug) {
      return normalizedSlug;
    }

    return fallbackSlug?.trim() || null;
  }

  private toSlug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async syncChildClusters(
    tx: unknown,
    clusterId: string,
    desiredChildClusterIds: string[],
  ) {
    const normalizedDesiredChildClusterIds = [
      ...new Set(
        desiredChildClusterIds
          .map((childClusterId) => childClusterId.trim())
          .filter(Boolean),
      ),
    ];

    if (!normalizedDesiredChildClusterIds.length) {
      await (tx as any).seoCluster.updateMany({
        where: {
          parentClusterId: clusterId,
        },
        data: {
          parentClusterId: null,
        },
      });

      return;
    }

    const allClusters = await (tx as any).seoCluster.findMany({
      where: { trashedAt: null },
      select: {
        id: true,
        parentClusterId: true,
      },
    });

    const forbiddenChildClusterIds = new Set<string>([
      clusterId,
      ...this.getAncestorClusterIds(clusterId, allClusters),
    ]);

    const selectedClusterIds = normalizedDesiredChildClusterIds.filter(
      (childClusterId) => !forbiddenChildClusterIds.has(childClusterId),
    );

    if (selectedClusterIds.length !== normalizedDesiredChildClusterIds.length) {
      throw new BadRequestException(
        'Un cluster enfant ne peut pas être lui-même ni un de ses ancêtres.',
      );
    }

    const currentChildClusters = await (tx as any).seoCluster.findMany({
      where: {
        trashedAt: null,
        parentClusterId: clusterId,
      },
      select: {
        id: true,
      },
    });

    const currentChildClusterIds = currentChildClusters.map(
      (childCluster: { id: string }) => childCluster.id,
    );
    const desiredChildClusterIdSet = new Set(selectedClusterIds);
    const childClusterIdsToDetach = currentChildClusterIds.filter(
      (childClusterId: string) => !desiredChildClusterIdSet.has(childClusterId),
    );

    if (childClusterIdsToDetach.length) {
      await (tx as any).seoCluster.updateMany({
        where: {
          id: {
            in: childClusterIdsToDetach,
          },
          parentClusterId: clusterId,
        },
        data: {
          parentClusterId: null,
        },
      });
    }

    if (selectedClusterIds.length) {
      await (tx as any).seoCluster.updateMany({
        where: {
          id: {
            in: selectedClusterIds,
          },
          trashedAt: null,
        },
        data: {
          parentClusterId: clusterId,
        },
      });
    }
  }

  private async syncSecondaryKeywordGroups(
    tx: unknown,
    clusterId: string,
    desiredSecondaryKeywordGroupIds: string[],
    pillarKeywordGroupId: string | null,
  ) {
    const normalizedDesiredSecondaryKeywordGroupIds = [
      ...new Set(
        desiredSecondaryKeywordGroupIds
          .map((keywordGroupId) => keywordGroupId.trim())
          .filter(Boolean),
      ),
    ].filter((keywordGroupId) => keywordGroupId !== pillarKeywordGroupId);

    const currentSecondaryKeywordGroups = await (
      tx as any
    ).keywordGroup.findMany({
      where: {
        trashedAt: null,
        seoClusterId: clusterId,
      },
      select: {
        id: true,
      },
    });

    const currentSecondaryKeywordGroupIds = currentSecondaryKeywordGroups.map(
      (keywordGroup: { id: string }) => keywordGroup.id,
    );

    const desiredSecondaryKeywordGroupIdSet = new Set(
      normalizedDesiredSecondaryKeywordGroupIds,
    );
    const keywordGroupIdsToDetach = currentSecondaryKeywordGroupIds.filter(
      (keywordGroupId: string) =>
        !desiredSecondaryKeywordGroupIdSet.has(keywordGroupId),
    );

    if (keywordGroupIdsToDetach.length) {
      await (tx as any).keywordGroup.updateMany({
        where: {
          id: {
            in: keywordGroupIdsToDetach,
          },
          seoClusterId: clusterId,
        },
        data: {
          seoClusterId: null,
        },
      });
    }

    if (normalizedDesiredSecondaryKeywordGroupIds.length) {
      await (tx as any).keywordGroup.updateMany({
        where: {
          id: {
            in: normalizedDesiredSecondaryKeywordGroupIds,
          },
          trashedAt: null,
        },
        data: {
          seoClusterId: clusterId,
        },
      });
    }
  }

  private getAncestorClusterIds(
    clusterId: string,
    clusters: Array<{
      id: string;
      parentClusterId: string | null;
    }>,
  ) {
    const clustersById = new Map(
      clusters.map((cluster) => [cluster.id, cluster] as const),
    );
    const ancestorClusterIds: string[] = [];
    let currentParentId = clustersById.get(clusterId)?.parentClusterId ?? null;

    while (currentParentId) {
      ancestorClusterIds.push(currentParentId);
      currentParentId =
        clustersById.get(currentParentId)?.parentClusterId ?? null;
    }

    return ancestorClusterIds;
  }

  private toPageStatus(status?: string | null) {
    switch (status) {
      case 'IDEA':
      case 'DRAFT':
      case 'PLANNED':
      case 'READY_TO_PUBLISH':
      case 'PUSHED':
      case 'PUBLISHED':
      case 'ARCHIVED':
        return status;
      default:
        return 'DRAFT';
    }
  }

  private buildFallbackSlug(title: string, id: string) {
    const normalizedTitle = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return normalizedTitle || `article-${id.slice(-8)}`;
  }

  private buildUniqueDraftSlug(title: string) {
    return `${this.buildFallbackSlug(title, 'draft')}-${Date.now().toString(36)}`;
  }

  private getInternalArticleEditorUrl(articleId: string) {
    const appUrl = process.env.NUXT_WEB_URL?.trim() || 'http://localhost:3000';

    return `${appUrl.replace(/\/$/, '')}/articles/${articleId}`;
  }

  private getDescendantClusterIds(
    clusterId: string,
    clusters: Array<{
      id: string;
      parentClusterId: string | null;
    }>,
  ) {
    const childrenByParentId = new Map<string, string[]>();

    for (const cluster of clusters) {
      if (!cluster.parentClusterId) {
        continue;
      }

      const children = childrenByParentId.get(cluster.parentClusterId) ?? [];
      children.push(cluster.id);
      childrenByParentId.set(cluster.parentClusterId, children);
    }

    const descendantIds: string[] = [];
    const queue = [...(childrenByParentId.get(clusterId) ?? [])];

    while (queue.length) {
      const currentClusterId = queue.shift();

      if (!currentClusterId) {
        continue;
      }

      descendantIds.push(currentClusterId);
      queue.push(...(childrenByParentId.get(currentClusterId) ?? []));
    }

    return descendantIds;
  }

  private getParentClusters(
    cluster: {
      parentClusterId?: string | null;
    },
    clusters: Array<{
      id: string;
      parentClusterId: string | null;
      name: string;
      slug: string | null;
    }>,
  ) {
    const clustersById = new Map(
      clusters.map((item) => [item.id, item] as const),
    );
    const parentClusters: Array<{
      id: string;
      name: string;
      slug: string | null;
    }> = [];
    let currentParentId = cluster.parentClusterId ?? null;

    while (currentParentId) {
      const currentParent = clustersById.get(currentParentId);

      if (!currentParent) {
        break;
      }

      parentClusters.unshift({
        id: currentParent.id,
        name: currentParent.name,
        slug: currentParent.slug,
      });
      currentParentId = currentParent.parentClusterId;
    }

    return parentClusters;
  }
}
