import type { KeywordPageType } from "~/types/keywords";
import type {
  PageDetailRecord,
  PageListRecord,
  PageSuggestionPlanRecord,
  PageStatus,
} from "~/types/pages";

const PAGE_GENERATE_ARTICLE_TIMEOUT_MS = 300000;
const PAGE_CREATE_FROM_SUGGESTION_TIMEOUT_MS = 300000;
const PAGE_CREATE_BLANK_FROM_SUGGESTION_TIMEOUT_MS = 60000;
const PAGE_GENERATE_PLAN_FROM_SUGGESTION_TIMEOUT_MS = 90000;
const PAGE_SUGGEST_SECONDARY_KEYWORDS_TIMEOUT_MS = 90000;

export function usePages() {
  const { request } = useApi();

  function normalizePageListResponse(
    response:
      | PageListRecord[]
      | { pages?: PageListRecord[] | null }
      | { data?: PageListRecord[] | null }
      | null
      | undefined,
  ) {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && typeof response === "object") {
      if (Array.isArray(response.pages)) {
        return response.pages;
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }
    }

    return [];
  }

  async function rebuildBlogArticlePageUrls(projectId: string) {
    return await request<{
      totalCount: number;
      updatedCount: number;
      skippedCount: number;
    }>("/pages/maintenance/rebuild-blog-article-urls", {
      method: "POST",
      query: {
        projectId,
      },
    });
  }

  async function listPages() {
    const response = await request<
      | PageListRecord[]
      | { pages?: PageListRecord[] | null }
      | { data?: PageListRecord[] | null }
    >("/pages");

    return normalizePageListResponse(response);
  }

  async function getPage(pageId: string) {
    return await request<PageDetailRecord>(`/pages/${pageId}`);
  }

  async function updatePage(
    pageId: string,
    input: {
      title?: string | null;
      slug?: string | null;
      status?: PageStatus | null;
      clusterId?: string | null;
    },
  ) {
    return await request<PageDetailRecord>(`/pages/${pageId}`, {
      method: "PATCH",
      body: input,
    });
  }

  async function regeneratePageArticle(pageId: string) {
    return await request<PageDetailRecord>(`/pages/${pageId}/generate-article`, {
      method: "POST",
      timeout: PAGE_GENERATE_ARTICLE_TIMEOUT_MS,
    });
  }

  async function deletePage(pageId: string) {
    return await request<{ id: string; trashedAt?: string | null }>(
      `/pages/${pageId}`,
      {
        method: "DELETE",
      },
    );
  }

  async function createPageFromSuggestionGroup(
    groupId: string,
    input?: {
      pageType?: KeywordPageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      plan?: string | null;
    } | null,
  ) {
    return await request<PageDetailRecord>(
      `/pages/from-suggestion/${groupId}`,
      {
        method: "POST",
        timeout: PAGE_CREATE_FROM_SUGGESTION_TIMEOUT_MS,
        body: {
          pageType: input?.pageType ?? undefined,
          subjectExact: input?.subjectExact ?? undefined,
          primaryKeyword: input?.primaryKeyword ?? undefined,
          secondaryKeywords: input?.secondaryKeywords ?? undefined,
          target: input?.target ?? undefined,
          conversionObjective: input?.conversionObjective ?? undefined,
          approxLength: input?.approxLength ?? undefined,
          plan: input?.plan ?? undefined,
        },
      },
    );
  }

  async function createBlankPageFromSuggestionGroup(
    groupId: string,
    input?: {
      pageType?: KeywordPageType | null;
    } | null,
  ) {
    return await request<PageDetailRecord>(
      `/pages/from-suggestion/${groupId}/blank`,
      {
        method: "POST",
        timeout: PAGE_CREATE_BLANK_FROM_SUGGESTION_TIMEOUT_MS,
        body: {
          pageType: input?.pageType ?? undefined,
        },
      },
    );
  }

  async function associateExistingPageFromSuggestionGroup(
    groupId: string,
    input: {
      pageType?: KeywordPageType | null;
      pageId?: string | null;
      shopifyPageId?: string | null;
      blogArticleId?: string | null;
      shopifyArticleId?: string | null;
      title?: string | null;
      handle?: string | null;
    },
  ) {
    return await request<PageDetailRecord>(
      `/pages/from-suggestion/${groupId}/associate-existing`,
      {
        method: "POST",
        body: {
          pageType: input.pageType ?? undefined,
          pageId: input.pageId ?? undefined,
          shopifyPageId: input.shopifyPageId ?? undefined,
          blogArticleId: input.blogArticleId ?? undefined,
          shopifyArticleId: input.shopifyArticleId ?? undefined,
          title: input.title ?? undefined,
          handle: input.handle ?? undefined,
        },
      },
    );
  }

  async function generatePagePlanFromSuggestionGroup(
    groupId: string,
    input?: {
      pageType?: KeywordPageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      force?: boolean;
    } | null,
  ) {
    return await request<PageSuggestionPlanRecord>(
      `/pages/from-suggestion/${groupId}/plan`,
      {
        method: "POST",
        timeout: PAGE_GENERATE_PLAN_FROM_SUGGESTION_TIMEOUT_MS,
        body: {
          pageType: input?.pageType ?? undefined,
          subjectExact: input?.subjectExact ?? undefined,
          primaryKeyword: input?.primaryKeyword ?? undefined,
          secondaryKeywords: input?.secondaryKeywords ?? undefined,
          target: input?.target ?? undefined,
          conversionObjective: input?.conversionObjective ?? undefined,
          approxLength: input?.approxLength ?? undefined,
          force: input?.force ?? undefined,
        },
      },
    );
  }

  async function suggestSecondaryKeywordsFromSuggestionGroup(
    groupId: string,
    input?: {
      pageType?: KeywordPageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
    } | null,
  ) {
    return await request<{ keywords: string[] }>(
      `/pages/from-suggestion/${groupId}/secondary-keywords`,
      {
        method: "POST",
        timeout: PAGE_SUGGEST_SECONDARY_KEYWORDS_TIMEOUT_MS,
        body: {
          pageType: input?.pageType ?? undefined,
          subjectExact: input?.subjectExact ?? undefined,
          primaryKeyword: input?.primaryKeyword ?? undefined,
          secondaryKeywords: input?.secondaryKeywords ?? undefined,
          target: input?.target ?? undefined,
          conversionObjective: input?.conversionObjective ?? undefined,
          approxLength: input?.approxLength ?? undefined,
        },
      },
    );
  }

  async function getStoredPagePlanFromSuggestionGroup(groupId: string) {
    return await request<PageSuggestionPlanRecord | null>(
      `/pages/from-suggestion/${groupId}/plan`,
    );
  }

  async function savePagePlanFromSuggestionGroup(
    groupId: string,
    input: {
      pageType?: KeywordPageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      plan: string;
    },
  ) {
    return await request<PageSuggestionPlanRecord>(
      `/pages/from-suggestion/${groupId}/plan`,
      {
        method: "PATCH",
        body: {
          pageType: input.pageType ?? undefined,
          subjectExact: input.subjectExact ?? undefined,
          primaryKeyword: input.primaryKeyword ?? undefined,
          secondaryKeywords: input.secondaryKeywords ?? undefined,
          target: input.target ?? undefined,
          conversionObjective: input.conversionObjective ?? undefined,
          approxLength: input.approxLength ?? undefined,
          plan: input.plan,
        },
      },
    );
  }

  return {
    createBlankPageFromSuggestionGroup,
    associateExistingPageFromSuggestionGroup,
    createPageFromSuggestionGroup,
    generatePagePlanFromSuggestionGroup,
    getStoredPagePlanFromSuggestionGroup,
    savePagePlanFromSuggestionGroup,
    regeneratePageArticle,
    rebuildBlogArticlePageUrls,
    suggestSecondaryKeywordsFromSuggestionGroup,
    deletePage,
    getPage,
    listPages,
    updatePage,
  };
}
