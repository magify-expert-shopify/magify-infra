import type { UpsertKeywordInput } from "~/types/keyword-analysis";
import type { KeywordSiteVisibilityResponse } from "~/types/keyword-site-visibility";
import type { KeywordSheeterResponse } from "~/types/keyword-sheeter";
import type {
  ArticleSuggestionRecord,
  KeywordGroupDeduplicationResponseRecord,
  KeywordGroupRecord,
  KeywordPageType,
  KeywordGroupSuggestionRecord,
  KeywordRecord,
  SubjectRecord,
} from "~/types/keywords";

const KEYWORDS_LIST_CACHE_KEY = "keywords:list:cache";
const KEYWORDS_LIST_ASYNC_KEY = "keywords:list";

export function useKeywords() {
  const { request } = useApi();
  const keywordsCache = useState<KeywordRecord[] | null>(
    KEYWORDS_LIST_CACHE_KEY,
    () => null,
  );

  function normalizeKeywordGroupListResponse(
    response:
      | KeywordGroupRecord[]
      | { groups?: KeywordGroupRecord[] | null }
      | { keywordGroups?: KeywordGroupRecord[] | null }
      | { data?: KeywordGroupRecord[] | null }
      | null
      | undefined,
  ) {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && typeof response === "object") {
      if (Array.isArray(response.groups)) {
        return response.groups;
      }

      if (Array.isArray(response.keywordGroups)) {
        return response.keywordGroups;
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }
    }

    return [];
  }

  function useKeywordsList() {
    const keywordsList = useAsyncData(
      KEYWORDS_LIST_ASYNC_KEY,
      () => request<KeywordRecord[]>("/keywords"),
      {
        lazy: true,
        getCachedData: () => keywordsCache.value ?? undefined,
        default: () => keywordsCache.value ?? [],
      },
    );

    watch(
      keywordsList.data,
      (value) => {
        if (value) {
          keywordsCache.value = value;
        }
      },
      { immediate: true },
    );

    return keywordsList;
  }

  async function listKeywords() {
    const keywords = await request<KeywordRecord[]>("/keywords");
    keywordsCache.value = keywords;

    return keywords;
  }

  async function suggestGoogleKeywords(
    query: string,
    options?: {
      limit?: number;
      language?: string;
      country?: string;
      expand?: boolean;
    },
  ) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return {
        query: "",
        total: 0,
        suggestions: [],
      } satisfies KeywordSheeterResponse;
    }

    return await request<KeywordSheeterResponse>("/keywords/suggest", {
      query: {
        q: normalizedQuery,
        ...(typeof options?.limit === "number" ? { limit: options.limit } : {}),
        ...(options?.language ? { hl: options.language } : {}),
        ...(options?.country ? { gl: options.country } : {}),
        ...(typeof options?.expand === "boolean"
          ? { expand: String(options.expand) }
          : {}),
      },
    });
  }

  async function createKeyword(input: UpsertKeywordInput) {
    return await request<{ keyword: KeywordRecord; wasCreated: boolean }>("/keywords", {
      method: "POST",
      body: input,
    });
  }

  async function deleteKeyword(keywordId: string) {
    return await request<{ success: boolean }>(`/keywords/${keywordId}`, {
      method: "DELETE",
    });
  }

  async function renameKeyword(keywordId: string, keyword: string) {
    return await request<KeywordRecord>(`/keywords/${keywordId}`, {
      method: "PATCH",
      body: {
        keyword,
      },
    });
  }

  async function assignKeywordTemplate(keywordId: string, pageType: KeywordPageType) {
    return await request<KeywordRecord>(`/keywords/${keywordId}/template`, {
      method: "PATCH",
      body: {
        pageType,
      },
    });
  }

  async function autoAssignKeywordTemplates(keywordIds?: string[]) {
    return await request<{
      updatedCount: number;
      skippedCount: number;
      updatedKeywords: KeywordRecord[];
    }>("/keywords/templates/auto-assign", {
      method: "PATCH",
      body: {
        keywordIds,
      },
    });
  }

  async function assignKeywordGroupTemplate(
    groupId: string,
    pageType: KeywordPageType,
  ) {
    return await request<{
      updatedCount: number;
      skippedCount: number;
      updatedKeywords: KeywordRecord[];
    }>(`/keywords/groups/${groupId}/template`, {
      method: "PATCH",
      body: {
        pageType,
      },
    });
  }

  async function autoAssignKeywordGroupTemplate(groupId: string) {
    return await request<{
      updatedCount: number;
      skippedCount: number;
      updatedKeywords: KeywordRecord[];
      pageType?: KeywordPageType;
    }>(`/keywords/groups/${groupId}/template/auto-assign`, {
      method: "PATCH",
    });
  }

  async function setKeywordFavorite(keywordId: string, isFavorite: boolean) {
    return await request<KeywordRecord>(`/keywords/${keywordId}/favorite`, {
      method: "PATCH",
      body: {
        isFavorite,
      },
    });
  }

  async function setKeywordGroupFavorite(
    groupId: string,
    isFavorite: boolean,
  ) {
    return await request<
      Pick<KeywordGroupRecord, "id" | "isFavorite"> & {
        updatedKeywords: KeywordRecord[];
      }
    >(
      `/keywords/groups/${groupId}/favorite`,
      {
        method: "PATCH",
        body: {
          isFavorite,
        },
      },
      );
  }

  async function assignKeywordGroupToCurrentUser(groupId: string) {
    return await request<
      Pick<
        KeywordGroupRecord,
        | "id"
        | "assignedSupabaseUserId"
        | "assignedSupabaseUserEmail"
        | "assignedSupabaseUserName"
        | "assignedSupabaseAssignedAt"
      >
    >(`/keywords/groups/${groupId}/assignment`, {
      method: "PATCH",
    });
  }

  async function clearKeywordGroupAssignment(groupId: string) {
    return await request<
      Pick<
        KeywordGroupRecord,
        | "id"
        | "assignedSupabaseUserId"
        | "assignedSupabaseUserEmail"
        | "assignedSupabaseUserName"
        | "assignedSupabaseAssignedAt"
      >
    >(`/keywords/groups/${groupId}/assignment`, {
      method: "DELETE",
    });
  }

  async function listSubjects() {
    return await request<SubjectRecord[]>("/keywords/subjects");
  }

  async function createSubject(name: string, description?: string) {
    return await request<SubjectRecord>("/keywords/subjects", {
      method: "POST",
      body: {
        name,
        description,
      },
    });
  }

  async function listKeywordGroups() {
    const response = await request<
      | KeywordGroupRecord[]
      | { groups?: KeywordGroupRecord[] | null }
      | { keywordGroups?: KeywordGroupRecord[] | null }
      | { data?: KeywordGroupRecord[] | null }
    >("/keywords/groups");

    return normalizeKeywordGroupListResponse(response);
  }

  async function deduplicateKeywordGroups(keywordGroups: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>) {
    return await request<KeywordGroupDeduplicationResponseRecord>(
      "/keywords/groups/deduplicate-suggestions",
      {
        method: "POST",
        body: {
          keywordGroups,
        },
      },
    );
  }

  async function getCachedDeduplicatedKeywordGroups(keywordGroups: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>) {
    return await request<KeywordGroupDeduplicationResponseRecord>(
      "/keywords/groups/deduplicate-suggestions/cached",
      {
        method: "POST",
        body: {
          keywordGroups,
        },
      },
    );
  }

  async function searchSiteVisibility(siteUrl: string) {
    return await request<KeywordSiteVisibilityResponse>(
      "/keywords/site-visibility",
      {
        query: {
          siteUrl,
        },
      },
    );
  }

  async function listArticleSuggestions() {
    return await request<ArticleSuggestionRecord[]>("/articles/suggestions");
  }

  async function listTutorialSuggestions() {
    return await request<KeywordGroupSuggestionRecord[]>(
      "/tutorials/suggestions",
    );
  }

  async function listGuideSuggestions() {
    return await request<KeywordGroupSuggestionRecord[]>("/guides/suggestions");
  }

  async function listDefinitionSuggestions() {
    return await request<KeywordGroupSuggestionRecord[]>(
      "/definitions/suggestions",
    );
  }

  async function listSuggestions() {
    return await request<KeywordGroupSuggestionRecord[]>("/suggestions");
  }

  async function createKeywordGroup(input: {
    name: string;
    description?: string | null;
    keywordIds?: string[];
    primaryKeyword?: string | null;
    parentGroupId?: string | null;
    parentGroupIds?: string[] | null;
    seoClusterId?: string | null;
  }) {
    return await request<KeywordGroupRecord>("/keywords/groups", {
      method: "POST",
      body: input,
    });
  }

  async function updateKeywordGroup(
    groupId: string,
    input: {
      name?: string;
      description?: string | null;
      keywordIds?: string[];
      primaryKeyword?: string | null;
      parentGroupId?: string | null;
      parentGroupIds?: string[] | null;
      seoClusterId?: string | null;
    },
    ) {
      return await request<KeywordGroupRecord>(`/keywords/groups/${groupId}`, {
        method: "PATCH",
        body: input,
      });
    }

  async function deleteKeywordGroup(groupId: string) {
    return await request<{ deleted: boolean }>(`/keywords/groups/${groupId}`, {
      method: "DELETE",
    });
  }

  async function convertKeywordGroupToCluster(groupId: string) {
    return await request(`/keywords/groups/${groupId}/to-cluster`, {
      method: "POST",
    });
  }

  async function mergeKeywordGroups(
    targetGroupId: string,
    sourceGroupIds: string[],
  ) {
    return await request<{
      targetGroup: KeywordGroupRecord;
      mergedGroupIds: string[];
    }>(`/keywords/groups/${targetGroupId}/merge`, {
      method: "POST",
      body: {
        sourceGroupIds,
      },
    });
  }

  async function formKeywordGroupsWithAi() {
    return await request<{
      totalKeywords: number;
      createdGroups: number;
      updatedGroups: number;
      groups: Array<unknown>;
    }>("/keywords/groups/form-groups", {
      method: "POST",
    });
  }

  return {
    assignKeywordTemplate,
    assignKeywordGroupTemplate,
    autoAssignKeywordGroupTemplate,
    autoAssignKeywordTemplates,
    convertKeywordGroupToCluster,
    createKeyword,
    deduplicateKeywordGroups,
    getCachedDeduplicatedKeywordGroups,
    createKeywordGroup,
    deleteKeywordGroup,
    createSubject,
    deleteKeyword,
    listKeywordGroups,
    listArticleSuggestions,
    listDefinitionSuggestions,
    listGuideSuggestions,
    listKeywords,
    listSubjects,
    listSuggestions,
    mergeKeywordGroups,
    renameKeyword,
    searchSiteVisibility,
    suggestGoogleKeywords,
    setKeywordFavorite,
    setKeywordGroupFavorite,
    assignKeywordGroupToCurrentUser,
    clearKeywordGroupAssignment,
    listTutorialSuggestions,
    formKeywordGroupsWithAi,
    updateKeywordGroup,
    useKeywordsList,
  };
}
