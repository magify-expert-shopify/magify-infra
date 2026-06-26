import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SHOPIFY_AUTHOR_METAOBJECT_DEFINITION_FIELDS,
  SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES,
} from '../authors/authors.constants';
import { ShopifyAuthService } from './shopify-auth.service';
import type {
  ShopifyArticleCreateMutationResponse,
  ShopifyAllBlogArticlesQueryResponse,
  ShopifyArticleQueryResponse,
  ShopifyArticleUpdateMutationResponse,
  ShopifyBlogArticlesQueryResponse,
  ShopifyBlogsQueryResponse,
  ShopifyImagesQueryResponse,
  ShopifyPagesQueryResponse,
  ShopifyAuthorMetaobjectQueryResponse,
  ShopifyAuthorMetaobjectUpsertInput,
  ShopifyAuthorMetaobjectsQueryResponse,
  ShopifyMetaobjectCreateMutationResponse,
  ShopifyMetaobjectDefinitionsQueryResponse,
  ShopifyMetaobjectDefinitionUpdateMutationResponse,
  ShopifyMetaobjectDeleteMutationResponse,
  ShopifyMetaobjectFieldInput,
  ShopifyMetaobjectMutationPayload,
  ShopifyMetaobjectUpsertMutationResponse,
  ShopifyGraphqlResponse,
  ShopifyArticleMutationPayload,
  ShopifyGraphqlVariables,
  ShopifyShopQueryResponse,
} from './shopify.types';
import {
  ShopifyAuthorMetaobject,
  ShopifyBlogArticleListItem,
  ShopifyBlogListItem,
  ShopifyPageListItem,
} from 'src/common/types';

