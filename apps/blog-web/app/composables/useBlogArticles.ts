import type { BlogArticle, BlogArticleStatus } from "~/types/domain";

const BLOG_ARTICLES_ASYNC_KEY = "blog-articles";
const BLOG_ARTICLE_IDEA_ASYNC_KEY = "blog-article-ideas";

export function useBlogArticles() {
  const { request } = useApi();

  async function listBlogArticles() {
    return await request<BlogArticle[]>("/blog-articles");
  }

  function useBlogArticlesList() {
    return useAsyncData(BLOG_ARTICLES_ASYNC_KEY, () =>
      request<BlogArticle[]>("/blog-articles"),
    );
  }

  function useBlogArticleIdeasList() {
    return useAsyncData(BLOG_ARTICLE_IDEA_ASYNC_KEY, () =>
      request<BlogArticle[]>("/blog-articles/ideas"),
    );
  }

  function useBlogArticle(id: string) {
    return useAsyncData(`blog-article:${id}`, () =>
      request<BlogArticle>(`/blog-articles/${id}`),
    );
  }

  async function createBlogArticleIdea(title: string) {
    return await request<BlogArticle>("/blog-articles/ideas", {
      method: "POST",
      body: { title },
    });
  }

  async function createBlankBlogArticle(projectId: string) {
    return await request<BlogArticle>("/blog-articles/blank", {
      method: "POST",
      query: {
        projectId,
      },
    });
  }

  async function assignIdeaClustersWithAi() {
    return await request<BlogArticle[]>(
      "/blog-articles/ideas/assign-clusters",
      {
        method: "POST",
      },
    );
  }

  async function assignBlogArticleCluster(
    id: string,
    clusterId: string | null,
  ) {
    return await request<BlogArticle>(`/blog-articles/${id}/assign-cluster`, {
      method: "POST",
      body: {
        clusterId,
      },
    });
  }

  async function assignBlogArticleReview(
    id: string,
    input?: {
      supabaseUserId?: string | null;
      supabaseUserEmail?: string | null;
      supabaseUserName?: string | null;
      reviewDueAt?: string | null;
    } | null,
  ) {
    return await request<BlogArticle>(
      `/blog-articles/${id}/review-assignment`,
      {
        method: "PATCH",
        body: input ?? {},
      },
    );
  }

  async function updateBlogArticle(
    id: string,
    input: {
      title?: string;
      content?: string | null;
      scriptAssetUrls?: string[] | null;
      slug?: string | null;
      primaryKeyword?: string | null;
      requiredKeywords?: string | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
      videoYoutubeUrl?: string | null;
      plannedFor?: string | null;
      reviewDueAt?: string | null;
      status?: BlogArticleStatus;
      authorId?: string | null;
      shopifyBlogId?: string | null;
    },
  ) {
    return await request<BlogArticle>(`/blog-articles/${id}/update`, {
      method: "POST",
      body: input,
    });
  }

  async function refreshBlogArticle(
    id: string,
    mode: "sync" | "async" = "sync",
  ) {
    return await request<
      | {
          mode: "sync";
          blogArticleId: string;
          article: BlogArticle;
        }
      | {
          mode: "async";
          blogArticleId: string;
          job: {
            id: string | number | undefined;
            name: string;
            queueName: string;
            data: {
              blogArticleId: string;
            };
            attemptsMade: number;
            timestamp: number;
          };
        }
    >(`/blog-articles/${id}/refresh`, {
      method: "POST",
      body: {
        mode,
      },
    });
  }

  async function refreshBlogArticles(
    ids: string[],
    mode: "sync" | "async" = "async",
  ) {
    return await request("/blog-articles/refresh", {
      method: "POST",
      body: {
        mode,
        ids,
      },
    });
  }

  async function syncBlogArticleStatusesFromShopify(projectId: string) {
    return await request<{
      updatedCount: number;
      skippedCount: number;
      failedCount: number;
    }>("/blog-articles/sync-statuses", {
      method: "POST",
      query: {
        projectId,
      },
    });
  }

  async function deleteBlogArticle(id: string) {
    await request(`/blog-articles/${id}`, {
      method: "DELETE",
    });
  }

  async function setBlogArticleReviewStatus(
    id: string,
    input: {
      isReviewCompleted: boolean;
      reviewOutcome?: "APPROVED" | "REJECTED";
      reviewComment?: string | null;
    },
  ) {
    return await request<BlogArticle>(`/blog-articles/${id}/review-status`, {
      method: "PATCH",
      body: input,
    });
  }

  return {
    assignIdeaClustersWithAi,
    assignBlogArticleCluster,
    assignBlogArticleReview,
    createBlankBlogArticle,
    createBlogArticleIdea,
    listBlogArticles,
    updateBlogArticle,
    useBlogArticle,
    useBlogArticleIdeasList,
    useBlogArticlesList,
    refreshBlogArticle,
    refreshBlogArticles,
    syncBlogArticleStatusesFromShopify,
    deleteBlogArticle,
    setBlogArticleReviewStatus,
  };
}
