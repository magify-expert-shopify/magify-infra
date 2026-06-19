import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PageStatus, PageType, SeoRole } from 'src/common/types/prisma-enums';
import { PrismaService } from '../../prisma/prisma.service';
import { BlogArticlesService } from '../blog-articles/blog-articles.service';
import { BlogArticleSuggestionGenerationService } from '../blog-articles/blog-article-suggestion-generation.service';
import { ShopifyService } from '../shopify/shopify.service';
import type {
  AssociateExistingPageInput,
  CreateFromSuggestionInput,
  EditorialPageType,
  PageUpdateInput,
  RebuildBlogArticlePageUrlsResult,
  StoredSuggestionPlanRecord,
  SuggestionCreationContext,
  SuggestionGroup,
  SuggestionKeyword,
} from './pages.types';

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogArticlesService: BlogArticlesService,
    private readonly blogArticleSuggestionGenerationService: BlogArticleSuggestionGenerationService,
    private readonly shopifyService: ShopifyService,
  ) {}

  private readonly editorialPageTypes = [
    PageType.BLOG_ARTICLE,
    PageType.TUTORIAL,
    PageType.GUIDE,
    PageType.DEFINITION,
  ] as EditorialPageType[];

  private serializeKeywordGroupAssignmentFields(group: {
    assignment?: {
      supabaseUserId?: string | null;
      assignedAt?: Date | null;
      supabaseUser?: {
        id?: string | null;
        email?: string | null;
        displayName?: string | null;
      } | null;
    } | null;
  }) {
    return {
      assignedSupabaseUserId:
        group.assignment?.supabaseUser?.id ??
        group.assignment?.supabaseUserId ??
        null,
      assignedSupabaseUserEmail:
        group.assignment?.supabaseUser?.email?.trim() ?? null,
      assignedSupabaseUserName:
        group.assignment?.supabaseUser?.displayName?.trim() ?? null,
      assignedSupabaseAssignedAt:
        group.assignment?.assignedAt?.toISOString() ?? null,
    };
  }

  async listPages(projectId: string) {
    const pages = await (this.prisma as any).page.findMany({
      where: { trashedAt: null, projectId },
      select: {
        id: true,
        title: true,
        url: true,
        slug: true,
        status: true,
        pageType: true,
        seoRole: true,
        searchIntent: true,
        seoCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            keywords: true,
          },
        },
        keywords: {
          where: {
            trashedAt: null,
            keywordGroup: {
              isNot: null,
            },
          },
          select: {
            keywordGroup: {
              select: {
                keywordGroupAssignment: {
                  include: {
                    supabaseUser: {
                      select: {
                        id: true,
                        email: true,
                        displayName: true,
                      },
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
        blogArticle: {
          select: {
            id: true,
            title: true,
            reviewSupabaseUserId: true,
            reviewAssignedAt: true,
            reviewDueAt: true,
            reviewCompletedAt: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return pages.map((page: any) => {
      const keywordGroup = page.keywords?.[0]?.keywordGroup ?? null;

      return {
        ...page,
        ...this.serializeKeywordGroupAssignmentFields(keywordGroup ?? {}),
        keywords: undefined,
      };
    });
  }

  async findOne(pageId: string, projectId: string, client: any = this.prisma) {
    const page = await client.page.findFirst({
      where: {
        id: pageId,
        projectId,
        trashedAt: null,
      },
      include: {
        seoCluster: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        keywords: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            keyword: true,
            template: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            pageId: true,
            keywordGroup: {
              select: {
                id: true,
                name: true,
                primaryKeyword: true,
                description: true,
              },
            },
          },
          orderBy: [{ keyword: 'asc' }],
        },
        pagePlan: {
          select: {
            id: true,
            keywordGroupId: true,
            pageId: true,
            projectId: true,
            pageType: true,
            subjectExact: true,
            primaryKeyword: true,
            secondaryKeywords: true,
            target: true,
            conversionObjective: true,
            approxLength: true,
            plan: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }

    const blogArticle = await (client as any).blogArticle.findFirst({
      where: {
        pageId: page.id,
        trashedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        url: true,
        status: true,
        excerpt: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        primaryKeyword: true,
        requiredKeywords: true,
        reviewSupabaseUserId: true,
        reviewAssignedAt: true,
        reviewDueAt: true,
        reviewCompletedAt: true,
        reviewOutcome: true,
        reviewComment: true,
      },
    });

    const blogArticleGenerationJob =
      await this.blogArticleSuggestionGenerationService.getJobSnapshotForPage(
        pageId,
      );

    return {
      ...page,
      blogArticle,
      blogArticleGenerationJob,
    };
  }

  async updatePage(pageId: string, input: PageUpdateInput) {
    const page = await (this.prisma as any).page.findFirst({
      where: {
        id: pageId,
        trashedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        slug: true,
        status: true,
        clusterId: true,
      },
    });

    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }

    const normalizedTitle =
      input.title !== undefined && input.title !== null
        ? input.title.trim()
        : undefined;
    const normalizedSlug =
      input.slug !== undefined ? this.toNullableTrimmed(input.slug) : undefined;

    if (normalizedTitle !== undefined && !normalizedTitle) {
      throw new BadRequestException('Le titre de la page est requis.');
    }

    if (input.clusterId !== undefined) {
      const normalizedClusterId = this.toNullableTrimmed(input.clusterId);

      if (normalizedClusterId) {
        const cluster = await (this.prisma as any).seoCluster.findFirst({
          where: {
            id: normalizedClusterId,
            trashedAt: null,
          },
          select: {
            id: true,
          },
        });

        if (!cluster) {
          throw new NotFoundException(
            `SeoCluster ${normalizedClusterId} not found`,
          );
        }
      }
    }

    await (this.prisma as any).page.update({
      where: { id: pageId },
      data: {
        ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
        ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
        ...(input.status !== undefined
          ? { status: this.toPageStatus(input.status) }
          : {}),
        ...(input.clusterId !== undefined
          ? { clusterId: this.toNullableTrimmed(input.clusterId) }
          : {}),
      },
    });
    return this.findOne(pageId, page.projectId ?? '');
  }

  async deletePage(pageId: string) {
    const page = await (this.prisma as any).page.findFirst({
      where: {
        id: pageId,
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      await (tx as any).keyword.updateMany({
        where: {
          pageId,
        },
        data: {
          pageId: null,
        },
      });

      return (tx as any).page.update({
        where: { id: pageId },
        data: {
          trashedAt: new Date(),
        },
      });
    });
  }

  async rebuildBlogArticlePageUrls(
    projectId: string,
  ): Promise<RebuildBlogArticlePageUrlsResult> {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      throw new BadRequestException('Le projectId est requis.');
    }

    const project = await (this.prisma as any).project.findFirst({
      where: {
        id: normalizedProjectId,
      },
      select: {
        shopifyStoreDomain: true,
      },
    });
    const storeDomain = project?.shopifyStoreDomain?.trim() || '';

    if (!storeDomain) {
      throw new BadRequestException(
        'Le projet doit être lié à une boutique Shopify pour régénérer les URLs.',
      );
    }

    const pages = await (this.prisma as any).page.findMany({
      where: {
        projectId: normalizedProjectId,
        trashedAt: null,
        blogArticle: {
          isNot: null,
        },
      },
      select: {
        id: true,
        url: true,
        blogArticle: {
          select: {
            slug: true,
            blog: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    let updatedCount = 0;
    let skippedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const page of pages as Array<{
        id: string;
        url?: string | null;
        blogArticle?: {
          slug?: string | null;
          blog?: {
            slug?: string | null;
          } | null;
        } | null;
      }>) {
        const blogHandle = page.blogArticle?.blog?.slug?.trim() || '';
        const articleHandle = page.blogArticle?.slug?.trim() || '';

        console.log('blogHandle', page.blogArticle?.blog);
        console.log('articleHandle', articleHandle);

        if (!blogHandle || !articleHandle) {
          skippedCount += 1;
          continue;
        }

        const nextUrl = `https://${storeDomain}/blogs/${blogHandle}/${articleHandle}`;

        if ((page.url ?? '').trim() === nextUrl) {
          skippedCount += 1;
          continue;
        }

        await (tx as any).page.update({
          where: {
            id: page.id,
          },
          data: {
            url: nextUrl,
          },
        });
        updatedCount += 1;
      }
    });

    console.log('pages', pages);

    return {
      totalCount: pages.length,
      updatedCount,
      skippedCount,
    };
  }

  async createFromSuggestion(
    groupId: string,
    input?: CreateFromSuggestionInput | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );

    const articleTitle =
      context.articleBrief.subjectExact ||
      context.group.primaryKeyword?.trim() ||
      context.matchingKeywords[0]?.keyword?.trim() ||
      context.group.name.trim();
    const slug = this.buildSlug(articleTitle);
    const searchIntent = context.matchingKeywords[0]?.searchIntent ?? null;
    const storedPlan = context.articleBrief.plan?.trim()
      ? context.articleBrief.plan.trim()
      : await this.getStoredPlanText(
          context.normalizedGroupId,
          context.group.projectId ?? context.normalizedProjectId ?? null,
        );

    const suggestionArticleGenerationPayload = {
      group: {
        id: context.group.id,
        name: context.group.name,
        primaryKeyword: context.group.primaryKeyword,
        description: context.group.description,
        keywords: context.group.keywords,
      },
      pageType: context.targetPageType,
      keywords: context.matchingKeywords,
      articleBrief: {
        ...context.articleBrief,
        secondaryKeywords: [...context.articleBrief.secondaryKeywords],
      },
    } satisfies Parameters<
      BlogArticlesService['generateBlogArticleDraftFromSuggestion']
    >[0];

    const createdPage = await this.prisma.$transaction(
      async (tx) => {
        const clusterId = await this.resolveSuggestionClusterId(
          tx,
          context.group.seoClusterId ?? null,
          context.group.projectId ?? context.normalizedProjectId ?? null,
        );
        const freshKeywords = (await (tx as any).keyword.findMany({
          where: {
            id: {
              in: context.matchingKeywordIds,
            },
            trashedAt: null,
            pageId: null,
            template: context.targetPageType,
          },
          select: {
            id: true,
          },
        })) as Array<{ id: string }>;

        if (freshKeywords.length !== context.matchingKeywordIds.length) {
          throw new BadRequestException(
            'Les suggestions ont changé pendant la génération. Recharge la page puis réessaie.',
          );
        }

        const url = await this.buildUniquePageUrl(slug, tx);
        const page = await (tx as any).page.create({
          data: {
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            clusterId,
            title: articleTitle,
            slug,
            url,
            status: 'DRAFT',
            pageType: context.targetPageType,
            seoRole: SeoRole.SUPPORT,
            searchIntent,
          },
        });

        if (storedPlan) {
          await this.upsertSuggestionPlan(tx, {
            keywordGroupId: context.normalizedGroupId,
            pageId: page.id,
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            pageType: context.targetPageType,
            subjectExact: context.articleBrief.subjectExact,
            primaryKeyword: context.articleBrief.primaryKeyword,
            secondaryKeywords:
              context.articleBrief.secondaryKeywords.join(', '),
            target: context.articleBrief.target,
            conversionObjective: context.articleBrief.conversionObjective,
            approxLength: context.articleBrief.approxLength,
            plan: storedPlan,
          });
        }

        await (tx as any).keyword.updateMany({
          where: {
            id: {
              in: context.matchingKeywordIds,
            },
          },
          data: {
            pageId: page.id,
            template: context.targetPageType,
          },
        });

        return this.findOne(
          page.id,
          context.group.projectId ?? context.normalizedProjectId ?? '',
          tx,
        );
      },
      {
        timeout: 300_000,
        maxWait: 300_000,
      },
    );

    await this.scheduleSuggestionArticleGeneration({
      pageId: createdPage.id,
      pageUrl: createdPage.url ?? '',
      projectId: context.group.projectId ?? context.normalizedProjectId ?? null,
      clusterId: createdPage.cluster?.id ?? null,
      payload: suggestionArticleGenerationPayload,
    });

    return createdPage;
  }

  async regenerateArticleFromPage(pageId: string, projectId: string) {
    const page = await this.findOne(pageId, projectId);

    if (!this.isEditorialTemplate(page.pageType)) {
      throw new BadRequestException(
        "Cette page n'a pas de type éditorial compatible avec la génération d'article.",
      );
    }

    const payload = this.buildSuggestionArticleGenerationPayload(page);

    await this.blogArticleSuggestionGenerationService.enqueueGeneration({
      pageId: page.id,
      pageUrl: page.url ?? '',
      projectId: page.projectId ?? null,
      clusterId: page.cluster?.id ?? null,
      payload,
    });

    return this.findOne(pageId, projectId);
  }

  async createBlankFromSuggestion(
    groupId: string,
    input?: Pick<CreateFromSuggestionInput, 'pageType'> | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );

    const pageTitle =
      context.articleBrief.subjectExact.trim() ||
      context.articleBrief.primaryKeyword.trim() ||
      context.matchingKeywords[0]?.keyword?.trim() ||
      context.group.name.trim();
    const slug = this.buildSlug(pageTitle);
    const searchIntent = context.matchingKeywords[0]?.searchIntent ?? null;

    return this.prisma.$transaction(
      async (tx) => {
        const clusterId = await this.resolveSuggestionClusterId(
          tx,
          context.group.seoClusterId ?? null,
          context.group.projectId ?? context.normalizedProjectId ?? null,
        );
        const freshKeywords = (await (tx as any).keyword.findMany({
          where: {
            id: {
              in: context.matchingKeywordIds,
            },
            trashedAt: null,
            pageId: null,
            template: context.targetPageType,
          },
          select: {
            id: true,
          },
        })) as Array<{ id: string }>;

        if (freshKeywords.length !== context.matchingKeywordIds.length) {
          throw new BadRequestException(
            'Les suggestions ont changé pendant la génération. Recharge la page puis réessaie.',
          );
        }

        const url = await this.buildUniquePageUrl(slug, tx);
        const page = await (tx as any).page.create({
          data: {
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            clusterId,
            title: pageTitle,
            slug,
            url,
            status: 'DRAFT',
            pageType: context.targetPageType,
            seoRole: SeoRole.SUPPORT,
            searchIntent,
          },
        });

        const existingPlan = await this.findStoredSuggestionPlan(
          context.normalizedGroupId,
          context.group.projectId ?? context.normalizedProjectId ?? null,
          tx,
        );

        if (existingPlan) {
          await this.upsertSuggestionPlan(tx, {
            keywordGroupId: context.normalizedGroupId,
            pageId: page.id,
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            pageType: existingPlan.pageType,
            subjectExact: existingPlan.subjectExact,
            primaryKeyword: existingPlan.primaryKeyword,
            secondaryKeywords: existingPlan.secondaryKeywords ?? '',
            target: existingPlan.target,
            conversionObjective: existingPlan.conversionObjective,
            approxLength: existingPlan.approxLength,
            plan: existingPlan.plan,
          });
        }

        const blankDraft: Parameters<
          BlogArticlesService['createFromSuggestionDraft']
        >[0]['draft'] = {
          title: pageTitle,
          slug,
          excerpt: '',
          content: '',
          primaryKeyword: context.articleBrief.primaryKeyword.trim(),
          requiredKeywords: [
            context.articleBrief.primaryKeyword.trim(),
            ...context.articleBrief.secondaryKeywords,
          ]
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          seoTitle: pageTitle,
          seoDescription: '',
        };

        await this.blogArticlesService.createFromSuggestionDraft(
          {
            pageId: page.id,
            pageUrl: page.url,
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            clusterId,
            draft: blankDraft,
          },
          tx,
        );

        await (tx as any).keyword.updateMany({
          where: {
            id: {
              in: context.matchingKeywordIds,
            },
          },
          data: {
            pageId: page.id,
            template: context.targetPageType,
          },
        });

        return this.findOne(
          page.id,
          context.group.projectId ?? context.normalizedProjectId ?? '',
          tx,
        );
      },
      {
        timeout: 120_000,
        maxWait: 120_000,
      },
    );
  }

  async associateExistingPageFromSuggestion(
    groupId: string,
    input?: AssociateExistingPageInput | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );
    const normalizedPageId = this.toNullableTrimmed(input?.pageId);
    const normalizedShopifyPageId = this.toNullableTrimmed(
      input?.shopifyPageId,
    );
    const normalizedBlogArticleId = this.toNullableTrimmed(
      input?.blogArticleId,
    );
    const normalizedShopifyArticleId = this.toNullableTrimmed(
      input?.shopifyArticleId,
    );
    const normalizedShopifyTitle = input?.title?.trim() || '';
    const normalizedShopifyHandle = input?.handle?.trim() || '';

    if (
      !normalizedPageId &&
      !normalizedShopifyPageId &&
      !normalizedBlogArticleId &&
      !normalizedShopifyArticleId
    ) {
      throw new BadRequestException(
        'Une page ou un article existant doit être sélectionné.',
      );
    }

    if (
      normalizedShopifyPageId &&
      (!normalizedShopifyTitle || !normalizedShopifyHandle)
    ) {
      throw new BadRequestException(
        'Les informations Shopify de la page sélectionnée sont incomplètes.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const clusterId = await this.resolveSuggestionClusterId(
        tx,
        context.group.seoClusterId ?? null,
        context.group.projectId ?? context.normalizedProjectId ?? null,
      );
      const freshKeywords = (await (tx as any).keyword.findMany({
        where: {
          id: {
            in: context.matchingKeywordIds,
          },
          trashedAt: null,
          pageId: null,
          template: context.targetPageType,
        },
        select: {
          id: true,
        },
      })) as Array<{ id: string }>;

      if (!freshKeywords.length) {
        throw new BadRequestException(
          'Cette suggestion n’a plus de mots-clés disponibles à associer.',
        );
      }

      let pageId = normalizedPageId;

      if (pageId) {
        const existingPage = await (tx as any).page.findFirst({
          where: {
            id: pageId,
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            trashedAt: null,
          },
          select: {
            id: true,
            pageType: true,
            clusterId: true,
          },
        });

        if (!existingPage) {
          throw new NotFoundException(`Page ${pageId} not found`);
        }

        await (tx as any).page.update({
          where: { id: pageId },
          data: {
            ...(existingPage.pageType === PageType.OTHER
              ? { pageType: context.targetPageType }
              : {}),
            ...(!existingPage.clusterId && clusterId ? { clusterId } : {}),
          },
        });
      } else if (normalizedBlogArticleId) {
        const existingArticle = await (tx as any).blogArticle.findFirst({
          where: {
            id: normalizedBlogArticleId,
            projectId:
              context.group.projectId ?? context.normalizedProjectId ?? null,
            trashedAt: null,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            url: true,
            status: true,
            pageId: true,
            clusterId: true,
          },
        });

        if (!existingArticle) {
          throw new NotFoundException(
            `Blog article ${normalizedBlogArticleId} not found`,
          );
        }

        pageId = await this.createPageFromAssociatedBlogArticle(
          tx,
          context,
          freshKeywords,
          clusterId,
          existingArticle,
          'Cet article de blog est déjà lié à une page.',
        );
      } else if (normalizedShopifyArticleId) {
        const normalizedProjectId =
          context.group.projectId ?? context.normalizedProjectId ?? '';
        const pulledArticle = await this.shopifyService.pullArticle(
          normalizedProjectId,
          normalizedShopifyArticleId,
        );

        pageId = await this.createPageFromAssociatedBlogArticle(
          tx,
          context,
          freshKeywords,
          clusterId,
          {
            id: pulledArticle.id,
            title: pulledArticle.title,
            slug: pulledArticle.slug,
            url: pulledArticle.url,
            status: pulledArticle.status,
            pageId: pulledArticle.pageId,
            clusterId: pulledArticle.clusterId,
          },
          'Cet article Shopify est déjà lié à une page.',
        );
      } else {
        const normalizedProjectId =
          context.group.projectId ?? context.normalizedProjectId ?? null;
        const shopifyPageUrl = await this.buildShopifyPageUrl(
          normalizedProjectId,
          normalizedShopifyHandle,
        );
        const existingShopifyMirror = await (tx as any).page.findFirst({
          where: {
            projectId: normalizedProjectId,
            url: shopifyPageUrl,
            trashedAt: null,
          },
          select: {
            id: true,
            clusterId: true,
          },
        });

        if (existingShopifyMirror) {
          pageId = existingShopifyMirror.id;

          await (tx as any).page.update({
            where: { id: pageId },
            data: {
              title: normalizedShopifyTitle,
              slug: normalizedShopifyHandle,
              status: PageStatus.PUBLISHED,
              pageType: context.targetPageType,
              ...(!existingShopifyMirror.clusterId && clusterId
                ? { clusterId }
                : {}),
            },
          });
        } else {
          const createdPage = await (tx as any).page.create({
            data: {
              projectId: normalizedProjectId,
              clusterId,
              title: normalizedShopifyTitle,
              slug: normalizedShopifyHandle,
              url: shopifyPageUrl,
              status: PageStatus.PUBLISHED,
              pageType: context.targetPageType,
              seoRole: SeoRole.SUPPORT,
              searchIntent: freshKeywords[0]
                ? (context.matchingKeywords.find(
                    (keyword) => keyword.id === freshKeywords[0]?.id,
                  )?.searchIntent ?? null)
                : null,
            },
          });

          pageId = createdPage.id;
        }
      }

      await (tx as any).keyword.updateMany({
        where: {
          id: {
            in: freshKeywords.map((keyword) => keyword.id),
          },
        },
        data: {
          pageId,
          template: context.targetPageType,
        },
      });

      const existingPlan = await this.findStoredSuggestionPlan(
        context.normalizedGroupId,
        context.group.projectId ?? context.normalizedProjectId ?? null,
        tx,
      );

      if (existingPlan && pageId) {
        await this.upsertSuggestionPlan(tx, {
          keywordGroupId: context.normalizedGroupId,
          pageId,
          projectId:
            context.group.projectId ?? context.normalizedProjectId ?? null,
          pageType: existingPlan.pageType,
          subjectExact: existingPlan.subjectExact,
          primaryKeyword: existingPlan.primaryKeyword,
          secondaryKeywords: existingPlan.secondaryKeywords ?? '',
          target: existingPlan.target,
          conversionObjective: existingPlan.conversionObjective,
          approxLength: existingPlan.approxLength,
          plan: existingPlan.plan,
        });
      }

      if (!pageId) {
        throw new BadRequestException(
          'Impossible de déterminer la page à associer.',
        );
      }

      return this.findOne(
        pageId,
        context.group.projectId ?? context.normalizedProjectId ?? '',
        tx,
      );
    });
  }

  async generatePlanFromSuggestion(
    groupId: string,
    input?: CreateFromSuggestionInput | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );

    const existingPlan = await this.findStoredSuggestionPlan(
      context.normalizedGroupId,
      context.group.projectId ?? context.normalizedProjectId ?? null,
    );

    if (
      existingPlan &&
      !input?.force &&
      this.doesStoredPlanMatchContext(existingPlan, context)
    ) {
      return this.serializeStoredSuggestionPlan(existingPlan);
    }

    const plan =
      await this.blogArticlesService.generateBlogArticlePlanFromSuggestion({
        group: context.group,
        pageType: context.targetPageType,
        keywords: context.matchingKeywords,
        articleBrief: context.articleBrief,
      });

    const storedPlan = await this.upsertSuggestionPlan(this.prisma, {
      keywordGroupId: context.normalizedGroupId,
      projectId: context.group.projectId ?? context.normalizedProjectId ?? null,
      pageType: context.targetPageType,
      subjectExact: context.articleBrief.subjectExact,
      primaryKeyword: context.articleBrief.primaryKeyword,
      secondaryKeywords: context.articleBrief.secondaryKeywords.join(', '),
      target: context.articleBrief.target,
      conversionObjective: context.articleBrief.conversionObjective,
      approxLength: context.articleBrief.approxLength,
      plan,
    });

    return this.serializeStoredSuggestionPlan(storedPlan);
  }

  async suggestSecondaryKeywordsFromSuggestion(
    groupId: string,
    input?: CreateFromSuggestionInput | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );

    const keywords =
      await this.blogArticlesService.suggestSecondaryKeywordsFromSuggestion({
        group: context.group,
        pageType: context.targetPageType,
        keywords: context.matchingKeywords,
        articleBrief: context.articleBrief,
      });

    return {
      keywords,
    };
  }

  async getStoredPlanFromSuggestion(groupId: string, projectId?: string) {
    const normalizedGroupId = groupId.trim();
    const normalizedProjectId = projectId?.trim() || null;
    const group = await (this.prisma as any).keywordGroup.findFirst({
      where: {
        id: normalizedGroupId,
        ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
        trashedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!group) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedGroupId} not found`,
      );
    }

    const storedPlan = await this.findStoredSuggestionPlan(
      normalizedGroupId,
      group.projectId ?? normalizedProjectId,
    );

    return storedPlan ? this.serializeStoredSuggestionPlan(storedPlan) : null;
  }

  async savePlanFromSuggestion(
    groupId: string,
    input?: CreateFromSuggestionInput | null,
    projectId?: string,
  ) {
    const context = await this.buildSuggestionCreationContext(
      groupId,
      input,
      projectId,
    );
    const normalizedPlan = input?.plan?.trim();

    if (!normalizedPlan) {
      throw new BadRequestException('Le plan est requis pour être sauvegardé.');
    }

    const storedPlan = await this.upsertSuggestionPlan(this.prisma, {
      keywordGroupId: context.normalizedGroupId,
      projectId: context.group.projectId ?? context.normalizedProjectId ?? null,
      pageType: context.targetPageType,
      subjectExact: context.articleBrief.subjectExact,
      primaryKeyword: context.articleBrief.primaryKeyword,
      secondaryKeywords: context.articleBrief.secondaryKeywords.join(', '),
      target: context.articleBrief.target,
      conversionObjective: context.articleBrief.conversionObjective,
      approxLength: context.articleBrief.approxLength,
      plan: normalizedPlan,
    });

    return this.serializeStoredSuggestionPlan(storedPlan);
  }

  private async buildSuggestionCreationContext(
    groupId: string,
    input?: CreateFromSuggestionInput | null,
    projectId?: string,
  ): Promise<SuggestionCreationContext> {
    const normalizedGroupId = groupId.trim();
    const normalizedProjectId = projectId?.trim() || null;
    const group = (await (this.prisma as any).keywordGroup.findFirst({
      where: {
        id: normalizedGroupId,
        ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
        trashedAt: null,
      },
      select: {
        id: true,
        name: true,
        projectId: true,
        seoClusterId: true,
        primaryKeyword: true,
        description: true,
        keywords: {
          where: {
            trashedAt: null,
          },
          select: {
            id: true,
            keyword: true,
            template: true,
            pageId: true,
            searchIntent: true,
            volume: true,
            difficulty: true,
          },
          orderBy: [{ volume: 'desc' }, { keyword: 'asc' }],
        },
      },
    })) as SuggestionGroup | null;

    if (!group) {
      throw new NotFoundException(
        `KeywordGroup ${normalizedGroupId} not found`,
      );
    }

    const eligibleKeywords = group.keywords.filter(
      (keyword) =>
        keyword.pageId === null &&
        keyword.template &&
        this.isEditorialTemplate(keyword.template),
    );

    if (!eligibleKeywords.length) {
      throw new BadRequestException(
        'Ce groupe ne contient aucun mot-clé éligible pour créer une page.',
      );
    }

    const targetPageType = (
      input?.pageType && this.isEditorialTemplate(input.pageType)
        ? input.pageType
        : this.resolveSuggestionPageType(eligibleKeywords)
    ) as EditorialPageType | null;

    if (!targetPageType) {
      throw new BadRequestException(
        'Impossible de déterminer le type de page à créer.',
      );
    }

    const matchingKeywords = eligibleKeywords.filter(
      (keyword) => keyword.template === targetPageType,
    );

    if (!matchingKeywords.length) {
      throw new BadRequestException(
        `Aucun mot-clé du groupe ne correspond au template ${targetPageType}.`,
      );
    }

    const parsedSecondaryKeywords = this.parseSecondaryKeywords(
      input?.secondaryKeywords,
    );

    return {
      group,
      normalizedGroupId,
      normalizedProjectId,
      targetPageType,
      matchingKeywords,
      matchingKeywordIds: matchingKeywords.map((keyword) => keyword.id),
      articleBrief: {
        subjectExact:
          input?.subjectExact?.trim() ||
          group.description?.trim() ||
          group.name.trim(),
        primaryKeyword:
          input?.primaryKeyword?.trim() ||
          group.primaryKeyword?.trim() ||
          matchingKeywords[0]?.keyword?.trim() ||
          group.name.trim(),
        secondaryKeywords:
          parsedSecondaryKeywords.length > 0
            ? parsedSecondaryKeywords
            : matchingKeywords
                .map((keyword) => keyword.keyword.trim())
                .filter(Boolean)
                .slice(1),
        target:
          input?.target?.trim() ||
          'Entrepreneuses et e-commerçantes débutantes',
        conversionObjective:
          input?.conversionObjective?.trim() ||
          "Créer de la confiance, expliquer et faire passer à l'action",
        approxLength: input?.approxLength?.trim() || '1200 mots',
        plan: input?.plan?.trim() || null,
      },
    };
  }

  private isEditorialTemplate(
    pageType: PageType,
  ): pageType is EditorialPageType {
    return this.editorialPageTypes.includes(pageType as EditorialPageType);
  }

  private parseSecondaryKeywords(rawValue?: string | null) {
    if (!rawValue) {
      return [];
    }

    return rawValue
      .split(/[,;\n]/g)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private toNullableTrimmed(value?: string | null) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
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

  private resolveSuggestionPageType(keywords: SuggestionKeyword[]) {
    const pageTypes = keywords
      .map((keyword) => keyword.template ?? null)
      .filter((pageType): pageType is PageType => Boolean(pageType));

    if (!pageTypes.length) {
      return null;
    }

    const priority: EditorialPageType[] = [...this.editorialPageTypes];

    const counts = new Map<PageType, number>();

    for (const pageType of pageTypes) {
      counts.set(pageType, (counts.get(pageType) ?? 0) + 1);
    }

    return (
      [...counts.entries()].sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return (
          priority.indexOf(left[0] as EditorialPageType) -
          priority.indexOf(right[0] as EditorialPageType)
        );
      })[0]?.[0] ?? null
    );
  }

  private buildSlug(value: string) {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalizedValue || 'page';
  }

  private async buildUniquePageUrl(baseSlug: string, client: any) {
    const slug = baseSlug || 'page';
    const existingPages = (await client.page.findMany({
      where: {
        OR: [{ url: `/${slug}` }, { url: { startsWith: `/${slug}-` } }],
      },
      select: {
        url: true,
      },
    })) as Array<{ url: string }>;

    const takenNumbers = new Set<number>();

    for (const page of existingPages) {
      const normalizedUrl = page.url.trim();

      if (normalizedUrl === `/${slug}`) {
        takenNumbers.add(1);
        continue;
      }

      const suffixMatch = normalizedUrl.match(new RegExp(`^/${slug}-(\\d+)$`));

      if (suffixMatch?.[1]) {
        takenNumbers.add(Number.parseInt(suffixMatch[1], 10));
      }
    }

    if (!takenNumbers.has(1)) {
      return `/${slug}`;
    }

    let counter = 2;

    while (takenNumbers.has(counter)) {
      counter += 1;
    }

    return `/${slug}-${counter}`;
  }

  private async buildShopifyPageUrl(projectId: string | null, handle: string) {
    const normalizedHandle = handle.trim();

    if (!normalizedHandle) {
      throw new BadRequestException('Le handle Shopify est requis.');
    }

    if (!projectId) {
      return `/pages/${normalizedHandle}`;
    }

    const project = await (this.prisma as any).project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        shopifyStoreDomain: true,
      },
    });
    const storeDomain = project?.shopifyStoreDomain?.trim() || '';

    if (!storeDomain) {
      return `/pages/${normalizedHandle}`;
    }

    return `https://${storeDomain}/pages/${normalizedHandle}`;
  }

  private async resolvePageUrlForAssociatedBlogArticle(
    client: any,
    articleUrl: string | null,
    fallbackSlug: string,
  ) {
    const normalizedArticleUrl = articleUrl?.trim() || '';

    if (normalizedArticleUrl) {
      const existingPage = await client.page.findFirst({
        where: {
          url: normalizedArticleUrl,
        },
        select: {
          id: true,
        },
      });

      if (!existingPage) {
        return normalizedArticleUrl;
      }
    }

    return this.buildUniquePageUrl(fallbackSlug, client);
  }

  private async createPageFromAssociatedBlogArticle(
    client: any,
    context: SuggestionCreationContext,
    freshKeywords: Array<{ id: string }>,
    clusterId: string | null,
    existingArticle: {
      id: string;
      title: string;
      slug?: string | null;
      url?: string | null;
      status?: string | null;
      pageId?: string | null;
      clusterId?: string | null;
    },
    alreadyLinkedMessage: string,
  ) {
    if (existingArticle.pageId) {
      throw new BadRequestException(alreadyLinkedMessage);
    }

    const articleSlug = this.buildSlug(
      existingArticle.slug?.trim() ||
        existingArticle.title ||
        existingArticle.id,
    );
    const effectiveClusterId = clusterId ?? existingArticle.clusterId ?? null;
    const pageUrl = await this.resolvePageUrlForAssociatedBlogArticle(
      client,
      existingArticle.url ?? null,
      articleSlug,
    );
    const createdPage = await client.page.create({
      data: {
        projectId:
          context.group.projectId ?? context.normalizedProjectId ?? null,
        clusterId: effectiveClusterId,
        title: existingArticle.title,
        slug: articleSlug,
        url: pageUrl,
        status: this.toPageStatus(existingArticle.status),
        pageType: context.targetPageType,
        seoRole: SeoRole.SUPPORT,
        searchIntent: freshKeywords[0]
          ? (context.matchingKeywords.find(
              (keyword) => keyword.id === freshKeywords[0]?.id,
            )?.searchIntent ?? null)
          : null,
      },
    });

    await client.blogArticle.update({
      where: {
        id: existingArticle.id,
      },
      data: {
        pageId: createdPage.id,
      },
    });

    return createdPage.id;
  }

  private async resolveSuggestionClusterId(
    client: any,
    clusterId?: string | null,
    projectId?: string | null,
  ) {
    const normalizedClusterId = this.toNullableTrimmed(clusterId);
    const normalizedProjectId = this.toNullableTrimmed(projectId);

    if (!normalizedClusterId) {
      return null;
    }

    const cluster = await (client as any).seoCluster.findFirst({
      where: {
        id: normalizedClusterId,
        trashedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!cluster) {
      return null;
    }

    if (!cluster.projectId && normalizedProjectId) {
      await (client as any).seoCluster.update({
        where: {
          id: normalizedClusterId,
        },
        data: {
          projectId: normalizedProjectId,
        },
      });

      return normalizedClusterId;
    }

    if (
      normalizedProjectId &&
      cluster.projectId &&
      cluster.projectId !== normalizedProjectId
    ) {
      throw new BadRequestException(
        'Le cluster de cette suggestion appartient a un autre projet.',
      );
    }

    return normalizedClusterId;
  }

  private async findStoredSuggestionPlan(
    keywordGroupId: string,
    projectId?: string | null,
    client: any = this.prisma,
  ) {
    return ((await (client as any).pagePlan.findFirst({
      where: {
        keywordGroupId,
        ...(projectId?.trim() ? { projectId: projectId.trim() } : {}),
      },
    })) ?? null) as StoredSuggestionPlanRecord | null;
  }

  private async getStoredPlanText(
    keywordGroupId: string,
    projectId?: string | null,
  ) {
    const storedPlan = await this.findStoredSuggestionPlan(
      keywordGroupId,
      projectId,
    );

    return storedPlan?.plan?.trim() || null;
  }

  private async upsertSuggestionPlan(
    client: any,
    input: {
      keywordGroupId: string;
      pageId?: string | null;
      projectId?: string | null;
      pageType: PageType;
      subjectExact: string;
      primaryKeyword: string;
      secondaryKeywords?: string | null;
      target: string;
      conversionObjective: string;
      approxLength: string;
      plan: string;
    },
  ) {
    return (await (client as any).pagePlan.upsert({
      where: {
        keywordGroupId: input.keywordGroupId,
      },
      update: {
        pageId: input.pageId ?? undefined,
        projectId: input.projectId ?? null,
        pageType: input.pageType,
        subjectExact: input.subjectExact,
        primaryKeyword: input.primaryKeyword,
        secondaryKeywords: this.toNullableTrimmed(input.secondaryKeywords),
        target: input.target,
        conversionObjective: input.conversionObjective,
        approxLength: input.approxLength,
        plan: input.plan,
      },
      create: {
        keywordGroupId: input.keywordGroupId,
        pageId: input.pageId ?? null,
        projectId: input.projectId ?? null,
        pageType: input.pageType,
        subjectExact: input.subjectExact,
        primaryKeyword: input.primaryKeyword,
        secondaryKeywords: this.toNullableTrimmed(input.secondaryKeywords),
        target: input.target,
        conversionObjective: input.conversionObjective,
        approxLength: input.approxLength,
        plan: input.plan,
      },
    })) as StoredSuggestionPlanRecord;
  }

  private doesStoredPlanMatchContext(
    storedPlan: StoredSuggestionPlanRecord,
    context: SuggestionCreationContext,
  ) {
    return (
      storedPlan.pageType === context.targetPageType &&
      storedPlan.subjectExact.trim() === context.articleBrief.subjectExact &&
      storedPlan.primaryKeyword.trim() ===
        context.articleBrief.primaryKeyword &&
      this.parseSecondaryKeywords(storedPlan.secondaryKeywords).join('|') ===
        context.articleBrief.secondaryKeywords.join('|') &&
      storedPlan.target.trim() === context.articleBrief.target &&
      storedPlan.conversionObjective.trim() ===
        context.articleBrief.conversionObjective &&
      storedPlan.approxLength.trim() === context.articleBrief.approxLength &&
      Boolean(storedPlan.plan.trim())
    );
  }

  private serializeStoredSuggestionPlan(
    storedPlan: StoredSuggestionPlanRecord,
  ) {
    return {
      id: storedPlan.id,
      keywordGroupId: storedPlan.keywordGroupId,
      pageId: storedPlan.pageId ?? null,
      projectId: storedPlan.projectId ?? null,
      pageType: storedPlan.pageType,
      subjectExact: storedPlan.subjectExact,
      primaryKeyword: storedPlan.primaryKeyword,
      secondaryKeywords: storedPlan.secondaryKeywords ?? null,
      target: storedPlan.target,
      conversionObjective: storedPlan.conversionObjective,
      approxLength: storedPlan.approxLength,
      plan: storedPlan.plan,
      createdAt: storedPlan.createdAt.toISOString(),
      updatedAt: storedPlan.updatedAt.toISOString(),
    };
  }

  private async scheduleSuggestionArticleGeneration(input: {
    pageId: string;
    pageUrl: string;
    projectId: string | null;
    clusterId: string | null;
    payload: Parameters<
      BlogArticlesService['generateBlogArticleDraftFromSuggestion']
    >[0];
  }) {
    try {
      await this.blogArticleSuggestionGenerationService.enqueueGeneration(
        input,
      );
    } catch (error) {
      this.logger.error(
        `Impossible de mettre en file la génération de l'article blog pour la page ${input.pageId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildSuggestionArticleGenerationPayload(page: any) {
    const pagePlan = page.pagePlan ?? null;
    const firstKeywordGroup = page.keywords?.[0]?.keywordGroup ?? null;
    const keywords = (page.keywords ?? []).map((keyword: any) => ({
      id: keyword.id,
      keyword: keyword.keyword,
      template: keyword.template,
      pageId: keyword.pageId,
      volume: keyword.volume ?? null,
      difficulty: keyword.difficulty ?? null,
      searchIntent: keyword.searchIntent ?? null,
    }));
    const firstKeyword = keywords[0] ?? null;
    const primaryKeyword =
      page.blogArticle?.primaryKeyword?.trim() ||
      pagePlan?.primaryKeyword?.trim() ||
      firstKeyword?.keyword?.trim() ||
      page.title.trim();
    const requiredKeywords = this.parseSecondaryKeywords(
      page.blogArticle?.requiredKeywords ?? null,
    );
    const planSecondaryKeywords = this.parseSecondaryKeywords(
      pagePlan?.secondaryKeywords ?? null,
    );

    return {
      group: {
        id: firstKeywordGroup?.id ?? pagePlan?.keywordGroupId ?? page.id,
        name:
          firstKeywordGroup?.name?.trim() ||
          pagePlan?.subjectExact?.trim() ||
          page.title.trim(),
        primaryKeyword: firstKeywordGroup?.primaryKeyword?.trim() ?? null,
        description: firstKeywordGroup?.description?.trim() ?? null,
        keywords,
      },
      pageType: page.pageType,
      keywords,
      articleBrief: {
        subjectExact:
          pagePlan?.subjectExact?.trim() ||
          page.blogArticle?.title?.trim() ||
          page.title.trim(),
        primaryKeyword,
        secondaryKeywords: planSecondaryKeywords.length
          ? planSecondaryKeywords
          : requiredKeywords.length > 0
            ? requiredKeywords.filter(
                (keyword: string) =>
                  keyword.trim().toLowerCase() !== primaryKeyword.toLowerCase(),
              )
            : keywords
                .map((keyword: any) => keyword.keyword?.trim())
                .filter(Boolean)
                .filter(
                  (keyword: string) =>
                    keyword.toLowerCase() !== primaryKeyword.toLowerCase(),
                ),
        target:
          pagePlan?.target?.trim() ||
          'Entrepreneuses et e-commerçantes débutantes',
        conversionObjective:
          pagePlan?.conversionObjective?.trim() ||
          "Créer de la confiance, expliquer et faire passer à l'action",
        approxLength: pagePlan?.approxLength?.trim() || '1200 mots',
        plan: pagePlan?.plan?.trim() || null,
      },
    } satisfies Parameters<
      BlogArticlesService['generateBlogArticleDraftFromSuggestion']
    >[0];
  }
}