type ShopifyConnectionPage<T> = {
  items: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
};

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(
    private readonly shopifyAuthService: ShopifyAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async publishArticle(input: {
    projectId: string;
    shopifyArticleId?: string | null;
    shopifyBlogId?: string | null;
    title: string;
    bodyHtml?: string | null;
    handle: string;
    authorName?: string | null;
    authorMetaobjectId?: string | null;
    videoYoutubeUrl?: string | null;
    isPublished: boolean;
    publishDate?: string | null;
  }) {
    const normalizedShopifyArticleId = input.shopifyArticleId?.trim() || null;

    if (normalizedShopifyArticleId) {
      this.logger.log({
        event: 'shopify.article.update.started',
        projectId: input.projectId,
        shopifyArticleId: normalizedShopifyArticleId,
        shopifyBlogId: input.shopifyBlogId?.trim() || null,
        handle: input.handle,
        isPublished: input.isPublished,
        publishDate: input.publishDate?.trim() || null,
      });

      try {
        const article = await this.updateArticle({
          projectId: input.projectId,
          shopifyArticleId: normalizedShopifyArticleId,
          shopifyBlogId: input.shopifyBlogId,
          title: input.title,
          bodyHtml: input.bodyHtml,
          handle: input.handle,
          authorName: input.authorName,
          authorMetaobjectId: input.authorMetaobjectId,
          videoYoutubeUrl: input.videoYoutubeUrl,
          isPublished: input.isPublished,
          publishDate: input.publishDate,
        });

        this.logger.log({
          event: 'shopify.article.update.succeeded',
          projectId: input.projectId,
          shopifyArticleId: article.id,
          shopifyBlogId: article.blog?.id ?? null,
          handle: article.handle,
        });

        return article;
      } catch (error) {
        if (!this.isMissingResourceError(error)) {
          this.logger.error({
            event: 'shopify.article.update.failed',
            projectId: input.projectId,
            shopifyArticleId: normalizedShopifyArticleId,
            shopifyBlogId: input.shopifyBlogId?.trim() || null,
            handle: input.handle,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        this.logger.warn({
          event: 'shopify.article.update.missing_remote_article',
          projectId: input.projectId,
          shopifyArticleId: normalizedShopifyArticleId,
          handle: input.handle,
          fallback: 'create',
        });
      }
    }

    this.logger.log({
      event: 'shopify.article.create.started',
      projectId: input.projectId,
      shopifyBlogId: input.shopifyBlogId?.trim() || null,
      handle: input.handle,
      isPublished: input.isPublished,
      publishDate: input.publishDate?.trim() || null,
    });

    try {
      const article = await this.createArticle({
        projectId: input.projectId,
        shopifyBlogId: input.shopifyBlogId,
        title: input.title,
        bodyHtml: input.bodyHtml,
        handle: input.handle,
        authorName: input.authorName,
        authorMetaobjectId: input.authorMetaobjectId,
        videoYoutubeUrl: input.videoYoutubeUrl,
        isPublished: input.isPublished,
        publishDate: input.publishDate,
      });

      this.logger.log({
        event: 'shopify.article.create.succeeded',
        projectId: input.projectId,
        shopifyArticleId: article.id,
        shopifyBlogId: article.blog?.id ?? null,
        handle: article.handle,
      });

      return article;
    } catch (error) {
      this.logger.error({
        event: 'shopify.article.create.failed',
        projectId: input.projectId,
        shopifyBlogId: input.shopifyBlogId?.trim() || null,
        handle: input.handle,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getBlogs(
    projectId: string,
    input?: {
      first?: number;
      after?: string | null;
      last?: number;
      before?: string | null;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const hasBackwardPagination =
      input?.last !== undefined || input?.before !== undefined;
    const pageSize = this.normalizePageSize(
      hasBackwardPagination ? input?.last : input?.first,
    );
    const after = this.toNullableTrimmed(input?.after);
    const before = this.toNullableTrimmed(input?.before);
    const variables = hasBackwardPagination
      ? {
          last: pageSize,
          ...(before !== null ? { before } : {}),
        }
      : {
          first: pageSize,
          ...(after !== null ? { after } : {}),
        };
    const response = await this.graphql<ShopifyBlogsQueryResponse>(
      storeDomain,
      `
        query GetBlogs($first: Int, $after: String, $last: Int, $before: String) {
          blogs(first: $first, after: $after, last: $last, before: $before) {
            nodes {
              id
              title
              handle
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `,
      variables,
    );

    return {
      items: response.blogs.nodes,
      pageInfo: response.blogs.pageInfo,
    } satisfies ShopifyConnectionPage<ShopifyBlogListItem>;
  }

  async getPages(
    projectId: string,
    input?: {
      first?: number;
      after?: string | null;
      last?: number;
      before?: string | null;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const hasBackwardPagination =
      input?.last !== undefined || input?.before !== undefined;
    const pageSize = this.normalizePageSize(
      hasBackwardPagination ? input?.last : input?.first,
    );
    const after = this.toNullableTrimmed(input?.after);
    const before = this.toNullableTrimmed(input?.before);
    const variables = hasBackwardPagination
      ? {
          last: pageSize,
          ...(before !== null ? { before } : {}),
        }
      : {
          first: pageSize,
          ...(after !== null ? { after } : {}),
        };
    const response = await this.graphql<ShopifyPagesQueryResponse>(
      storeDomain,
      `
        query GetPages($first: Int, $after: String, $last: Int, $before: String) {
          pages(first: $first, after: $after, last: $last, before: $before) {
            nodes {
              id
              title
              handle
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `,
      variables,
    );

    return {
      items: response.pages.nodes,
      pageInfo: response.pages.pageInfo,
    } satisfies ShopifyConnectionPage<ShopifyPageListItem>;
  }

  async getImages(projectId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const response = await this.graphql<ShopifyImagesQueryResponse>(
      storeDomain,
      `
        query GetImages {
          files(first: 100, query: "media_type:IMAGE") {
            nodes {
              ... on MediaImage {
                id
                alt
                image {
                  url
                  width
                  height
                }
              }
            }
          }
        }
      `,
    );

    return response.files.nodes
      .filter((image) => image.image?.url)
      .map((image) => ({
        id: image.id,
        url: image.image!.url,
        alt: image.alt,
        width: image.image?.width ?? null,
        height: image.image?.height ?? null,
      }));
  }

  async getBlogArticles(projectId: string, blogId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const normalizedBlogId = blogId.trim();

    if (!normalizedBlogId) {
      throw new BadRequestException('Shopify blog id is required.');
    }

    const response = await this.graphql<ShopifyBlogArticlesQueryResponse>(
      storeDomain,
      `
        query GetBlogArticles($id: ID!) {
          blog(id: $id) {
            id
            title
            handle
            articles(first: 100) {
              nodes {
                id
                title
                handle
                publishedAt
              }
            }
          }
        }
      `,
      {
        id: normalizedBlogId,
      },
    );

    if (!response.blog) {
      throw new BadRequestException(
        `Shopify blog ${normalizedBlogId} not found.`,
      );
    }

    return response.blog.articles.nodes.map<ShopifyBlogArticleListItem>(
      (article) => ({
        id: article.id,
        title: article.title,
        handle: article.handle,
        publishedAt: article.publishedAt,
        blog: {
          id: response.blog!.id,
          title: response.blog!.title,
          handle: response.blog!.handle,
        },
      }),
    );
  }

  async getBlogArticlesList(projectId: string) {
    const articles: ShopifyBlogArticleListItem[] = [];
    let after: string | null = null;

    do {
      const page = await this.getBlogArticlesListPage(projectId, {
        first: 100,
        after,
      });
      articles.push(...page.items);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return articles;
  }

  async getBlogArticlesListPage(
    projectId: string,
    input?: {
      first?: number;
      after?: string | null;
      last?: number;
      before?: string | null;
      includePublishedAt?: boolean;
      includeAssociatedBlogArticle?: boolean;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const includePublishedAt = input?.includePublishedAt === true;
    const includeAssociatedBlogArticle =
      input?.includeAssociatedBlogArticle === true;
    const response = await this.graphql<ShopifyAllBlogArticlesQueryResponse>(
      storeDomain,
      `
        query GetBlogArticlesList(
          $first: Int
          $after: String
          $last: Int
          $before: String
        ) {
          articles(
            first: $first
            after: $after
            last: $last
            before: $before
            sortKey: PUBLISHED_AT
            reverse: true
          ) {
            nodes {
              id
              title
              handle
              publishedAt
              blog {
                id
                title
                handle
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `,
      {
        ...(input?.first !== undefined
          ? { first: this.normalizePageSize(input.first) }
          : {}),
        ...(input?.after !== undefined ? { after: input.after } : {}),
        ...(input?.last !== undefined
          ? { last: this.normalizePageSize(input.last) }
          : {}),
        ...(input?.before !== undefined ? { before: input.before } : {}),
      },
    );

    const items = response.articles.nodes
      .filter((article) => article.blog)
      .map<ShopifyBlogArticleListItem>((article) => ({
        id: article.id,
        title: article.title,
        handle: article.handle,
        ...(includePublishedAt ? { publishedAt: article.publishedAt } : {}),
        blog: {
          id: article.blog!.id,
          title: article.blog!.title,
          handle: article.blog!.handle,
        },
      }));

    return {
      items: includeAssociatedBlogArticle
        ? await Promise.all(
            items.map((article) => this.attachAssociatedBlogArticle(article)),
          )
        : items,
      pageInfo: response.articles.pageInfo,
    } satisfies ShopifyConnectionPage<ShopifyBlogArticleListItem>;
  }

  async getArticle(projectId: string, articleId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const normalizedArticleId = articleId.trim();

    if (!normalizedArticleId) {
      throw new BadRequestException('Shopify article id is required.');
    }

    const response = await this.graphql<ShopifyArticleQueryResponse>(
      storeDomain,
      `
        query GetArticle($id: ID!) {
          article(id: $id) {
            id
            title
            handle
            publishedAt
            body
            summary
            tags
            blog {
              id
              title
              handle
            }
          }
        }
      `,
      {
        id: normalizedArticleId,
      },
    );

    if (!response.article) {
      throw new BadRequestException(
        `Shopify article ${normalizedArticleId} not found.`,
      );
    }

    return this.attachAssociatedBlogArticle(response.article);
  }

  async pullArticle(projectId: string, articleId: string) {
    const article = await this.getArticle(projectId, articleId);
    const existingArticle = article.associatedBlogArticle
      ? await (this.prisma as any).blogArticle.findFirst({
          where: {
            id: article.associatedBlogArticle.id,
            trashedAt: null,
          },
          include: {
            blog: true,
            seoCluster: true,
            author: true,
          },
        })
      : null;

    if (existingArticle) {
      if (!existingArticle.projectId && projectId?.trim()) {
        return (this.prisma as any).blogArticle.update({
          where: { id: existingArticle.id },
          data: {
            projectId: projectId.trim(),
          },
          include: {
            blog: true,
            seoCluster: true,
            author: true,
          },
        });
      }

      return existingArticle;
    }

    return (this.prisma as any).blogArticle.create({
      data: {
        title: article.title.trim() || 'Sans titre',
        slug: this.toNullableTrimmed(article.handle),
        excerpt: this.toNullableTrimmed(article.summary),
        content: article.body,
        status: article.publishedAt ? 'PUBLISHED' : 'DRAFT',
        shopifyArticleId: article.id,
        shopifyBlogId: article.blog?.id ?? null,
        projectId: projectId.trim() || null,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      },
      include: {
        blog: true,
        seoCluster: true,
        author: true,
      },
    });
  }

  async getShop(projectId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const response = await this.graphql<ShopifyShopQueryResponse>(
      storeDomain,
      `
        query GetShop {
          shop {
            id
            name
            email
            description
            myshopifyDomain
            primaryDomain {
              host
              url
            }
          }
        }
      `,
    );

    return response.shop;
  }

  async getAuthorMetaobjectsForSync(projectId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const definition = await this.getAuthorMetaobjectDefinition(projectId);

    if (!definition) {
      return [];
    }

    const response = await this.graphql<ShopifyAuthorMetaobjectsQueryResponse>(
      storeDomain,
      `
        query GetAuthorMetaobjects($type: String!) {
          metaobjects(type: $type, first: 100) {
            nodes {
              id
              handle
              type
              updatedAt
              fields {
                key
                value
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Page {
                    id
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      `,
      {
        type: definition.type,
      },
    );

    return response.metaobjects.nodes.map<ShopifyAuthorMetaobject>(
      (metaobject) => this.mapAuthorMetaobject(metaobject),
    );
  }

  async getAuthorMetaobjects(projectId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const definition = await this.getAuthorMetaobjectDefinition(projectId);

    if (!definition) {
      return [];
    }

    const response = await this.graphql<any>(
      storeDomain,
      `
        query GetAuthorMetaobjects($type: String!) {
          metaobjects(type: $type, first: 100) {
            nodes {
              id
              handle
              type
              updatedAt
              fields {
                key
                value
              }
            }
          }
        }
      `,
      { type: definition.type },
    );

    return response.metaobjects.nodes;
  }

  async getAuthorMetaobject(projectId: string, id: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new BadRequestException(
        'Shopify author metaobject id is required.',
      );
    }

    const response = await this.graphql<ShopifyAuthorMetaobjectQueryResponse>(
      storeDomain,
      `
        query GetAuthorMetaobject($id: ID!) {
          metaobject(id: $id) {
            id
            handle
            type
            updatedAt
              fields {
                key
                value
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Page {
                    id
                    title
                    handle
                  }
                }
              }
            }
          }
      `,
      {
        id: normalizedId,
      },
    );

    if (!response.metaobject) {
      throw new BadRequestException(
        `Shopify author metaobject ${normalizedId} not found.`,
      );
    }

    return this.mapAuthorMetaobject(response.metaobject);
  }

  async createAuthorMetaobject(
    projectId: string,
    input: {
      values: ShopifyAuthorMetaobjectUpsertInput;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const definition = await this.requireAuthorMetaobjectDefinition(projectId);
    const response =
      await this.graphql<ShopifyMetaobjectCreateMutationResponse>(
        storeDomain,
        `
        mutation CreateAuthorMetaobject($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject {
              id
              handle
              type
              updatedAt
              fields {
                key
                value
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Page {
                    id
                    title
                    handle
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          metaobject: {
            type: definition.type,
            handle: input.values.handle,
            fields: this.buildAuthorMetaobjectFields(
              definition,
              input.values,
              'create',
            ),
          },
        },
      );

    return this.unwrapMetaobjectMutationPayload(response.metaobjectCreate);
  }

  async updateAuthorMetaobject(
    projectId: string,
    input: {
      id: string;
      values: ShopifyAuthorMetaobjectUpsertInput;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const definition = await this.requireAuthorMetaobjectDefinition(projectId);
    const currentMetaobject = await this.getAuthorMetaobject(
      projectId,
      input.id,
    );
    const response =
      await this.graphql<ShopifyMetaobjectUpsertMutationResponse>(
        storeDomain,
        `
        mutation UpsertAuthorMetaobject(
          $handle: MetaobjectHandleInput!
          $metaobject: MetaobjectUpsertInput!
        ) {
          metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
            metaobject {
              id
              handle
              type
              updatedAt
              fields {
                key
                value
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Page {
                    id
                    title
                    handle
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          handle: {
            type: definition.type,
            handle: currentMetaobject.handle,
          },
          metaobject: {
            handle: input.values.handle,
            fields: this.buildAuthorMetaobjectFields(
              definition,
              input.values,
              'create',
            ),
          },
        },
      );

    return this.unwrapMetaobjectMutationPayload(response.metaobjectUpsert);
  }

  async deleteAuthorMetaobject(projectId: string, id: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const response =
      await this.graphql<ShopifyMetaobjectDeleteMutationResponse>(
        storeDomain,
        `
        mutation DeleteAuthorMetaobject($id: ID!) {
          metaobjectDelete(id: $id) {
            deletedId
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          id,
        },
      );

    if (response.metaobjectDelete.userErrors.length) {
      throw new Error(
        `Shopify metaobject delete error: ${response.metaobjectDelete.userErrors
          .map((error) => error.message)
          .join(', ')}`,
      );
    }

    if (!response.metaobjectDelete.deletedId) {
      throw new Error("Shopify n'a pas confirmé la suppression du metaobject.");
    }

    return response.metaobjectDelete.deletedId;
  }

  async updateMetaobjectDefinition(
    projectId: string,
    input: {
      id: string;
      definition: Record<string, unknown>;
    },
  ) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const response =
      await this.graphql<ShopifyMetaobjectDefinitionUpdateMutationResponse>(
        storeDomain,
        `
          mutation UpdateMetaobjectDefinition(
            $id: ID!
            $definition: MetaobjectDefinitionUpdateInput!
          ) {
            metaobjectDefinitionUpdate(id: $id, definition: $definition) {
              metaobjectDefinition {
                id
                name
                type
                displayNameKey
                fieldDefinitions {
                  key
                  name
                  description
                  type {
                    name
                  }
                }
              }
              userErrors {
                field
                message
                code
              }
            }
          }
        `,
        input,
      );

    const payload = response.metaobjectDefinitionUpdate;

    if (payload.userErrors.length) {
      throw new Error(
        `Shopify metaobject definition update error: ${payload.userErrors
          .map((error) => error.message)
          .join(', ')}`,
      );
    }

    if (!payload.metaobjectDefinition) {
      throw new Error(
        "Shopify n'a pas renvoyé de définition de metaobject mise à jour.",
      );
    }

    return payload.metaobjectDefinition;
  }

  async syncAuthorMetaobjectDefinition(projectId: string) {
    const definition = await this.requireAuthorMetaobjectDefinition(projectId);
    const existingFields = new Map(
      definition.fieldDefinitions.map((fieldDefinition) => [
        fieldDefinition.key,
        fieldDefinition,
      ]),
    );
    const expectedFieldKeys = new Set<string>(
      SHOPIFY_AUTHOR_METAOBJECT_DEFINITION_FIELDS.map(
        (fieldDefinition) => fieldDefinition.key,
      ),
    );
    const fieldDefinitions: Array<Record<string, unknown>> = [];

    for (const fieldDefinition of SHOPIFY_AUTHOR_METAOBJECT_DEFINITION_FIELDS) {
      const existingField = existingFields.get(fieldDefinition.key);

      if (!existingField) {
        fieldDefinitions.push({
          create: {
            key: fieldDefinition.key,
            name: fieldDefinition.name,
            description: fieldDefinition.description,
            type: fieldDefinition.type,
          },
        });
        continue;
      }

      if (existingField.type?.name !== fieldDefinition.type) {
        fieldDefinitions.push({
          delete: {
            key: fieldDefinition.key,
          },
        });
        fieldDefinitions.push({
          create: {
            key: fieldDefinition.key,
            name: fieldDefinition.name,
            description: fieldDefinition.description,
            type: fieldDefinition.type,
          },
        });
        continue;
      }

      if (
        existingField.name !== fieldDefinition.name ||
        (existingField.description ?? null) !==
          (fieldDefinition.description ?? null)
      ) {
        fieldDefinitions.push({
          update: {
            key: fieldDefinition.key,
            name: fieldDefinition.name,
            description: fieldDefinition.description,
          },
        });
      }
    }

    for (const existingField of definition.fieldDefinitions) {
      if (expectedFieldKeys.has(existingField.key)) {
        continue;
      }

      if (
        existingField.key === 'page_link' ||
        existingField.key === 'page_url'
      ) {
        fieldDefinitions.push({
          delete: {
            key: existingField.key,
          },
        });
      }
    }

    if (definition.displayNameKey === 'name' && fieldDefinitions.length === 0) {
      return definition;
    }

    return this.updateMetaobjectDefinition(projectId, {
      id: definition.id,
      definition: {
        displayNameKey: 'name',
        fieldDefinitions,
      },
    });
  }

  private async getDefaultBlogId(projectId: string) {
    const blogs = await this.getBlogs(projectId);
    const defaultBlog = blogs.items[0];

    if (!defaultBlog) {
      throw new Error(
        "Aucun blog Shopify n'est disponible pour publier l'article.",
      );
    }

    return defaultBlog.id;
  }

  private async createArticle(input: {
    projectId: string;
    shopifyBlogId?: string | null;
    title: string;
    bodyHtml?: string | null;
    handle: string;
    authorName?: string | null;
    authorMetaobjectId?: string | null;
    videoYoutubeUrl?: string | null;
    isPublished: boolean;
    publishDate?: string | null;
  }) {
    const blogId =
      input.shopifyBlogId?.trim() ||
      (await this.getDefaultBlogId(input.projectId));
    const storeDomain = await this.resolveProjectShopDomain(input.projectId);
    const response = await this.graphql<ShopifyArticleCreateMutationResponse>(
      storeDomain,
      `
        mutation CreateArticle($article: ArticleCreateInput!) {
          articleCreate(article: $article) {
            article {
              id
              title
              handle
              blog {
                id
                title
                handle
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        article: {
          blogId,
          title: input.title,
          handle: input.handle,
          body: input.bodyHtml ?? '',
          isPublished: input.isPublished,
          ...(input.publishDate?.trim()
            ? {
                publishDate: input.publishDate.trim(),
              }
            : {}),
          author: this.buildAuthorInput(input.authorName),
        },
      },
    );

    const article = this.unwrapArticleMutationPayload(response.articleCreate);

    await this.setArticleMetafields({
      projectId: input.projectId,
      articleId: article.id,
      authorMetaobjectId: input.authorMetaobjectId,
      videoYoutubeUrl: input.videoYoutubeUrl,
    });

    return article;
  }

  private async updateArticle(input: {
    projectId: string;
    shopifyArticleId: string;
    shopifyBlogId?: string | null;
    title: string;
    bodyHtml?: string | null;
    handle: string;
    authorName?: string | null;
    authorMetaobjectId?: string | null;
    videoYoutubeUrl?: string | null;
    isPublished: boolean;
    publishDate?: string | null;
  }) {
    const storeDomain = await this.resolveProjectShopDomain(input.projectId);
    const response = await this.graphql<ShopifyArticleUpdateMutationResponse>(
      storeDomain,
      `
        mutation UpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
          articleUpdate(id: $id, article: $article) {
            article {
              id
              title
              handle
              blog {
                id
                title
                handle
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        id: input.shopifyArticleId,
        article: {
          ...(input.shopifyBlogId?.trim()
            ? {
                blogId: input.shopifyBlogId.trim(),
              }
            : {}),
          title: input.title,
          handle: input.handle,
          body: input.bodyHtml ?? '',
          isPublished: input.isPublished,
          ...(input.publishDate?.trim()
            ? {
                publishDate: input.publishDate.trim(),
              }
            : {}),
          author: this.buildAuthorInput(input.authorName),
        },
      },
    );

    const article = this.unwrapArticleMutationPayload(response.articleUpdate);

    await this.setArticleMetafields({
      projectId: input.projectId,
      articleId: article.id,
      authorMetaobjectId: input.authorMetaobjectId,
      videoYoutubeUrl: input.videoYoutubeUrl,
    });

    return article;
  }

  private unwrapArticleMutationPayload(payload: ShopifyArticleMutationPayload) {
    if (payload.userErrors.length) {
      throw new Error(
        `Shopify article mutation error: ${payload.userErrors
          .map((error) => error.message)
          .join(', ')}`,
      );
    }

    if (!payload.article) {
      throw new Error("Shopify n'a pas renvoyé d'article.");
    }

    return payload.article;
  }

  private async setArticleMetafields(input: {
    projectId: string;
    articleId: string;
    authorMetaobjectId?: string | null;
    videoYoutubeUrl?: string | null;
  }) {
    const authorMetaobjectId = input.authorMetaobjectId?.trim() || null;
    const videoYoutubeUrl = input.videoYoutubeUrl?.trim() || null;

    if (!authorMetaobjectId && !videoYoutubeUrl) {
      return;
    }

    const storeDomain = await this.resolveProjectShopDomain(input.projectId);
    const metafields = [
      ...(authorMetaobjectId
        ? [
            {
              ownerId: input.articleId,
              namespace: 'custom',
              key: 'author',
              type: 'metaobject_reference',
              value: authorMetaobjectId,
            },
          ]
        : []),
      ...(videoYoutubeUrl
        ? [
            {
              ownerId: input.articleId,
              namespace: 'custom',
              key: 'video_youtube',
              type: 'url',
              value: videoYoutubeUrl,
            },
          ]
        : []),
    ];

    await this.graphql(
      storeDomain,
      `
        mutation SetArticleMetafields($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              type
              value
            }
            userErrors {
              field
              message
              code
            }
          }
        }
      `,
      {
        metafields,
      },
    );
  }

  private async getAuthorMetaobjectDefinition(projectId: string) {
    const storeDomain = await this.resolveProjectShopDomain(projectId);
    const response =
      await this.graphql<ShopifyMetaobjectDefinitionsQueryResponse>(
        storeDomain,
        `
        query GetAuthorMetaobjectDefinitions {
          metaobjectDefinitions(first: 100) {
            nodes {
              id
              name
              type
              displayNameKey
              fieldDefinitions {
                key
                name
                description
                type {
                  name
                }
              }
            }
          }
        }
      `,
      );

    const definitions = response.metaobjectDefinitions.nodes;

    return (
      definitions.find((definition) => definition.type === 'author') ??
      definitions.find(
        (definition) =>
          definition.type.toLowerCase().endsWith('author') ||
          definition.name.toLowerCase().includes('author'),
      ) ??
      null
    );
  }

  private async requireAuthorMetaobjectDefinition(projectId: string) {
    const definition = await this.getAuthorMetaobjectDefinition(projectId);

    if (!definition) {
      throw new Error(
        "Aucune définition de metaobject Shopify de type author n'a été trouvée.",
      );
    }

    return definition;
  }

  private mapAuthorMetaobject(metaobject: ShopifyAuthorMetaobject) {
    return {
      id: metaobject.id,
      handle: metaobject.handle,
      type: metaobject.type,
      updatedAt: metaobject.updatedAt,
      fields: metaobject.fields.map((field) => ({
        key: field.key,
        value: field.value,
        reference: field.reference ?? null,
      })),
    };
  }

  private buildAuthorMetaobjectFields(
    definition: {
      fieldDefinitions: Array<{
        key: string;
        type?: {
          name: string;
        };
      }>;
    },
    input: ShopifyAuthorMetaobjectUpsertInput,
    _mode: 'create' | 'update',
  ) {
    const fieldDefinitions = new Map(
      definition.fieldDefinitions.map((fieldDefinition) => [
        fieldDefinition.key,
        fieldDefinition,
      ]),
    );
    const fields: ShopifyMetaobjectFieldInput[] = [];

    const pushField = (aliases: readonly string[], value?: string | null) => {
      const hasIncomingValue = value !== undefined && value !== null;
      const normalizedValue = hasIncomingValue ? value.trim() : null;

      if (!hasIncomingValue) {
        return;
      }

      const key = aliases.find((alias) => fieldDefinitions.has(alias));

      if (!key) {
        return;
      }

      const fieldDefinition = fieldDefinitions.get(key);
      if (normalizedValue === '') {
        fields.push({
          key,
          value: '',
        });
        return;
      }

      const normalizedFieldValue = this.normalizeMetaobjectFieldInputValue({
        fieldType: fieldDefinition?.type?.name,
        key,
        value: normalizedValue,
        displayText:
          input.displayName?.trim() || input.handle.trim() || 'Auteur',
      });

      if (!normalizedFieldValue) {
        return;
      }

      fields.push({
        key,
        value: normalizedFieldValue,
      });
    };

    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.displayName,
      input.displayName,
    );
    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.firstName,
      input.firstName,
    );
    pushField(SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.lastName, input.lastName);
    pushField(SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.jobTitle, input.jobTitle);
    pushField(SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.bio, input.bio);
    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.shopifyAvatarId,
      input.shopifyAvatarId,
    );
    pushField(SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.email, input.email);
    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.phoneNumber,
      input.phoneNumber,
    );
    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.shopifyPageId,
      input.shopifyPageId,
    );
    pushField(
      SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.linkedinProfileUrl,
      input.linkedinProfileUrl,
    );
    pushField(SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES.slug, input.slug);

    return fields;
  }

  private normalizeMetaobjectUrlValue(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const publicBaseUrl =
      process.env.NUXT_WEB_URL?.trim() ||
      process.env.WEB_URL?.trim() ||
      process.env.FRONTEND_URL?.trim() ||
      '';

    const candidateValue = (() => {
      if (/^(https?:|mailto:|sms:|tel:)/i.test(trimmedValue)) {
        return trimmedValue;
      }

      if (trimmedValue.startsWith('//')) {
        return `https:${trimmedValue}`;
      }

      if (trimmedValue.startsWith('/')) {
        if (!publicBaseUrl) {
          return null;
        }

        return `${publicBaseUrl.replace(/\/+$/, '')}${trimmedValue}`;
      }

      return `https://${trimmedValue}`;
    })();

    if (!candidateValue) {
      return null;
    }

    try {
      const parsedUrl = new URL(candidateValue);
      const allowedProtocols = new Set([
        'http:',
        'https:',
        'mailto:',
        'sms:',
        'tel:',
      ]);

      if (!allowedProtocols.has(parsedUrl.protocol)) {
        return null;
      }

      if (
        (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
        !parsedUrl.hostname
      ) {
        return null;
      }

      return parsedUrl.toString();
    } catch {
      return null;
    }
  }

  private normalizeMetaobjectFieldInputValue(input: {
    fieldType?: string;
    key: string;
    value: string | null;
    displayText: string;
  }) {
    if (!input.value) {
      return null;
    }

    if (input.fieldType === 'url') {
      return this.normalizeMetaobjectUrlValue(input.value);
    }

    if (input.fieldType === 'link') {
      return this.normalizeMetaobjectLinkValue(input.value, input.displayText);
    }

    if (input.fieldType === 'page_reference') {
      return input.value.trim() || null;
    }

    return input.value;
  }

  private normalizeMetaobjectLinkValue(value: string, text: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    return JSON.stringify({
      text,
      url: trimmedValue,
    });
  }

  private unwrapMetaobjectMutationPayload(
    payload: ShopifyMetaobjectMutationPayload,
  ) {
    if (payload.userErrors.length) {
      throw new Error(
        `Shopify metaobject mutation error: ${payload.userErrors
          .map((error) => error.message)
          .join(', ')}`,
      );
    }

    if (!payload.metaobject) {
      throw new Error("Shopify n'a pas renvoyé de metaobject.");
    }

    return this.mapAuthorMetaobject(payload.metaobject);
  }

  private buildAuthorInput(authorName?: string | null) {
    return {
      name: authorName?.trim() || 'Magify',
    };
  }

  private async attachAssociatedBlogArticle<T extends { id: string }>(
    article: T,
  ) {
    const associatedBlogArticle = await (
      this.prisma as any
    ).blogArticle.findFirst({
      where: {
        shopifyArticleId: article.id,
        trashedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        pageId: true,
      },
    });

    return {
      ...article,
      associatedBlogArticle: associatedBlogArticle ?? null,
    };
  }

  private toNullableTrimmed(value?: string | null) {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue : null;
  }

  private isMissingResourceError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    return (
      message.includes('not found') ||
      message.includes('invalid id') ||
      message.includes('does not exist')
    );
  }

  private normalizePageSize(first?: number) {
    if (typeof first !== 'number' || !Number.isFinite(first)) {
      return 50;
    }

    return Math.max(1, Math.min(Math.round(first), 100));
  }

  private async resolveProjectShopDomain(projectId: string) {
    const normalizedProjectId = projectId?.trim();

    if (!normalizedProjectId) {
      throw new BadRequestException(
        'Query param "projectId" is required for Shopify operations.',
      );
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
      throw new BadRequestException({
        message: `Project ${normalizedProjectId} is not linked to a Shopify store.`,
        errorType: 'PROJECT_SHOPIFY_STORE_NOT_LINKED',
        data: project,
      });
    }

    return storeDomain;
  }

  async graphql<T>(
    storeDomain: string,
    query: string,
    variables?: ShopifyGraphqlVariables,
  ): Promise<T> {
    const trimmedQuery = query.trim();
    const graphqlUrl = this.shopifyAuthService.buildGraphqlUrl(storeDomain);

    if (!trimmedQuery) {
      throw new BadRequestException('Shopify query is required.');
    }

    let response: Response;

    try {
      const headers = await this.shopifyAuthService.buildHeaders(storeDomain);
      response = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: trimmedQuery,
          variables,
        }),
      });
    } catch (error) {
      const cause = error instanceof Error ? (error as any).cause : null;
      throw new BadGatewayException({
        message:
          'Impossible de contacter Shopify pour le moment. Vérifie la connexion de la boutique ou réessaie plus tard.',
        errorType: 'SHOPIFY_API_UNAVAILABLE',
        cause:
          error instanceof Error
            ? error.message
            : 'Unknown Shopify fetch error',
        ...(cause && typeof cause === 'object'
          ? {
              causeCode: (cause as { code?: string }).code ?? null,
              causeName: (cause as { name?: string }).name ?? null,
            }
          : {}),
      });
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ShopifyGraphqlResponse<T> | null;

    if (!response.ok) {
      throw new BadGatewayException({
        message:
          response.status === 404
            ? "Shopify n'a pas répondu correctement. Vérifie la connexion de la boutique ou réessaie plus tard."
            : 'Shopify est momentanément indisponible. Réessaie dans quelques instants.',
        errorType: 'SHOPIFY_API_UNAVAILABLE',
        statusCode: response.status,
        data: payload,
      });
    }

    if (payload?.errors?.length) {
      throw new BadGatewayException({
        message:
          'Shopify a renvoyé une erreur pendant la récupération des données. Réessaie dans quelques instants.',
        errorType: 'SHOPIFY_API_UNAVAILABLE',
        data: payload.errors,
      });
    }

    if (!payload?.data) {
      throw new BadGatewayException({
        message:
          "Shopify n'a pas renvoyé de données exploitables. Réessaie dans quelques instants.",
        errorType: 'SHOPIFY_API_UNAVAILABLE',
      });
    }

    return payload.data;
  }
}
