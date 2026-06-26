import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PageType } from 'src/common/types/prisma-enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogArticleIdeaDto } from './dto/create-blog-article-idea.dto';
import { OpenAiPlatformService } from '../openai-platform/openai-platform.service';
import { SeoClustersService } from '../seo-clusters/seo-clusters.service';
import { UpdateBlogArticleDto } from './dto/update-blog-article.dto';
import { ShopifyService } from '../shopify/shopify.service';
import { buildShopifyStoreDomain } from '../../common/utils/normalize.utils';
import {
  extractOpenAiText,
  parseStructuredOpenAiResponse,
} from '../../common/utils/openai-response';
import { GmailMailService } from '../mail/mail.service';
import {
  BLOG_ARTICLE_FROM_SUGGESTION_OPENAI_JSON_SCHEMA,
  blogArticleFromSuggestionResponseSchema,
  type BlogArticleFromSuggestionResponse,
} from './blog-article-generation.schemas';
import type {
  BlogArticleSuggestionBrief,
  BlogArticleSuggestionDraft,
  EditorialPageType,
  SuggestionGroup,
  SuggestionKeyword,
} from './blog-articles.types';
import { SettingsPromptConfigsService } from '../admin/settings/settings-prompt-configs.service';
import { SettingsService } from '../admin/settings/settings.service';

const NON_IDEA_BLOG_ARTICLE_WHERE = {
  trashedAt: null,
  NOT: {
    status: 'IDEA',
  },
} as const;

const blogArticleInclude = {
  blog: {
    select: {
      id: true,
      title: true,
      name: true,
      baseUrl: true,
    },
  },
  seoCluster: true,
  author: true,
  page: true,
  blogArticleScriptAssets: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
} as const;

const blogArticleIncludeWithoutScriptAssets = {
  blog: {
    select: {
      id: true,
      title: true,
      name: true,
      baseUrl: true,
    },
  },
  seoCluster: true,
  author: true,
  page: true,
} as const;

