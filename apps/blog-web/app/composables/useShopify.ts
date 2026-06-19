import type {
  ShopifyArticle,
  ShopifyAuthorMetaobject,
  ShopifyBlogArticleListItem,
  ShopifyBlogListItem,
  ShopifyImageListItem,
  ShopifyPageListItem,
  UpdateShopifyAuthorInput,
} from "~/types/shopify";

type ShopifyConnectionPage<T> = {
  items: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
};

type ShopifyBlogArticlesConnectionPage = ShopifyConnectionPage<ShopifyBlogArticleListItem>;
const SHOPIFY_CONNECTION_PAGE_SIZE = 100;

export function useShopify() {
  const { request } = useApi();

  function buildConnectionQuery(options?: {
    first?: number;
    after?: string | null;
    last?: number;
    before?: string | null;
  }) {
    return {
      ...(typeof options?.first === "number" ? { first: options.first } : {}),
      ...(typeof options?.after === "string" && options.after.trim()
        ? { after: options.after }
        : {}),
      ...(typeof options?.last === "number" ? { last: options.last } : {}),
      ...(typeof options?.before === "string" && options.before.trim()
        ? { before: options.before }
        : {}),
    };
  }

  async function getBlogsPage(options?: {
    first?: number;
    after?: string | null;
    last?: number;
    before?: string | null;
  }) {
    return await request<ShopifyConnectionPage<ShopifyBlogListItem>>(
      "/shopify/blogs",
      {
        query: buildConnectionQuery(options),
      },
    );
  }

  async function getPagesPage(options?: {
    first?: number;
    after?: string | null;
    last?: number;
    before?: string | null;
  }) {
    return await request<ShopifyConnectionPage<ShopifyPageListItem>>(
      "/shopify/pages",
      {
        query: buildConnectionQuery(options),
      },
    );
  }

  async function getBlogs() {
    const blogs: ShopifyBlogListItem[] = [];
    let after: string | null = null;

    do {
      const page = await getBlogsPage({ first: SHOPIFY_CONNECTION_PAGE_SIZE, after });
      blogs.push(...page.items);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return blogs;
  }

  async function getPages() {
    const pages: ShopifyPageListItem[] = [];
    let after: string | null = null;

    do {
      const page = await getPagesPage({ first: SHOPIFY_CONNECTION_PAGE_SIZE, after });
      pages.push(...page.items);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return pages;
  }

  async function getImages() {
    return await request<ShopifyImageListItem[]>("/shopify/images");
  }

  async function getAuthorMetaobjects() {
    return await request<ShopifyAuthorMetaobject[]>("/shopify/author");
  }

  async function getAuthorMetaobject(id: string) {
    return await request<ShopifyAuthorMetaobject>(
      `/shopify/author/${encodeURIComponent(id)}`,
    );
  }

  async function updateAuthorMetaobject(
    id: string,
    input: UpdateShopifyAuthorInput,
  ) {
    return await request<ShopifyAuthorMetaobject>(
      `/shopify/author/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  }

  async function getBlogArticles(blogId: string) {
    return await request<ShopifyBlogArticleListItem[]>(
      `/shopify/blogs/${encodeURIComponent(blogId)}/articles`,
    );
  }

  async function getBlogArticlesListPage(options?: {
    first?: number;
    after?: string | null;
    last?: number;
    before?: string | null;
    includePublishedAt?: boolean;
    includeAssociatedBlogArticle?: boolean;
  }) {
    return await request<ShopifyBlogArticlesConnectionPage>("/shopify/articles", {
      query: {
        ...buildConnectionQuery(options),
        ...(options?.includePublishedAt === true
          ? { includePublishedAt: "true" }
          : {}),
        ...(options?.includeAssociatedBlogArticle === true
          ? { includeAssociatedBlogArticle: "true" }
          : {}),
      },
    });
  }

  async function getBlogArticlesList(options?: {
    includePublishedAt?: boolean;
    includeAssociatedBlogArticle?: boolean;
  }) {
    const articles: ShopifyBlogArticleListItem[] = [];
    let after: string | null = null;

    do {
      const page = await getBlogArticlesListPage({
        first: SHOPIFY_CONNECTION_PAGE_SIZE,
        after,
        includePublishedAt: options?.includePublishedAt,
        includeAssociatedBlogArticle: options?.includeAssociatedBlogArticle,
      });
      articles.push(...page.items);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);

    return articles;
  }

  async function getArticle(articleId: string) {
    return await request<ShopifyArticle>(
      `/shopify/articles/${encodeURIComponent(articleId)}`,
    );
  }

  async function pullArticle(articleId: string) {
    return await request(`/shopify/articles/${encodeURIComponent(articleId)}/pull`, {
      method: "POST",
    });
  }

  return {
    getArticle,
    getAuthorMetaobject,
    getAuthorMetaobjects,
    getBlogs,
    getBlogsPage,
    getImages,
    getPages,
    getPagesPage,
    getBlogArticles,
    getBlogArticlesListPage,
    getBlogArticlesList,
    pullArticle,
    updateAuthorMetaobject,
  };
}
