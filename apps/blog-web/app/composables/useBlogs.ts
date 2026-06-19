import type { Blog } from "~/types/domain";
import type {
  BlogSyncApplyOperation,
  BlogSyncPreview,
} from "~/types/blog-sync";

export function useBlogs() {
  const { request } = useApi();

  function useBlogsList() {
    return useAsyncData("blogs", () => request<Blog[]>("/blogs"));
  }

  async function deleteBlog(id: string) {
    await request(`/blogs/${id}`, {
      method: "DELETE",
    });
  }

  async function getShopifyBlogSyncPreview() {
    return await request<BlogSyncPreview>("/blogs/sync-shopify/preview");
  }

  async function applyShopifyBlogSync(body: {
    operations: BlogSyncApplyOperation[];
  }) {
    return await request<{
      processedCount: number;
      createdCount: number;
      associatedCount: number;
      synchronizedCount: number;
      ignoredCount: number;
    }>("/blogs/sync-shopify/apply", {
      method: "POST",
      body,
    });
  }

  async function syncBlogArticleRelationsFromShopify() {
    return await request<{
      projectId: string;
      matchedBlogsCount: number;
      matchedArticlesCount: number;
      updatedCount: number;
      skippedCount: number;
    }>("/blogs/sync-relations", {
      method: "POST",
    });
  }

  async function discoverBlogArticles(
    id: string,
    mode: "sync" | "async" = "async",
  ) {
    return await request(`/blogs/${id}/discover-articles`, {
      method: "POST",
      body: {
        mode,
      },
    });
  }

  async function discoverBlogsArticles(
    ids: string[],
    mode: "sync" | "async" = "async",
  ) {
    return await request("/blogs/discover-articles", {
      method: "POST",
      body: {
        mode,
        ids,
      },
    });
  }

  return {
    useBlogsList,
    deleteBlog,
    discoverBlogArticles,
    discoverBlogsArticles,
    applyShopifyBlogSync,
    getShopifyBlogSyncPreview,
    syncBlogArticleRelationsFromShopify,
  };
}