@Injectable()
export class BlogArticlesService {
  private readonly logger = new Logger(BlogArticlesService.name);
  private isBlogArticleScriptAssetsTableAvailable: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly seoClustersService: SeoClustersService,
    private readonly shopifyService: ShopifyService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
    private readonly settingsService: SettingsService,
    private readonly mailService: GmailMailService,
  ) {}

  async createIdea(input: CreateBlogArticleIdeaDto, projectId: string) {
    const normalizedTitle = this.normalizeIdeaTitle(input.title);
    const existingIdea = await (this.prisma as any).blogArticle.findFirst({
      where: {
        trashedAt: null,
        status: 'IDEA',
        projectId,
        title: normalizedTitle,
      },
    });

    if (existingIdea) {
      throw new ConflictException(
        "Une idée d'article avec ce titre existe déjà.",
      );
    }

    return (this.prisma as any).blogArticle.create({
      data: {
        id: randomUUID(),
        projectId,
        title: normalizedTitle,
        status: 'IDEA',
      },
    });
  }

  async createBlankArticle(projectId: string) {
    return (this.prisma as any).blogArticle.create({
      data: {
        id: randomUUID(),
        projectId,
        title: 'Nouvel article',
        status: 'DRAFT',
      },
    });
  }

  async generateBlogArticleDraftFromSuggestion(input: {
    group: SuggestionGroup;
    pageType: EditorialPageType;
    keywords: SuggestionKeyword[];
    articleBrief: BlogArticleSuggestionBrief;
  }) {
    const promptConfig =
      await this.promptConfigsService.getBlogArticleFromSuggestionPrompt();
    const tone = await this.settingsService.getBlogArticleFromSuggestionTone();
    const keywords = input.keywords.filter((keyword) => keyword.keyword.trim());
    const keywordLines = keywords
      .map((keyword) =>
        [
          `- ${keyword.keyword.trim()}`,
          keyword.searchIntent ? `intention: ${keyword.searchIntent}` : null,
          keyword.volume !== null && keyword.volume !== undefined
            ? `volume: ${keyword.volume}`
            : null,
          keyword.difficulty !== null && keyword.difficulty !== undefined
            ? `difficulté: ${keyword.difficulty}`
            : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');

    const keywordFallback =
      input.group.primaryKeyword?.trim() ||
      keywords[0]?.keyword?.trim() ||
      input.group.name.trim();
    const promptInput = this.interpolatePromptTemplate(promptConfig.input, {
      pageType: input.pageType,
      subjectExact: input.articleBrief.subjectExact.trim(),
      primaryKeyword: input.articleBrief.primaryKeyword.trim(),
      secondaryKeywords: input.articleBrief.secondaryKeywords.join(', '),
      target: input.articleBrief.target.trim(),
      conversionObjective: input.articleBrief.conversionObjective.trim(),
      approxLength: input.articleBrief.approxLength.trim(),
      tone,
      groupName: input.group.name.trim(),
      groupDescription: input.group.description?.trim() || '',
      plan: input.articleBrief.plan?.trim() || '',
      keywords: keywordLines || keywordFallback,
    });
    const promptInputWithPlan = input.articleBrief.plan?.trim()
      ? promptConfig.input.includes('{{plan}}')
        ? promptInput
        : [
            promptInput,
            '',
            'Plan éditorial validé :',
            input.articleBrief.plan.trim(),
          ].join('\n')
      : promptInput;
    const baseMaxOutputTokens = promptConfig.maxOutputTokens;

    const response = await this.openAiPlatformService.createResponse({
      model: promptConfig.model,
      promptType: 'BLOG_ARTICLE_FROM_SUGGESTION',
      instructions: promptConfig.instructions,
      input: promptInputWithPlan,
      text: {
        format: {
          type: 'json_schema',
          name: 'blog_article_from_suggestion',
          strict: true,
          schema: BLOG_ARTICLE_FROM_SUGGESTION_OPENAI_JSON_SCHEMA,
        },
      },
      max_output_tokens: baseMaxOutputTokens,
    });

    try {
      return parseStructuredOpenAiResponse(
        response,
        blogArticleFromSuggestionResponseSchema,
      ) as BlogArticleSuggestionDraft;
    } catch (initialError) {
      const retryMaxOutputTokens =
        this.resolveExpandedMaxOutputTokens(baseMaxOutputTokens);
      const structuredRetryResponse = this.isMaxOutputTokensIncomplete(response)
        ? await this.openAiPlatformService.createResponse({
            model: promptConfig.model,
            promptType: 'BLOG_ARTICLE_FROM_SUGGESTION',
            instructions: promptConfig.instructions,
            input: promptInputWithPlan,
            text: {
              format: {
                type: 'json_schema',
                name: 'blog_article_from_suggestion',
                strict: true,
                schema: BLOG_ARTICLE_FROM_SUGGESTION_OPENAI_JSON_SCHEMA,
              },
            },
            max_output_tokens: retryMaxOutputTokens,
          })
        : null;

      if (structuredRetryResponse) {
        try {
          return parseStructuredOpenAiResponse(
            structuredRetryResponse,
            blogArticleFromSuggestionResponseSchema,
          ) as BlogArticleSuggestionDraft;
        } catch (structuredRetryError) {
          initialError = structuredRetryError;
        }
      }

      const fallbackResponse = await this.openAiPlatformService.createResponse({
        model: promptConfig.model,
        promptType: 'BLOG_ARTICLE_FROM_SUGGESTION',
        instructions: [
          promptConfig.instructions,
          '',
          'IMPORTANT: réponds uniquement avec un objet JSON valide, sans markdown, sans commentaire et sans texte avant ou après le JSON.',
        ].join('\n'),
        input: promptInputWithPlan,
        text: {
          format: {
            type: 'text',
          },
        },
        max_output_tokens: this.isMaxOutputTokensIncomplete(response)
          ? retryMaxOutputTokens
          : baseMaxOutputTokens,
      });

      try {
        return parseStructuredOpenAiResponse(
          fallbackResponse,
          blogArticleFromSuggestionResponseSchema,
        ) as BlogArticleSuggestionDraft;
      } catch (fallbackError) {
        throw new BadGatewayException(
          this.buildBlogArticleGenerationErrorMessage(
            initialError,
            response,
            fallbackError,
            fallbackResponse,
          ),
        );
      }
    }
  }

  async generateBlogArticlePlanFromSuggestion(input: {
    group: SuggestionGroup;
    pageType: EditorialPageType;
    keywords: SuggestionKeyword[];
    articleBrief: BlogArticleSuggestionBrief;
  }) {
    const promptConfig =
      await this.promptConfigsService.getBlogArticlePlanFromSuggestionPrompt();
    const tone = await this.settingsService.getBlogArticleFromSuggestionTone();
    const keywords = input.keywords.filter((keyword) => keyword.keyword.trim());
    const keywordLines = keywords
      .map((keyword) =>
        [
          `- ${keyword.keyword.trim()}`,
          keyword.searchIntent ? `intention: ${keyword.searchIntent}` : null,
          keyword.volume !== null && keyword.volume !== undefined
            ? `volume: ${keyword.volume}`
            : null,
          keyword.difficulty !== null && keyword.difficulty !== undefined
            ? `difficulté: ${keyword.difficulty}`
            : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
    const keywordFallback =
      input.group.primaryKeyword?.trim() ||
      keywords[0]?.keyword?.trim() ||
      input.group.name.trim();
    const promptInput = this.interpolatePromptTemplate(promptConfig.input, {
      pageType: input.pageType,
      subjectExact: input.articleBrief.subjectExact.trim(),
      primaryKeyword: input.articleBrief.primaryKeyword.trim(),
      secondaryKeywords: input.articleBrief.secondaryKeywords.join(', '),
      target: input.articleBrief.target.trim(),
      conversionObjective: input.articleBrief.conversionObjective.trim(),
      approxLength: input.articleBrief.approxLength.trim(),
      tone,
      groupName: input.group.name.trim(),
      groupDescription: input.group.description?.trim() || '',
      keywords: keywordLines || keywordFallback,
    });
    const baseMaxOutputTokens = promptConfig.maxOutputTokens;

    const response = await this.openAiPlatformService.createResponse({
      model: promptConfig.model,
      promptType: 'BLOG_ARTICLE_PLAN_FROM_SUGGESTION',
      instructions: promptConfig.instructions,
      input: promptInput,
      text: {
        format: {
          type: 'text',
        },
      },
      max_output_tokens: baseMaxOutputTokens,
    });

    const plan = extractOpenAiText(response).trim();

    if (plan) {
      return plan;
    }

    const expandedMaxOutputTokens =
      this.resolveExpandedMaxOutputTokens(baseMaxOutputTokens);
    const retryResponse = this.isMaxOutputTokensIncomplete(response)
      ? await this.openAiPlatformService.createResponse({
          model: promptConfig.model,
          promptType: 'BLOG_ARTICLE_PLAN_FROM_SUGGESTION',
          instructions: promptConfig.instructions,
          input: promptInput,
          text: {
            format: {
              type: 'text',
            },
          },
          max_output_tokens: expandedMaxOutputTokens,
        })
      : null;

    const retryPlan = retryResponse
      ? extractOpenAiText(retryResponse).trim()
      : '';

    if (retryPlan) {
      return retryPlan;
    }

    throw new BadGatewayException(
      this.buildBlogArticleGenerationErrorMessage(
        new Error('OpenAI plan response is empty.'),
        response,
        new Error('OpenAI plan response is empty.'),
        retryResponse,
      ),
    );
  }

  async suggestSecondaryKeywordsFromSuggestion(input: {
    group: SuggestionGroup;
    pageType: EditorialPageType;
    keywords: SuggestionKeyword[];
    articleBrief: BlogArticleSuggestionBrief;
  }) {
    const promptConfig =
      await this.promptConfigsService.getBlogArticleSecondaryKeywordsSuggestionPrompt();
    const tone = await this.settingsService.getBlogArticleFromSuggestionTone();
    const keywords = input.keywords.filter((keyword) => keyword.keyword.trim());
    const keywordLines = keywords
      .map((keyword) =>
        [
          `- ${keyword.keyword.trim()}`,
          keyword.searchIntent ? `intention: ${keyword.searchIntent}` : null,
          keyword.volume !== null && keyword.volume !== undefined
            ? `volume: ${keyword.volume}`
            : null,
          keyword.difficulty !== null && keyword.difficulty !== undefined
            ? `difficulté: ${keyword.difficulty}`
            : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
    const keywordFallback =
      input.group.primaryKeyword?.trim() ||
      keywords[0]?.keyword?.trim() ||
      input.group.name.trim();
    const promptInput = this.interpolatePromptTemplate(promptConfig.input, {
      pageType: input.pageType,
      subjectExact: input.articleBrief.subjectExact.trim(),
      primaryKeyword: input.articleBrief.primaryKeyword.trim(),
      secondaryKeywords:
        input.articleBrief.secondaryKeywords.join(', ') || 'aucun',
      target: input.articleBrief.target.trim(),
      conversionObjective: input.articleBrief.conversionObjective.trim(),
      approxLength: input.articleBrief.approxLength.trim(),
      tone,
      groupName: input.group.name.trim(),
      groupDescription: input.group.description?.trim() || 'aucune',
      keywords: keywordLines || keywordFallback,
    });
    const promptInputWithJsonHint = [
      'Important: réponds uniquement en JSON valide.',
      promptInput,
    ].join('\n');
    const baseMaxOutputTokens = Math.min(
      this.resolveExpandedMaxOutputTokens(promptConfig.maxOutputTokens),
      900,
    );

    const parseKeywords = (rawText: string) => {
      const rawCandidates = (() => {
        try {
          const parsed = JSON.parse(rawText) as unknown;

          if (Array.isArray(parsed)) {
            return parsed as unknown[];
          }

          if (
            parsed &&
            typeof parsed === 'object' &&
            'keywords' in parsed &&
            Array.isArray((parsed as { keywords?: unknown[] }).keywords)
          ) {
            return (parsed as { keywords: unknown[] }).keywords;
          }

          if (
            parsed &&
            typeof parsed === 'object' &&
            'items' in parsed &&
            Array.isArray((parsed as { items?: unknown[] }).items)
          ) {
            return (parsed as { items: unknown[] }).items;
          }
        } catch {
          return rawText.split(/[,;\n]/g);
        }

        return rawText.split(/[,;\n]/g);
      })();

      const seen = new Set<string>();
      const normalizedPrimaryKeyword = input.articleBrief.primaryKeyword
        .trim()
        .toLowerCase();

      return rawCandidates
        .map((value: unknown) =>
          typeof value === 'string' ? value.trim() : '',
        )
        .filter(Boolean)
        .filter(
          (value: string) => value.toLowerCase() !== normalizedPrimaryKeyword,
        )
        .filter((value: string) => {
          const key = value.toLowerCase();

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        })
        .slice(0, 12);
    };

    const createSuggestionsResponse = async (maxOutputTokens: number) =>
      this.openAiPlatformService.createResponse({
        model: promptConfig.model,
        promptType: 'BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION',
        instructions: promptConfig.instructions,
        input: promptInputWithJsonHint,
        text: {
          format: {
            type: 'json_object',
          },
        },
        max_output_tokens: maxOutputTokens,
      });

    const response = await createSuggestionsResponse(baseMaxOutputTokens);
    const keywordsFromResponse = parseKeywords(
      extractOpenAiText(response).trim(),
    );

    if (keywordsFromResponse.length) {
      return keywordsFromResponse;
    }

    const retryResponse = await createSuggestionsResponse(
      this.resolveExpandedMaxOutputTokens(baseMaxOutputTokens),
    );
    const retryKeywords = parseKeywords(
      extractOpenAiText(retryResponse).trim(),
    );

    if (retryKeywords.length) {
      return retryKeywords;
    }

    throw new BadGatewayException(
      this.buildBlogArticleGenerationErrorMessage(
        new Error('OpenAI secondary keyword response is empty.'),
        response,
        new Error('OpenAI secondary keyword response is empty.'),
        retryResponse,
      ),
    );
  }

  async createFromSuggestionDraft(
    input: {
      pageId: string;
      pageUrl: string;
      projectId?: string | null;
      clusterId?: string | null;
      draft: BlogArticleSuggestionDraft;
    },
    tx?: PrismaService | any,
  ) {
    const client = tx ?? this.prisma;

    const data = {
      pageId: input.pageId,
      url: input.pageUrl,
      projectId: input.projectId?.trim() || null,
      seoClusterId: input.clusterId?.trim() || null,
      title: input.draft.title.trim(),
      slug: input.draft.slug.trim(),
      excerpt: input.draft.excerpt.trim(),
      content: input.draft.content.trim(),
      primaryKeyword: input.draft.primaryKeyword.trim(),
      requiredKeywords: input.draft.requiredKeywords.join(', '),
      seoTitle: input.draft.seoTitle.trim(),
      seoDescription: input.draft.seoDescription.trim(),
      status: 'DRAFT',
    };

    const existingArticle = await (client as any).blogArticle.findFirst({
      where: {
        pageId: input.pageId,
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    return this.serializeBlogArticle(
      existingArticle
        ? await this.updateBlogArticleWithOptionalScriptAssets(
            client,
            existingArticle.id,
            data,
          )
        : await this.createBlogArticleWithOptionalScriptAssets(client, data),
    );
  }

  async assignIdeasToClustersWithAi() {
    const [ideas, clusters] = await Promise.all([
      (this.prisma as any).blogArticle.findMany({
        where: {
          trashedAt: null,
          status: 'IDEA',
          seoClusterId: null,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.seoClustersService.findAll(),
    ]);

    if (!ideas.length || !clusters.length) {
      return [];
    }

    const clusterIndex = new Map(
      clusters.map((cluster: any) => [cluster.id, cluster]),
    );
    const updatedIdeas: Array<
      ReturnType<BlogArticlesService['serializeBlogArticle']>
    > = [];

    for (const idea of ideas) {
      const suggestedClusterId = await this.getSuggestedClusterIdForIdea(
        idea.title,
        clusters,
      );

      if (!suggestedClusterId || !clusterIndex.has(suggestedClusterId)) {
        continue;
      }

      const updatedIdea = await this.updateBlogArticleWithOptionalScriptAssets(
        this.prisma,
        idea.id,
        {
          seoClusterId: suggestedClusterId,
        },
      );

      updatedIdeas.push(this.serializeBlogArticle(updatedIdea));
    }

    return updatedIdeas;
  }

  async assignCluster(id: string, clusterId: string | null) {
    const article = await this.findOne(id);

    if (clusterId) {
      const cluster = await (this.prisma as any).seoCluster.findFirst({
        where: {
          id: clusterId,
          trashedAt: null,
        },
      });

      if (!cluster) {
        throw new NotFoundException(`SeoCluster ${clusterId} not found`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedArticle =
        await this.updateBlogArticleWithOptionalScriptAssets(tx, id, {
          seoClusterId: clusterId,
        });

      if (!clusterId && article.seoCluster?.id) {
        const pageWhere = this.buildMatchingPageWhere(
          article.seoCluster.id,
          article.url,
          article.slug,
        );

        if (pageWhere) {
          await (tx as any).page.updateMany({
            where: pageWhere,
            data: {
              seoRole: 'SUPPORT',
            },
          });
        }
      }

      return this.serializeBlogArticle(updatedArticle);
    });
  }

  async findOrCreateDiscoveredArticle(input: {
    blogId: string;
    url: string;
    title: string;
    slug?: string | null;
  }) {
    const normalizedUrl = input.url.replace(/\/$/, '');
    const normalizedSlug = input.slug ?? null;
    const blog = await (this.prisma as any).blog.findFirst({
      where: {
        id: input.blogId,
      },
      select: {
        projectId: true,
      },
    });
    const blogProjectId = blog?.projectId?.trim() || null;
    const existingArticle = await (this.prisma as any).blogArticle.findUnique({
      where: {
        url: normalizedUrl,
      },
    });

    if (existingArticle?.trashedAt) {
      return (this.prisma as any).blogArticle.update({
        where: { id: existingArticle.id },
        data: {
          blogId: input.blogId,
          url: normalizedUrl,
          projectId: blogProjectId,
          title: existingArticle.title || input.title,
          slug: normalizedSlug ?? existingArticle.slug,
          trashedAt: null,
        },
      });
    }

    if (existingArticle) {
      return existingArticle;
    }

    const existingArticleBySlugMatch = normalizedSlug
      ? await (this.prisma as any).blogArticle.findFirst({
          where: {
            blogId: input.blogId,
            slug: normalizedSlug,
          },
        })
      : null;

    if (existingArticleBySlugMatch) {
      return (this.prisma as any).blogArticle.update({
        where: { id: existingArticleBySlugMatch.id },
        data: {
          url: normalizedUrl,
          title: existingArticleBySlugMatch.title || input.title,
          projectId: blogProjectId,
          trashedAt: null,
        },
      });
    }

    try {
      return await (this.prisma as any).blogArticle.create({
        data: {
          id: randomUUID(),
          blogId: input.blogId,
          url: normalizedUrl,
          projectId: blogProjectId,
          title: input.title,
          slug: normalizedSlug,
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') {
        throw error;
      }

      const concurrentArticleByUrl = await (
        this.prisma as any
      ).blogArticle.findUnique({
        where: {
          url: normalizedUrl,
        },
      });

      if (concurrentArticleByUrl) {
        if (concurrentArticleByUrl.trashedAt) {
          return (this.prisma as any).blogArticle.update({
            where: { id: concurrentArticleByUrl.id },
            data: {
              blogId: input.blogId,
              projectId: blogProjectId,
              title: concurrentArticleByUrl.title || input.title,
              slug: normalizedSlug ?? concurrentArticleByUrl.slug,
              trashedAt: null,
            },
          });
        }

        return concurrentArticleByUrl;
      }

      const concurrentArticleBySlug = normalizedSlug
        ? await (this.prisma as any).blogArticle.findFirst({
            where: {
              blogId: input.blogId,
              slug: normalizedSlug,
            },
          })
        : null;

      if (concurrentArticleBySlug) {
        return (this.prisma as any).blogArticle.update({
          where: { id: concurrentArticleBySlug.id },
          data: {
            url: normalizedUrl,
            title: concurrentArticleBySlug.title || input.title,
            projectId: blogProjectId,
            trashedAt: null,
          },
        });
      }

      throw error;
    }
  }

  async search(query: string) {
    const articles = await this.findManyBlogArticlesWithOptionalScriptAssets({
      where: {
        ...NON_IDEA_BLOG_ARTICLE_WHERE,
        OR: [
          { title: { contains: query } },
          { slug: { contains: query } },
          { excerpt: { contains: query } },
          { content: { contains: query } },
          { url: { contains: query } },
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    });

    return articles.map((article: any) => this.serializeBlogArticle(article));
  }

  async findAll(projectId: string) {
    const articles = await this.findManyBlogArticlesWithOptionalScriptAssets({
      where: {
        ...NON_IDEA_BLOG_ARTICLE_WHERE,
        projectId,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return articles.map((article: any) => this.serializeBlogArticle(article));
  }

  async findAllIds() {
    const articles = await (this.prisma as any).blogArticle.findMany({
      where: NON_IDEA_BLOG_ARTICLE_WHERE,
      select: { id: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return articles.map((article: { id: string }) => article.id);
  }

  async findByBlog(blogId: string, projectId: string) {
    return (this.prisma as any).blogArticle.findMany({
      where: {
        ...NON_IDEA_BLOG_ARTICLE_WHERE,
        blogId,
        projectId,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findByAuthor(authorId: string) {
    return (this.prisma as any).blogArticle.findMany({
      where: {
        ...NON_IDEA_BLOG_ARTICLE_WHERE,
        authorId,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findIdeas(projectId: string) {
    const ideas = await this.findManyBlogArticlesWithOptionalScriptAssets({
      where: {
        trashedAt: null,
        status: 'IDEA',
        projectId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return ideas.map((article: any) => this.serializeBlogArticle(article));
  }

  async syncStatusesFromShopify(projectId: string) {
    const articles = await (this.prisma as any).blogArticle.findMany({
      where: {
        ...NON_IDEA_BLOG_ARTICLE_WHERE,
        projectId,
        shopifyArticleId: {
          not: null,
        },
      },
      select: {
        id: true,
        status: true,
        shopifyArticleId: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const article of articles as Array<{
      id: string;
      status: string;
      shopifyArticleId: string | null;
    }>) {
      const shopifyArticleId = article.shopifyArticleId?.trim();

      if (!shopifyArticleId) {
        skippedCount += 1;
        continue;
      }

      try {
        const shopifyArticle = await this.shopifyService.getArticle(
          projectId,
          shopifyArticleId,
        );
        const nextStatus = this.toStatusFromShopifyArticle(
          shopifyArticle.publishedAt,
        );

        if (nextStatus === article.status) {
          skippedCount += 1;
          continue;
        }

        await this.updateBlogArticleWithOptionalScriptAssets(
          this.prisma,
          article.id,
          {
            status: nextStatus,
          },
        );
        updatedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return {
      updatedCount,
      skippedCount,
      failedCount,
    };
  }

  async findOne(id: string, projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();
    const article = await this.findFirstBlogArticleWithOptionalScriptAssets({
      where: {
        id,
        trashedAt: null,
        ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
      },
    });

    if (!article) {
      throw new NotFoundException(`Blog article ${id} not found`);
    }

    return this.serializeBlogArticle(article);
  }

  async update(id: string, input: UpdateBlogArticleDto) {
    const existingArticle = await this.findOne(id);

    const trimmedTitle = input.title?.trim();
    const normalizedAuthorId =
      input.authorId === undefined
        ? undefined
        : this.toNullableTrimmed(input.authorId);
    const normalizedSlug =
      input.slug === undefined ? undefined : this.toNullableTrimmed(input.slug);
    const normalizedPrimaryKeyword =
      input.primaryKeyword === undefined
        ? undefined
        : this.toNullableTrimmed(input.primaryKeyword);
    const normalizedRequiredKeywords =
      input.requiredKeywords === undefined
        ? undefined
        : this.toNullableTrimmed(input.requiredKeywords);
    const normalizedSeoTitle =
      input.seoTitle === undefined
        ? undefined
        : this.toNullableTrimmed(input.seoTitle);
    const normalizedSeoDescription =
      input.seoDescription === undefined
        ? undefined
        : this.toNullableTrimmed(input.seoDescription);
    const normalizedVideoYoutubeUrl =
      input.videoYoutubeUrl === undefined
        ? undefined
        : this.toNullableTrimmed(input.videoYoutubeUrl);
    const normalizedPlannedFor =
      input.plannedFor === undefined
        ? undefined
        : this.toNullableDate(input.plannedFor);
    const normalizedReviewDueAt =
      input.reviewDueAt === undefined
        ? undefined
        : this.toNullableDate(input.reviewDueAt);
    const normalizedShopifyBlogId =
      input.shopifyBlogId === undefined
        ? undefined
        : this.toNullableTrimmed(input.shopifyBlogId);
    const normalizedScriptAssetUrls =
      input.scriptAssetUrls === undefined
        ? undefined
        : this.normalizeScriptAssetUrls(input.scriptAssetUrls);
    const nextTitle =
      input.title !== undefined
        ? trimmedTitle || 'Sans titre'
        : existingArticle.title;
    const nextSlug =
      normalizedSlug !== undefined
        ? normalizedSlug
        : this.toNullableTrimmed(existingArticle.slug);
    const nextContent =
      input.content !== undefined ? input.content : existingArticle.content;
    const nextStatus =
      input.status !== undefined
        ? this.toBlogArticleStatus(input.status)
        : normalizedPlannedFor !== undefined && normalizedPlannedFor !== null
          ? existingArticle.status === 'PUSHED' ||
            existingArticle.status === 'PUBLISHED' ||
            existingArticle.status === 'ARCHIVED'
            ? this.toBlogArticleStatus(existingArticle.status)
            : 'PLANNED'
          : this.toBlogArticleStatus(existingArticle.status);
    const nextAuthorId =
      normalizedAuthorId !== undefined
        ? normalizedAuthorId
        : (existingArticle.authorId ?? null);
    const nextShopifyBlogId =
      normalizedShopifyBlogId !== undefined
        ? normalizedShopifyBlogId
        : (existingArticle.shopifyBlogId ?? null);
    const nextVideoYoutubeUrl =
      normalizedVideoYoutubeUrl !== undefined
        ? normalizedVideoYoutubeUrl
        : (existingArticle.videoYoutubeUrl ?? null);
    const shouldScheduleOnShopify =
      normalizedPlannedFor !== undefined &&
      normalizedPlannedFor !== null &&
      this.isDateAfterToday(normalizedPlannedFor) &&
      !existingArticle.publishedAt &&
      Boolean(existingArticle.shopifyArticleId ?? nextShopifyBlogId);
    const shopifyPublishDate = shouldScheduleOnShopify
      ? normalizedPlannedFor.toISOString()
      : null;
    const nextShopifyHandle = this.buildShopifyHandle(
      nextSlug,
      nextTitle,
      existingArticle.id,
    );
    const shouldSyncToShopify =
      nextStatus === 'PUSHED' ||
      nextStatus === 'PUBLISHED' ||
      shouldScheduleOnShopify;

    let shopifyPublication: {
      id: string;
      blog: {
        id: string;
        title: string;
        handle: string;
      } | null;
    } | null = null;

    this.logger.log(
      `[BlogArticles] update id=${existingArticle.id} status=${nextStatus} shopifyArticleId=${existingArticle.shopifyArticleId ?? 'none'} shopifyBlogId=${nextShopifyBlogId ?? 'default'} shouldSyncToShopify=${shouldSyncToShopify}`,
    );

    if (shouldSyncToShopify) {
      const author = await this.findAuthorOrFail(nextAuthorId);
      const publishedBodyHtml = this.buildPublishedBodyHtml(
        nextContent,
        normalizedScriptAssetUrls ?? existingArticle.scriptAssetUrls ?? [],
      );

      this.logger.log(
        `[Shopify] sync-start articleId=${existingArticle.id} projectId=${existingArticle.projectId} status=${nextStatus} handle=${nextShopifyHandle} shopifyArticleId=${existingArticle.shopifyArticleId ?? 'none'} shopifyBlogId=${nextShopifyBlogId ?? 'default'}`,
      );

      shopifyPublication = await this.shopifyService.publishArticle({
        projectId: existingArticle.projectId,
        shopifyArticleId: existingArticle.shopifyArticleId,
        shopifyBlogId: nextShopifyBlogId,
        title: nextTitle,
        bodyHtml: publishedBodyHtml,
        handle: nextShopifyHandle,
        authorName: author?.name ?? null,
        authorMetaobjectId: author?.shopifyMetaobjectId ?? null,
        videoYoutubeUrl: nextVideoYoutubeUrl,
        isPublished: nextStatus === 'PUBLISHED' && !shouldScheduleOnShopify,
        publishDate: shopifyPublishDate,
      });

      this.logger.log(
        `[Shopify] sync-done articleId=${existingArticle.id} projectId=${existingArticle.projectId} shopifyArticleId=${shopifyPublication.id} shopifyBlogId=${shopifyPublication.blog?.id ?? existingArticle.shopifyBlogId ?? 'default'} handle=${nextShopifyHandle}`,
      );
    }

    const nextBlogHandle = await this.resolveBlogArticleBlogHandle({
      projectId: existingArticle.projectId,
      nextShopifyBlogId,
      existingShopifyBlogId: existingArticle.shopifyBlogId ?? null,
      shopifyPublication,
      existingUrl: existingArticle.url ?? null,
    });
    const nextUrl = await this.buildStorefrontBlogArticleUrl({
      projectId: existingArticle.projectId,
      blogHandle: nextBlogHandle,
      articleHandle: nextShopifyHandle,
    });

    const updateData = {
      ...(input.title !== undefined ? { title: nextTitle } : {}),
      ...(input.content !== undefined ? { content: nextContent } : {}),
      ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
      ...(nextUrl ? { url: nextUrl } : {}),
      ...(normalizedPrimaryKeyword !== undefined
        ? { primaryKeyword: normalizedPrimaryKeyword }
        : {}),
      ...(normalizedRequiredKeywords !== undefined
        ? { requiredKeywords: normalizedRequiredKeywords }
        : {}),
      ...(normalizedSeoTitle !== undefined
        ? { seoTitle: normalizedSeoTitle }
        : {}),
      ...(normalizedSeoDescription !== undefined
        ? { seoDescription: normalizedSeoDescription }
        : {}),
      ...(normalizedVideoYoutubeUrl !== undefined
        ? { videoYoutubeUrl: nextVideoYoutubeUrl }
        : {}),
      ...(normalizedPlannedFor !== undefined
        ? { plannedFor: normalizedPlannedFor }
        : {}),
      ...(normalizedReviewDueAt !== undefined
        ? { reviewDueAt: normalizedReviewDueAt }
        : {}),
      ...(normalizedShopifyBlogId !== undefined
        ? { shopifyBlogId: nextShopifyBlogId }
        : {}),
      ...(normalizedScriptAssetUrls !== undefined
        ? {
            blogArticleScriptAssets: {
              deleteMany: {},
              create: normalizedScriptAssetUrls.map((url, index) => ({
                url,
                position: index,
              })),
            },
          }
        : {}),
      ...(input.status !== undefined ? { status: nextStatus } : {}),
      ...(normalizedAuthorId !== undefined ? { authorId: nextAuthorId } : {}),
      ...(shopifyPublication
        ? {
            shopifyArticleId: shopifyPublication.id,
            shopifyBlogId:
              shopifyPublication.blog?.id ?? existingArticle.shopifyBlogId,
            publishedAt:
              nextStatus === 'PUBLISHED' && !shopifyPublishDate
                ? (existingArticle.publishedAt ?? new Date())
                : null,
          }
        : {}),
    };

    const updatedArticle = await this.updateBlogArticleWithOptionalScriptAssets(
      this.prisma,
      id,
      updateData,
    );

    return this.serializeBlogArticle(updatedArticle);
  }

  async remove(id: string) {
    await this.findOne(id);

    return (this.prisma as any).blogArticle.update({
      where: { id },
      data: { trashedAt: new Date() },
    });
  }

  async assignReview(
    id: string,
    input?: {
      supabaseUserId?: string | null;
      supabaseUserEmail?: string | null;
      supabaseUserName?: string | null;
      reviewDueAt?: string | null;
    } | null,
  ) {
    const existingArticle = await this.findOne(id);
    const normalizedReviewerId = this.toNullableTrimmed(input?.supabaseUserId);
    const normalizedReviewerEmail = this.toNullableTrimmed(
      input?.supabaseUserEmail,
    );
    const normalizedReviewerName = this.toNullableTrimmed(
      input?.supabaseUserName,
    );
    const normalizedReviewDueAt =
      input?.reviewDueAt === undefined
        ? undefined
        : this.toNullableDate(input.reviewDueAt);

    if (normalizedReviewerEmail && !normalizedReviewerEmail.includes('@')) {
      throw new BadRequestException(
        "L'email du reviewer Supabase est invalide.",
      );
    }

    if (normalizedReviewerId) {
      await (this.prisma as any).supabaseUser.upsert({
        where: {
          id: normalizedReviewerId,
        },
        update: {
          email: normalizedReviewerEmail ?? undefined,
          displayName: normalizedReviewerName ?? undefined,
        },
        create: {
          id: normalizedReviewerId,
          email: normalizedReviewerEmail ?? null,
          displayName: normalizedReviewerName ?? null,
        },
      });
    }

    const updatedArticle = await this.updateBlogArticleWithOptionalScriptAssets(
      this.prisma,
      existingArticle.id,
      {
        reviewSupabaseUserId: normalizedReviewerId,
        reviewAssignedAt: normalizedReviewerId ? new Date() : null,
        ...(normalizedReviewDueAt !== undefined
          ? { reviewDueAt: normalizedReviewDueAt }
          : {}),
        ...(normalizedReviewerId ? {} : { reviewCompletedAt: null }),
      },
    );

    return this.serializeBlogArticle(updatedArticle);
  }

  async setReviewStatus(
    id: string,
    input?: {
      isReviewCompleted?: boolean;
      reviewOutcome?: 'APPROVED' | 'REJECTED' | null;
      reviewComment?: string | null;
    } | null,
  ) {
    const existingArticle = await this.findOne(id);
    const isReviewCompleted = input?.isReviewCompleted;

    if (typeof isReviewCompleted !== 'boolean') {
      throw new BadRequestException(
        'Le champ "isReviewCompleted" est obligatoire.',
      );
    }

    const normalizedReviewComment = this.toNullableTrimmed(
      input?.reviewComment,
    );
    const normalizedReviewOutcome = this.toNullableTrimmed(
      input?.reviewOutcome,
    );

    if (isReviewCompleted) {
      if (
        normalizedReviewOutcome !== 'APPROVED' &&
        normalizedReviewOutcome !== 'REJECTED'
      ) {
        throw new BadRequestException(
          'Le champ "reviewOutcome" doit être APPROVED ou REJECTED.',
        );
      }

      if (normalizedReviewOutcome === 'REJECTED' && !normalizedReviewComment) {
        throw new BadRequestException(
          'Un commentaire est requis pour rejeter la review.',
        );
      }
    }

    const completedReviewOutcome =
      isReviewCompleted &&
      (normalizedReviewOutcome === 'APPROVED' ||
        normalizedReviewOutcome === 'REJECTED')
        ? normalizedReviewOutcome
        : null;

    const updatedArticle = await this.updateBlogArticleWithOptionalScriptAssets(
      this.prisma,
      existingArticle.id,
      {
        reviewCompletedAt: isReviewCompleted ? new Date() : null,
        reviewOutcome: completedReviewOutcome,
        reviewComment: isReviewCompleted ? normalizedReviewComment : null,
      },
    );

    await this.notifyAuthorWhenReviewApproved(
      existingArticle,
      updatedArticle,
      normalizedReviewOutcome,
      isReviewCompleted,
    );

    return this.serializeBlogArticle(updatedArticle);
  }

  private async notifyAuthorWhenReviewApproved(
    previousArticle: any,
    updatedArticle: any,
    reviewOutcome: string | null,
    isReviewCompleted: boolean,
  ) {
    if (!isReviewCompleted || reviewOutcome !== 'APPROVED') {
      return;
    }

    if (
      previousArticle?.reviewOutcome === 'APPROVED' &&
      previousArticle?.reviewCompletedAt
    ) {
      return;
    }

    const authorEmail = updatedArticle?.author?.email?.trim();

    if (!authorEmail) {
      this.logger.warn(
        `Impossible d'envoyer l'email de validation pour l'article ${updatedArticle?.id ?? 'unknown'}: auteur sans email.`,
      );
      return;
    }

    const articleTitle = updatedArticle?.title?.trim() || 'votre article';
    const articleUrl = updatedArticle?.url?.trim();
    const articleLink = articleUrl || '';
    const subject = `Votre article "${articleTitle}" a été validé`;
    const htmlParts = [
      `<p>Bonjour,</p>`,
      `<p>Votre article <strong>${this.escapeHtml(articleTitle)}</strong> vient d'être validé.</p>`,
      articleLink
        ? `<p>Vous pouvez le consulter ici : <a href="${this.escapeHtml(articleLink)}">${this.escapeHtml(articleLink)}</a></p>`
        : '',
      `<p>Bonne nouvelle pour la suite de la publication.</p>`,
      `<p>Blog Magify</p>`,
    ].filter(Boolean);

    try {
      await this.mailService.send({
        to: authorEmail,
        subject,
        html: htmlParts.join(''),
        text: [
          'Bonjour,',
          `Votre article "${articleTitle}" vient d'être validé.`,
          articleLink ? `Lien: ${articleLink}` : null,
          'Bonne nouvelle pour la suite de la publication.',
          'Blog Magify',
        ]
          .filter((value): value is string => Boolean(value))
          .join('\n\n'),
      });
    } catch (error) {
      this.logger.error(
        `Impossible d'envoyer l'email de validation pour l'article ${updatedArticle?.id ?? 'unknown'}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
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

  private normalizeIdeaTitle(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private buildBlogArticleGenerationErrorMessage(
    initialError: unknown,
    initialResponse: unknown,
    fallbackError: unknown,
    fallbackResponse: unknown,
  ) {
    const initialSummary = this.summarizeOpenAiFailure(
      initialError,
      initialResponse,
      'structured',
    );
    const fallbackSummary = this.summarizeOpenAiFailure(
      fallbackError,
      fallbackResponse,
      'fallback',
    );

    return [
      "La génération du brouillon d'article a échoué.",
      initialSummary,
      fallbackSummary,
    ].join(' ');
  }

  private summarizeOpenAiFailure(
    error: unknown,
    response: unknown,
    label: string,
  ) {
    const responseRecord =
      response && typeof response === 'object'
        ? (response as Record<string, unknown>)
        : {};
    const responseId =
      typeof responseRecord.id === 'string' ? responseRecord.id : 'unknown';
    const status =
      typeof responseRecord.status === 'string'
        ? responseRecord.status
        : 'unknown';
    const incompleteDetails =
      responseRecord.incomplete_details &&
      typeof responseRecord.incomplete_details === 'object'
        ? JSON.stringify(responseRecord.incomplete_details)
        : null;
    const outputText = extractOpenAiText(
      responseRecord as {
        output_parsed?: unknown;
        output_text?: string;
        output?: unknown[];
      },
    );
    const textPreview = outputText.trim()
      ? outputText.trim().slice(0, 220)
      : 'empty';
    const message = error instanceof Error ? error.message : String(error);

    return `[${label}] responseId=${responseId}, status=${status}, parserError=${message}, outputPreview=${JSON.stringify(
      textPreview,
    )}${incompleteDetails ? `, incomplete=${incompleteDetails}` : ''}.`;
  }

  private isMaxOutputTokensIncomplete(response: unknown) {
    if (!response || typeof response !== 'object') {
      return false;
    }

    const record = response as Record<string, unknown>;
    const status = record.status;
    const incompleteDetails = record.incomplete_details;

    if (status !== 'incomplete') {
      return false;
    }

    if (!incompleteDetails || typeof incompleteDetails !== 'object') {
      return false;
    }

    return (
      (incompleteDetails as Record<string, unknown>).reason ===
      'max_output_tokens'
    );
  }

  private resolveExpandedMaxOutputTokens(baseMaxOutputTokens: number) {
    return Math.min(
      Math.max(
        baseMaxOutputTokens + 800,
        Math.ceil(baseMaxOutputTokens * 1.75),
      ),
      8000,
    );
  }

  private async findAuthorOrFail(authorId?: string | null) {
    const normalizedAuthorId = authorId?.trim();

    if (!normalizedAuthorId) {
      return null;
    }

    const author = await (this.prisma as any).author.findFirst({
      where: {
        id: normalizedAuthorId,
        trashedAt: null,
      },
      select: {
        id: true,
        name: true,
        shopifyMetaobjectId: true,
      },
    });

    if (!author) {
      throw new NotFoundException(`Author ${normalizedAuthorId} not found`);
    }

    return author;
  }

  private buildShopifyHandle(
    preferredSlug: string | null | undefined,
    title: string,
    articleId: string,
  ) {
    const baseValue = preferredSlug?.trim() || title.trim() || articleId;
    const slug = baseValue
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);

    return slug || articleId.toLowerCase();
  }

  private async resolveBlogArticleBlogHandle(input: {
    projectId?: string | null;
    nextShopifyBlogId?: string | null;
    existingShopifyBlogId?: string | null;
    existingUrl?: string | null;
    shopifyPublication?: {
      id: string;
      blog: {
        id: string;
        title: string;
        handle: string;
      } | null;
    } | null;
  }) {
    const publicationBlogHandle =
      input.shopifyPublication?.blog?.handle?.trim();

    if (publicationBlogHandle) {
      return publicationBlogHandle;
    }

    const blogId =
      input.nextShopifyBlogId?.trim() ||
      input.existingShopifyBlogId?.trim() ||
      input.shopifyPublication?.blog?.id?.trim() ||
      null;

    if (input.projectId?.trim() && blogId) {
      const blogs = await this.shopifyService.getBlogs(input.projectId.trim());
      const matchingBlog = blogs.items.find((blog) => blog.id === blogId);
      const matchingHandle = matchingBlog?.handle?.trim();

      if (matchingHandle) {
        return matchingHandle;
      }
    }

    return this.extractBlogHandleFromArticleUrl(input.existingUrl);
  }

  private extractBlogHandleFromArticleUrl(url?: string | null) {
    const trimmedUrl = url?.trim();

    if (!trimmedUrl) {
      return null;
    }

    try {
      const pathname = new URL(trimmedUrl).pathname;
      const pathSegments = pathname.split('/').filter(Boolean);
      const blogsIndex = pathSegments.findIndex(
        (segment) => segment === 'blogs',
      );

      if (blogsIndex === -1) {
        return null;
      }

      return pathSegments[blogsIndex + 1]?.trim() || null;
    } catch {
      return null;
    }
  }

  private async buildStorefrontBlogArticleUrl(input: {
    projectId?: string | null;
    blogHandle?: string | null;
    articleHandle?: string | null;
  }) {
    const normalizedProjectId = input.projectId?.trim();
    const normalizedBlogHandle = input.blogHandle?.trim();
    const normalizedArticleHandle = input.articleHandle?.trim();

    if (
      !normalizedProjectId ||
      !normalizedBlogHandle ||
      !normalizedArticleHandle
    ) {
      return null;
    }

    const project = await (this.prisma as any).project.findUnique({
      where: {
        id: normalizedProjectId,
      },
      select: {
        shopifyStoreDomain: true,
      },
    });
    const storeDomain = buildShopifyStoreDomain(
      project?.shopifyStoreDomain?.trim() || '',
    );

    if (!storeDomain) {
      return null;
    }

    return `https://${storeDomain}/blogs/${normalizedBlogHandle}/${normalizedArticleHandle}`;
  }

  private normalizeScriptAssetUrls(value: string[] | null) {
    if (!value) {
      return [];
    }

    const normalizedUrls: string[] = [];
    const seenUrls = new Set<string>();

    for (const entry of value) {
      const trimmedEntry = entry?.trim();

      if (!trimmedEntry || seenUrls.has(trimmedEntry)) {
        continue;
      }

      seenUrls.add(trimmedEntry);
      normalizedUrls.push(trimmedEntry);
    }

    return normalizedUrls;
  }

  private buildPublishedBodyHtml(
    content: string | null | undefined,
    scriptAssetUrls: string[],
  ) {
    const normalizedContent = this.removeInjectedScriptAssetsBlock(
      content ?? '',
    );

    if (!scriptAssetUrls.length) {
      return normalizedContent;
    }

    const scriptVersion = Date.now().toString();
    const versionedScriptAssetUrls = scriptAssetUrls.map((url) =>
      this.appendCacheBuster(url, scriptVersion),
    );
    const loaderScript = [
      '<!-- blog-magify-script-assets:start -->',
      '<script>',
      '(function () {',
      `  const urls = ${JSON.stringify(versionedScriptAssetUrls)};`,
      '  urls.forEach(function (url) {',
      "    if (!url || document.querySelector('script[data-blog-article-asset-url=\"' + url + '\"]')) {",
      '      return;',
      '    }',
      '    const script = document.createElement("script");',
      '    script.src = url;',
      '    script.async = true;',
      '    script.dataset.blogArticleAssetUrl = url;',
      '    document.body.appendChild(script);',
      '  });',
      '})();',
      '</script>',
      '<!-- blog-magify-script-assets:end -->',
    ].join('\n');

    return normalizedContent.trim()
      ? `${normalizedContent.trim()}\n\n${loaderScript}`
      : loaderScript;
  }

  private appendCacheBuster(url: string, version: string) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return trimmedUrl;
    }

    const hashIndex = trimmedUrl.indexOf('#');
    const hash = hashIndex >= 0 ? trimmedUrl.slice(hashIndex) : '';
    const withoutHash =
      hashIndex >= 0 ? trimmedUrl.slice(0, hashIndex) : trimmedUrl;
    const separator = withoutHash.includes('?') ? '&' : '?';

    return `${withoutHash}${separator}v=${version}${hash}`;
  }

  private removeInjectedScriptAssetsBlock(content: string) {
    return content.replace(
      /\s*<!-- blog-magify-script-assets:start -->[\s\S]*?<!-- blog-magify-script-assets:end -->\s*/g,
      '',
    );
  }

  private serializeBlogArticle(article: any) {
    if (!article) {
      return article;
    }

    return {
      ...article,
      cluster: article.seoCluster ?? null,
      seoCluster: article.seoCluster ?? null,
      reviewSupabaseUserId: article.reviewSupabaseUserId ?? null,
      reviewSupabaseUserEmail: null,
      reviewSupabaseUserName: null,
      reviewAssignedAt: article.reviewAssignedAt?.toISOString?.() ?? null,
      reviewDueAt: article.reviewDueAt?.toISOString?.() ?? null,
      reviewCompletedAt: article.reviewCompletedAt?.toISOString?.() ?? null,
      isReviewCompleted: Boolean(article.reviewCompletedAt),
      scriptAssets: Array.isArray(article.blogArticleScriptAssets)
        ? article.blogArticleScriptAssets
            .map((scriptAsset: { url?: string | null }) =>
              scriptAsset.url?.trim(),
            )
            .filter((url: string | undefined): url is string => !!url)
        : [],
    };
  }

  private async findManyBlogArticlesWithOptionalScriptAssets(args: {
    where: Record<string, unknown>;
    orderBy?: unknown;
    take?: number;
  }) {
    try {
      const articles = await (this.prisma as any).blogArticle.findMany({
        ...args,
        include: blogArticleInclude,
      });

      this.isBlogArticleScriptAssetsTableAvailable = true;
      return articles;
    } catch (error) {
      if (!this.isMissingBlogArticleScriptAssetsTableError(error)) {
        throw error;
      }

      this.isBlogArticleScriptAssetsTableAvailable = false;
      return (this.prisma as any).blogArticle.findMany({
        ...args,
        include: blogArticleIncludeWithoutScriptAssets,
      });
    }
  }

  private async findFirstBlogArticleWithOptionalScriptAssets(args: {
    where: Record<string, unknown>;
  }) {
    try {
      const article = await (this.prisma as any).blogArticle.findFirst({
        ...args,
        include: blogArticleInclude,
      });

      this.isBlogArticleScriptAssetsTableAvailable = true;
      return article;
    } catch (error) {
      if (!this.isMissingBlogArticleScriptAssetsTableError(error)) {
        throw error;
      }

      this.isBlogArticleScriptAssetsTableAvailable = false;
      return (this.prisma as any).blogArticle.findFirst({
        ...args,
        include: blogArticleIncludeWithoutScriptAssets,
      });
    }
  }

  private async createBlogArticleWithOptionalScriptAssets(
    client: PrismaService | any,
    data: Record<string, unknown>,
  ) {
    const articleData =
      data && typeof data === 'object' && 'id' in data && data.id
        ? data
        : { id: randomUUID(), ...data };

    try {
      const article = await (client as any).blogArticle.create({
        data: articleData,
        include: blogArticleInclude,
      });

      this.isBlogArticleScriptAssetsTableAvailable = true;
      return article;
    } catch (error) {
      if (!this.isMissingBlogArticleScriptAssetsTableError(error)) {
        throw error;
      }

      this.isBlogArticleScriptAssetsTableAvailable = false;
      return (client as any).blogArticle.create({
        data: articleData,
        include: blogArticleIncludeWithoutScriptAssets,
      });
    }
  }

  private async updateBlogArticleWithOptionalScriptAssets(
    client: PrismaService | any,
    id: string,
    data: Record<string, unknown>,
  ) {
    try {
      const article = await (client as any).blogArticle.update({
        where: { id },
        data,
        include: blogArticleInclude,
      });

      this.isBlogArticleScriptAssetsTableAvailable = true;
      return article;
    } catch (error) {
      if (!this.isMissingBlogArticleScriptAssetsTableError(error)) {
        throw error;
      }

      this.isBlogArticleScriptAssetsTableAvailable = false;

      return (client as any).blogArticle.update({
        where: { id },
        data: this.removeScriptAssetsWrite(data),
        include: blogArticleIncludeWithoutScriptAssets,
      });
    }
  }

  private removeScriptAssetsWrite(data: Record<string, unknown>) {
    const { blogArticleScriptAssets, ...rest } = data;
    return rest;
  }

  private isMissingBlogArticleScriptAssetsTableError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : '';

    return message.includes('BlogArticleScriptAsset');
  }

  private toNullableTrimmed(value?: string | null) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }

  private toNullableDate(value?: string | null) {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00.000Z`)
      : new Date(trimmed);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(
        'La date de parution planifiée est invalide.',
      );
    }

    return parsedDate;
  }

  private isDateAfterToday(value: Date) {
    return value.getTime() > Date.now();
  }

  private toBlogArticleStatus(status?: string | null) {
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

  private toStatusFromShopifyArticle(publishedAt?: string | null) {
    const normalizedPublishedAt = publishedAt?.trim();

    if (!normalizedPublishedAt) {
      return 'PUSHED';
    }

    const parsedPublishedAt = new Date(normalizedPublishedAt);

    if (
      !Number.isNaN(parsedPublishedAt.getTime()) &&
      parsedPublishedAt.getTime() > Date.now()
    ) {
      return 'PLANNED';
    }

    return 'PUBLISHED';
  }

  private buildMatchingPageWhere(
    seoClusterId: string,
    articleUrl?: string | null,
    articleSlug?: string | null,
  ) {
    const filters = [
      articleUrl?.trim() ? { url: articleUrl.trim() } : null,
      articleSlug?.trim() ? { slug: articleSlug.trim() } : null,
    ].filter(Boolean);

    if (!filters.length) {
      return null;
    }

    return {
      seoClusterId,
      OR: filters,
    };
  }

  private async getSuggestedClusterIdForIdea(
    title: string,
    clusters: Array<{
      id: string;
      name: string;
      primaryKeyword: string;
      description?: string | null;
      parentCluster?: { name: string } | null;
    }>,
  ) {
    const clusterList = clusters
      .map((cluster) =>
        [`- id: ${cluster.id}`, `  name: ${cluster.name}`].join('\n'),
      )
      .join('\n');

    const response = await this.openAiPlatformService.createResponse({
      model: process.env.OPENAI_KEYWORD_ANALYSIS_MODEL || 'gpt-4.1-mini',
      promptType: 'BLOG_ARTICLE_CLUSTER_SUGGESTION',
      instructions:
        "Tu associes un titre d'article à un cluster SEO existant. Réponds uniquement avec l'id exact du meilleur cluster. Si aucun cluster n'est pertinent, réponds NONE.",
      input: [
        `Titre de l'idée: ${title}`,
        '',
        'Clusters disponibles :',
        clusterList,
      ].join('\n'),
      max_output_tokens: 40,
    });

    const outputText = extractOpenAiText(response);

    if (!outputText || outputText === 'NONE') {
      return null;
    }

    return (
      outputText
        .replace(/[`"'.,;:]/g, ' ')
        .split(/\s+/)
        .find(Boolean)
        ?.trim() ?? null
    );
  }
}
