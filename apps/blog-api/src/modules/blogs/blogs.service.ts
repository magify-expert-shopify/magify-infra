import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopifyService } from '../shopify/shopify.service';
import { normalizeUrlWithoutProtocol } from '../../common/utils/normalize.utils';
import { deriveNameFromUrl, normalizeUrl } from '../../common/utils/url.util';
import type {
  BlogArticleRelationSyncResult,
  BlogSyncAction,
  BlogSyncApplyInput,
  BlogSyncApplyResult,
  BlogSyncCandidate,
  BlogSyncExistingBlog,
  BlogSyncFieldComparison,
  BlogSyncPreview,
  BlogSyncPropertyKey,
  BlogSyncValueSource,
} from './blogs.types';

type ExistingBlogRow = BlogSyncExistingBlog;
type ShopifyBlogSnapshot = {
  id: string;
  title: string;
  handle: string;
  baseUrl: string;
  feedUrl: string;
};

@Injectable()
export class BlogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
  ) {}

  async getShopifyBlogSyncPreview(projectId: string): Promise<BlogSyncPreview> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      throw new NotFoundException('Projet introuvable.');
    }

    const project = await (this.prisma as any).project.findFirst({
      where: { id: normalizedProjectId },
      select: {
        id: true,
        name: true,
        shopifyStoreDomain: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable.');
    }

    const storeDomain = normalizeUrlWithoutProtocol(
      project.shopifyStoreDomain ?? '',
    );

    if (!storeDomain) {
      throw new NotFoundException(
        "Le projet n'a pas de domaine Shopify configuré.",
      );
    }

    const shopifyBlogs = await this.loadAllShopifyBlogs(
      normalizedProjectId,
      storeDomain,
    );
    const existingBlogs: ExistingBlogRow[] = await (
      this.prisma as any
    ).blog.findMany({
      where: {
        projectId: normalizedProjectId,
        trashedAt: null,
      },
      select: {
        id: true,
        baseUrl: true,
        name: true,
        title: true,
        slug: true,
        description: true,
        platform: true,
        languageCode: true,
        feedUrl: true,
        shopifyBlogId: true,
      },
    });

    const existingBlogsByShopifyId = new Map<string, ExistingBlogRow>(
      existingBlogs
        .filter((blog) => Boolean(blog.shopifyBlogId?.trim()))
        .map((blog) => [blog.shopifyBlogId!.trim(), blog]),
    );
    const existingBlogsByBaseUrl = new Map<string, ExistingBlogRow>(
      existingBlogs.map((blog) => [blog.baseUrl, blog]),
    );

    const candidates: Array<BlogSyncCandidate | null> = shopifyBlogs.map(
      (blog): BlogSyncCandidate | null => {
        const shopifyBlog = this.toShopifyBlogSnapshot(blog, storeDomain);
        const linkedByShopifyId =
          existingBlogsByShopifyId.get(shopifyBlog.id) ?? null;
        const linkedByBaseUrl =
          existingBlogsByBaseUrl.get(shopifyBlog.baseUrl) ?? null;
        const localBlog = linkedByShopifyId ?? linkedByBaseUrl;
        const matchedBy = linkedByShopifyId
          ? 'shopifyBlogId'
          : linkedByBaseUrl
            ? 'baseUrl'
            : null;
        const comparisons = this.buildBlogComparisons(localBlog, shopifyBlog);
        const hasDifferences = comparisons.some(
          (comparison) => comparison.isDifferent,
        );

        if (!localBlog) {
          return {
            shopifyBlog,
            localBlog: null,
            matchedBy: null,
            defaultAction: 'create_new' as BlogSyncAction,
            comparisons,
          };
        }

        if (!hasDifferences) {
          return null;
        }

        return {
          shopifyBlog,
          localBlog,
          matchedBy,
          defaultAction: 'sync_existing' as BlogSyncAction,
          comparisons,
        };
      },
    );

    return {
      projectId: normalizedProjectId,
      storeDomain,
      candidates: candidates.filter(
        (candidate): candidate is BlogSyncCandidate => candidate !== null,
      ),
      existingBlogs,
    };
  }

  async applyShopifyBlogSync(
    projectId: string,
    input: BlogSyncApplyInput,
  ): Promise<BlogSyncApplyResult> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      throw new NotFoundException('Projet introuvable.');
    }

    const project = await (this.prisma as any).project.findFirst({
      where: { id: normalizedProjectId },
      select: {
        id: true,
        name: true,
        shopifyStoreDomain: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable.');
    }

    const storeDomain = normalizeUrlWithoutProtocol(
      project.shopifyStoreDomain ?? '',
    );

    if (!storeDomain) {
      throw new NotFoundException(
        "Le projet n'a pas de domaine Shopify configuré.",
      );
    }

    const shopifyBlogs = await this.loadAllShopifyBlogs(
      normalizedProjectId,
      storeDomain,
    );
    const shopifyBlogsById = new Map(
      shopifyBlogs.map((blog) => [blog.id.trim(), blog]),
    );
    const existingBlogs = await (this.prisma as any).blog.findMany({
      where: {
        projectId: normalizedProjectId,
        trashedAt: null,
      },
      select: {
        id: true,
        baseUrl: true,
        name: true,
        title: true,
        slug: true,
        description: true,
        platform: true,
        languageCode: true,
        feedUrl: true,
        shopifyBlogId: true,
      },
    });
    const existingBlogsById = new Map<string, ExistingBlogRow>(
      existingBlogs.map((blog: ExistingBlogRow) => [blog.id, blog]),
    );
    const existingBlogsByShopifyId = new Map<string, ExistingBlogRow>(
      existingBlogs
        .filter((blog: ExistingBlogRow) => Boolean(blog.shopifyBlogId?.trim()))
        .map((blog: ExistingBlogRow) => [blog.shopifyBlogId!.trim(), blog]),
    );
    const existingBlogsByBaseUrl = new Map<string, ExistingBlogRow>(
      existingBlogs.map((blog: ExistingBlogRow) => [blog.baseUrl, blog]),
    );
    const competitorAgencySiteId = await this.resolveProjectAgencySiteId(
      normalizedProjectId,
      storeDomain,
      project.name,
    );

    let createdCount = 0;
    let associatedCount = 0;
    let synchronizedCount = 0;
    let ignoredCount = 0;

    for (const operation of input.operations ?? []) {
      const shopifyBlogId = operation.shopifyBlogId.trim();

      if (!shopifyBlogId) {
        continue;
      }

      if (operation.action === 'ignore') {
        ignoredCount += 1;
        continue;
      }

      const shopifyBlog = shopifyBlogsById.get(shopifyBlogId);
      if (!shopifyBlog) {
        continue;
      }

      if (operation.action === 'create_new') {
        await this.createBlogFromShopify(
          normalizedProjectId,
          competitorAgencySiteId,
          shopifyBlog,
          storeDomain,
        );
        createdCount += 1;
        continue;
      }

      const localTarget = operation.targetBlogId?.trim()
        ? (existingBlogsById.get(operation.targetBlogId.trim()) ?? null)
        : (existingBlogsByShopifyId.get(shopifyBlogId) ??
          existingBlogsByBaseUrl.get(shopifyBlog.baseUrl) ??
          null);

      if (!localTarget) {
        continue;
      }

      const updateData = this.buildBlogUpdateData(
        localTarget,
        shopifyBlog,
        operation.propertySources,
      );

      await (this.prisma as any).blog.update({
        where: { id: localTarget.id },
        data: {
          ...updateData,
          shopifyBlogId,
          projectId: normalizedProjectId,
          competitorAgencySiteId,
        },
      });

      if (operation.action === 'associate_existing') {
        associatedCount += 1;
      } else if (operation.action === 'sync_existing') {
        synchronizedCount += 1;
      }
    }

    return {
      processedCount: input.operations?.length ?? 0,
      createdCount,
      associatedCount,
      synchronizedCount,
      ignoredCount,
    };
  }

  async syncBlogArticleRelationsFromShopify(
    projectId: string,
  ): Promise<BlogArticleRelationSyncResult> {
    const normalizedProjectId = projectId.trim();

    if (!normalizedProjectId) {
      throw new NotFoundException('Projet introuvable.');
    }

    const project = await (this.prisma as any).project.findFirst({
      where: {
        id: normalizedProjectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable.');
    }

    const blogs = await (this.prisma as any).blog.findMany({
      where: {
        projectId: normalizedProjectId,
        trashedAt: null,
        shopifyBlogId: {
          not: null,
        },
      },
      select: {
        id: true,
        shopifyBlogId: true,
      },
    });

    const blogsByShopifyId = new Map<string, string>();
    for (const blog of blogs as Array<{
      id: string;
      shopifyBlogId: string | null;
    }>) {
      const shopifyBlogId = blog.shopifyBlogId?.trim();

      if (!shopifyBlogId || blogsByShopifyId.has(shopifyBlogId)) {
        continue;
      }

      blogsByShopifyId.set(shopifyBlogId, blog.id);
    }

    const articles = await (this.prisma as any).blogArticle.findMany({
      where: {
        projectId: normalizedProjectId,
        trashedAt: null,
        shopifyBlogId: {
          not: null,
        },
      },
      select: {
        id: true,
        blogId: true,
        shopifyBlogId: true,
      },
    });

    const articleIdsByBlogId = new Map<string, string[]>();
    let matchedArticlesCount = 0;
    let skippedCount = 0;

    for (const article of articles as Array<{
      id: string;
      blogId: string | null;
      shopifyBlogId: string | null;
    }>) {
      const shopifyBlogId = article.shopifyBlogId?.trim();

      if (!shopifyBlogId) {
        skippedCount += 1;
        continue;
      }

      const targetBlogId = blogsByShopifyId.get(shopifyBlogId);

      if (!targetBlogId) {
        skippedCount += 1;
        continue;
      }

      matchedArticlesCount += 1;

      if (article.blogId === targetBlogId) {
        continue;
      }

      const existing = articleIdsByBlogId.get(targetBlogId) ?? [];
      existing.push(article.id);
      articleIdsByBlogId.set(targetBlogId, existing);
    }

    let updatedCount = 0;

    for (const [blogId, articleIds] of articleIdsByBlogId.entries()) {
      if (!articleIds.length) {
        continue;
      }

      const result = await (this.prisma as any).blogArticle.updateMany({
        where: {
          id: {
            in: articleIds,
          },
          projectId: normalizedProjectId,
          trashedAt: null,
        },
        data: {
          blogId,
        },
      });

      updatedCount += result.count ?? 0;
    }

    return {
      projectId: normalizedProjectId,
      matchedBlogsCount: blogsByShopifyId.size,
      matchedArticlesCount,
      updatedCount,
      skippedCount,
    };
  }

  async syncShopifyBlogs(projectId: string) {
    return this.getShopifyBlogSyncPreview(projectId);
  }

  async findOrCreateDiscoveredBlog(input: {
    competitorAgencySiteId: string;
    baseUrl: string;
    name?: string | null;
  }) {
    const normalizedBaseUrl = input.baseUrl.replace(/\/$/, '');
    const existingBlog = await (this.prisma as any).blog.findFirst({
      where: {
        competitorAgencySiteId: input.competitorAgencySiteId,
        baseUrl: normalizedBaseUrl,
      },
    });

    if (existingBlog) {
      if (existingBlog.trashedAt) {
        return (this.prisma as any).blog.update({
          where: { id: existingBlog.id },
          data: {
            trashedAt: null,
            name: existingBlog.name ?? input.name ?? null,
          },
        });
      }

      if (!existingBlog.name && input.name) {
        return (this.prisma as any).blog.update({
          where: { id: existingBlog.id },
          data: {
            name: input.name,
          },
        });
      }

      return existingBlog;
    }

    try {
      const site = await (this.prisma as any).competitorAgencySite.findFirst({
        where: {
          id: input.competitorAgencySiteId,
        },
        select: {
          projectId: true,
        },
      });

      return await (this.prisma as any).blog.create({
        data: {
          competitorAgencySiteId: input.competitorAgencySiteId,
          projectId: site?.projectId ?? null,
          baseUrl: normalizedBaseUrl,
          name: input.name ?? null,
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') {
        throw error;
      }

      const concurrentBlog = await (this.prisma as any).blog.findFirst({
        where: {
          competitorAgencySiteId: input.competitorAgencySiteId,
          baseUrl: normalizedBaseUrl,
        },
      });

      if (!concurrentBlog) {
        throw error;
      }

      if (concurrentBlog.trashedAt || (!concurrentBlog.name && input.name)) {
        return (this.prisma as any).blog.update({
          where: { id: concurrentBlog.id },
          data: {
            trashedAt: null,
            name: concurrentBlog.name ?? input.name ?? null,
          },
        });
      }

      return concurrentBlog;
    }
  }

  async search(query: string) {
    return (this.prisma as any).blog.findMany({
      where: {
        trashedAt: null,
        OR: [
          { name: { contains: query } },
          { title: { contains: query } },
          { description: { contains: query } },
          { baseUrl: { contains: query } },
          { feedUrl: { contains: query } },
          { slug: { contains: query } },
        ],
      },
      include: {
        competitorAgencySite: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  }

  async findAll(projectId: string) {
    return (this.prisma as any).blog.findMany({
      where: { trashedAt: null, projectId },
      include: {
        _count: {
          select: {
            articles: {
              where: { trashedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllIds() {
    const blogs = await (this.prisma as any).blog.findMany({
      where: { trashedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    return blogs.map((blog: { id: string }) => blog.id);
  }

  async findByAgencySite(competitorAgencySiteId: string) {
    return (this.prisma as any).blog.findMany({
      where: {
        competitorAgencySiteId,
        trashedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, projectId?: string | null) {
    const normalizedProjectId = projectId?.trim();
    const blog = await (this.prisma as any).blog.findFirst({
      where: {
        id,
        trashedAt: null,
        ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
      },
    });

    if (!blog) {
      throw new NotFoundException(`Blog ${id} not found`);
    }

    return blog;
  }

  async markAsScanned(id: string) {
    await this.findOne(id);

    return (this.prisma as any).blog.update({
      where: { id },
      data: { lastScannedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return (this.prisma as any).blog.update({
      where: { id },
      data: { trashedAt: new Date() },
    });
  }

  private async loadAllShopifyBlogs(projectId: string, storeDomain: string) {
    const blogs: ShopifyBlogSnapshot[] = [];
    let after: string | null = null;

    do {
      const page = await this.shopifyService.getBlogs(projectId, {
        first: 100,
        after,
      });

      blogs.push(
        ...page.items.map((item) =>
          this.toShopifyBlogSnapshot(item, storeDomain),
        ),
      );
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return blogs;
  }

  private toShopifyBlogSnapshot(
    blog: { id: string; title: string; handle: string },
    storeDomain: string,
  ): ShopifyBlogSnapshot {
    const handle = blog.handle.trim();
    const baseUrl = normalizeUrl(`https://${storeDomain}/blogs/${handle}`);

    return {
      id: blog.id.trim(),
      title: blog.title.trim(),
      handle,
      baseUrl,
      feedUrl: `${baseUrl}.atom`,
    };
  }

  private buildBlogComparisons(
    localBlog: ExistingBlogRow | null,
    shopifyBlog: ShopifyBlogSnapshot,
  ): BlogSyncFieldComparison[] {
    const comparisons: Array<
      [BlogSyncPropertyKey, string, string | null, string | null]
    > = [
      ['name', 'Nom', localBlog?.name ?? null, shopifyBlog.title ?? null],
      ['title', 'Titre', localBlog?.title ?? null, shopifyBlog.title ?? null],
      ['slug', 'Slug', localBlog?.slug ?? null, shopifyBlog.handle ?? null],
      [
        'baseUrl',
        'URL',
        localBlog?.baseUrl ?? null,
        shopifyBlog.baseUrl ?? null,
      ],
      [
        'feedUrl',
        'Flux',
        localBlog?.feedUrl ?? null,
        shopifyBlog.feedUrl ?? null,
      ],
      ['platform', 'Plateforme', localBlog?.platform ?? null, 'SHOPIFY'],
    ];

    return comparisons.map(([key, label, localValue, shopifyValue]) => ({
      key,
      label,
      localValue,
      shopifyValue,
      isDifferent: (localValue ?? '') !== (shopifyValue ?? ''),
    }));
  }

  private buildBlogUpdateData(
    localBlog: ExistingBlogRow,
    shopifyBlog: ShopifyBlogSnapshot,
    propertySources?: Partial<Record<BlogSyncPropertyKey, BlogSyncValueSource>>,
  ) {
    const selectValue = (key: BlogSyncPropertyKey) =>
      propertySources?.[key] === 'local' ? 'local' : 'shopify';

    return {
      name:
        selectValue('name') === 'local' ? localBlog.name : shopifyBlog.title,
      title:
        selectValue('title') === 'local' ? localBlog.title : shopifyBlog.title,
      slug:
        selectValue('slug') === 'local' ? localBlog.slug : shopifyBlog.handle,
      baseUrl:
        selectValue('baseUrl') === 'local'
          ? localBlog.baseUrl
          : shopifyBlog.baseUrl,
      feedUrl:
        selectValue('feedUrl') === 'local'
          ? localBlog.feedUrl
          : shopifyBlog.feedUrl,
      platform:
        selectValue('platform') === 'local'
          ? (localBlog.platform ?? null)
          : 'SHOPIFY',
    };
  }

  private async createBlogFromShopify(
    projectId: string,
    competitorAgencySiteId: string,
    shopifyBlog: { id: string; title: string; handle: string },
    storeDomain: string,
  ) {
    const snapshot = this.toShopifyBlogSnapshot(shopifyBlog, storeDomain);

    return await (this.prisma as any).blog.create({
      data: {
        projectId,
        competitorAgencySiteId,
        shopifyBlogId: snapshot.id,
        name: snapshot.title,
        title: snapshot.title,
        baseUrl: snapshot.baseUrl,
        feedUrl: snapshot.feedUrl,
        slug: snapshot.handle,
        platform: 'SHOPIFY',
      },
    });
  }

  private async resolveProjectAgencySiteId(
    projectId: string,
    storeDomain: string,
    projectName: string,
  ) {
    const existingSite = await (
      this.prisma as any
    ).competitorAgencySite.findFirst({
      where: {
        projectId,
        trashedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existingSite?.id) {
      return existingSite.id;
    }

    const normalizedBaseUrl = normalizeUrl(`https://${storeDomain}`);
    const existingByBaseUrl = await (
      this.prisma as any
    ).competitorAgencySite.findFirst({
      where: {
        baseUrl: normalizedBaseUrl,
      },
      select: {
        id: true,
        trashedAt: true,
      },
    });

    if (existingByBaseUrl?.id) {
      if (existingByBaseUrl.trashedAt) {
        const restored = await (this.prisma as any).competitorAgencySite.update(
          {
            where: { id: existingByBaseUrl.id },
            data: {
              trashedAt: null,
              projectId,
              name: deriveNameFromUrl(normalizedBaseUrl) || projectName,
            },
          },
        );

        return restored.id;
      }

      await (this.prisma as any).competitorAgencySite.update({
        where: { id: existingByBaseUrl.id },
        data: {
          projectId,
        },
      });

      return existingByBaseUrl.id;
    }

    const createdSite = await (this.prisma as any).competitorAgencySite.create({
      data: {
        baseUrl: normalizedBaseUrl,
        name: deriveNameFromUrl(normalizedBaseUrl) || projectName,
        projectId,
      },
    });

    return createdSite.id;
  }
}
