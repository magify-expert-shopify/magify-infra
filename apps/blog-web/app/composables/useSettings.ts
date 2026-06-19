import type {
  BusinessPositioningSettings,
  IntegrationsStatusResponse,
  KeywordDifficultyLevelsSettings,
  OpenAiCacheResponse,
  PreferredAuthorProfileSettings,
  CurrentProjectSettings,
  KeywordVolumeThresholdsSettings,
  PromptConfigSettings,
} from "~/types/settings";
import type {
  CurrentSprintResponse,
  SprintClusterSettings,
} from "~/types/sprint";

export function useSettings() {
  const { request } = useApi();
  const { currentProject } = useCurrentProject();
  const keywordDifficultyLevelsCache =
    useState<KeywordDifficultyLevelsSettings | null>(
      "settings:keyword-difficulty-levels:cache",
      () => null,
    );
  const keywordVolumeThresholdsCache =
    useState<KeywordVolumeThresholdsSettings | null>(
      "settings:keyword-volume-thresholds:cache",
      () => null,
    );

  async function getCustomerProblemKeywordExtractionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/customer-problem-keyword-extraction-prompt",
    );
  }

  async function getBusinessPositioningKeywordExtractionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/business-positioning-keyword-extraction-prompt",
    );
  }

  async function getKeywordGroupingPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-grouping-prompt",
    );
  }

  async function getKeywordGroupTemplatePrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-group-template-prompt",
    );
  }

  async function getKeywordGroupDeduplicationPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-group-deduplication-prompt",
    );
  }

  async function getSeoClusterSuggestionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/seo-cluster-suggestion-prompt",
    );
  }

  async function getBlogArticleFromSuggestionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-from-suggestion-prompt",
    );
  }

  async function getBlogArticlePlanFromSuggestionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-plan-from-suggestion-prompt",
    );
  }

  async function getBlogArticleSecondaryKeywordsSuggestionPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-secondary-keywords-suggestion-prompt",
    );
  }

  async function getBlogArticleFromSuggestionTone() {
    return await request<string>(
      "/settings/prompts/blog-article-from-suggestion-tone",
    );
  }

  async function getKeywordAnalysisPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/keyword-analysis-prompt",
    );
  }

  async function getKeywordAnalysisMiniScanPrompt() {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-analysis-mini-scan-prompt",
    );
  }

  async function updateCustomerProblemKeywordExtractionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/customer-problem-keyword-extraction-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateBusinessPositioningKeywordExtractionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/business-positioning-keyword-extraction-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateKeywordGroupingPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-grouping-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateKeywordGroupTemplatePrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-group-template-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateKeywordGroupDeduplicationPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-group-deduplication-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateSeoClusterSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/seo-cluster-suggestion-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateBlogArticleFromSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-from-suggestion-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateBlogArticlePlanFromSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-plan-from-suggestion-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateBlogArticleSecondaryKeywordsSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/blog-article-secondary-keywords-suggestion-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateBlogArticleFromSuggestionTone(tone: string) {
    return await request<string>(
      "/settings/prompts/blog-article-from-suggestion-tone",
      {
        method: "PATCH",
        body: {
          tone,
        },
      },
    );
  }

  async function updateKeywordAnalysisPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/keyword-analysis-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function updateKeywordAnalysisMiniScanPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return await request<PromptConfigSettings>(
      "/settings/prompts/keyword-analysis-mini-scan-prompt",
      {
        method: "PATCH",
        body: {
          input,
          instructions,
          model,
          maxOutputTokens,
        },
      },
    );
  }

  async function getCurrentSprint() {
    return await request<CurrentSprintResponse>("/settings/current-sprint");
  }

  async function updateCurrentSprint(
    clusterId: string | null,
    blogArticleTargetCount: number,
    startDate: string | null,
    durationDays: number | null,
  ) {
    return await request<CurrentSprintResponse>("/settings/current-sprint", {
      method: "PATCH",
      body: {
        clusterId,
        blogArticleTargetCount,
        startDate,
        durationDays,
      },
    });
  }

  async function getSprintCluster() {
    return await request<SprintClusterSettings>("/settings/sprint-cluster");
  }

  async function getIntegrations() {
    return await request<IntegrationsStatusResponse>("/settings/integrations");
  }

  async function getBusinessPositioning() {
    return await request<BusinessPositioningSettings>(
      "/settings/business-positioning",
    );
  }

  async function getKeywordDifficultyLevels() {
    if (keywordDifficultyLevelsCache.value) {
      return keywordDifficultyLevelsCache.value;
    }

    const settings = await request<KeywordDifficultyLevelsSettings>(
      "/settings/keyword-difficulty-levels",
    );
    keywordDifficultyLevelsCache.value = settings;

    return settings;
  }

  async function getKeywordVolumeThresholds() {
    if (keywordVolumeThresholdsCache.value) {
      return keywordVolumeThresholdsCache.value;
    }

    const settings = await request<KeywordVolumeThresholdsSettings>(
      "/settings/keyword-volume-thresholds",
    );
    keywordVolumeThresholdsCache.value = settings;

    return settings;
  }

  async function getOpenAiCache(
    promptType?: OpenAiPromptType | null,
    options?: {
      page?: number;
      pageSize?: number;
    },
  ) {
    return await request<OpenAiCacheResponse>("/settings/openai-cache", {
      query: {
        ...(promptType ? { promptType } : {}),
        ...(typeof options?.page === "number" ? { page: options.page } : {}),
        ...(typeof options?.pageSize === "number"
          ? { pageSize: options.pageSize }
          : {}),
      },
    });
  }

  async function getPreferredAuthorProfile() {
    return await request<PreferredAuthorProfileSettings>(
      "/settings/preferred-author-profile",
    );
  }

  async function getCurrentProject() {
    return await request<CurrentProjectSettings>("/settings/current-project");
  }

  async function prefillBusinessPositioningFromWebsite(websiteUrl: string) {
    return await request<Omit<BusinessPositioningSettings, "keywords" | "isComplete">>(
      "/settings/business-positioning/prefill-from-website",
      {
        method: "POST",
        body: {
          websiteUrl,
        },
      },
    );
  }

  async function updateSprintCluster(clusterId: string | null) {
    return await request<SprintClusterSettings>("/settings/sprint-cluster", {
      method: "PATCH",
      body: {
        clusterId,
      },
    });
  }

  async function updateBusinessPositioning(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ) {
    return await request<BusinessPositioningSettings>(
      "/settings/business-positioning",
      {
        method: "PATCH",
        body: {
          websiteUrl,
          offering,
          differentiator,
          problemsSolved,
        },
      },
    );
  }

  async function updateBusinessPositioningAnswersOnly(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ) {
    return await request<BusinessPositioningSettings>(
      "/settings/business-positioning/answers-only",
      {
        method: "PATCH",
        body: {
          websiteUrl,
          offering,
          differentiator,
          problemsSolved,
        },
      },
    );
  }

  async function extractBusinessPositioningKeywords(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ) {
    return await request<BusinessPositioningSettings>(
      "/settings/business-positioning/extract-keywords",
      {
        method: "POST",
        body: {
          websiteUrl,
          offering,
          differentiator,
          problemsSolved,
        },
      },
    );
  }

  async function updateKeywordDifficultyLevels(
    levels: KeywordDifficultyLevelsSettings["levels"],
  ) {
    const settings = await request<KeywordDifficultyLevelsSettings>(
      "/settings/keyword-difficulty-levels",
      {
        method: "PATCH",
        body: {
          levels,
        },
      },
    );

    keywordDifficultyLevelsCache.value = settings;

    return settings;
  }

  async function updateKeywordVolumeThresholds(
    input: KeywordVolumeThresholdsSettings,
  ) {
    const settings = await request<KeywordVolumeThresholdsSettings>(
      "/settings/keyword-volume-thresholds",
      {
        method: "PATCH",
        body: input,
      },
    );

    keywordVolumeThresholdsCache.value = settings;

    return settings;
  }

  async function updatePreferredAuthorProfile(authorId: string | null) {
    return await request<PreferredAuthorProfileSettings>(
      "/settings/preferred-author-profile",
      {
        method: "PATCH",
        body: {
          authorId,
        },
      },
    );
  }

  async function updateCurrentProject(projectId: string | null) {
    return await request<CurrentProjectSettings>("/settings/current-project", {
      method: "PATCH",
      body: {
        projectId,
      },
    });
  }

  async function syncShopifyAuthorMetaobjectDefinition() {
    const projectId = currentProject.value?.id?.trim();

    if (!projectId) {
      throw new Error("Un projet courant est requis pour synchroniser Shopify.");
    }

    return await request("/settings/shopify/author-metaobject-definition/sync", {
      method: "POST",
      query: {
        projectId,
      },
    });
  }

  return {
    getBusinessPositioning,
    getBusinessPositioningKeywordExtractionPrompt,
    getBlogArticleFromSuggestionPrompt,
    getBlogArticlePlanFromSuggestionPrompt,
    getBlogArticleSecondaryKeywordsSuggestionPrompt,
    getBlogArticleFromSuggestionTone,
    getCustomerProblemKeywordExtractionPrompt,
    getCurrentSprint,
    getIntegrations,
    getKeywordAnalysisPrompt,
    getKeywordAnalysisMiniScanPrompt,
    getKeywordGroupDeduplicationPrompt,
    getKeywordGroupTemplatePrompt,
    getSeoClusterSuggestionPrompt,
    getKeywordDifficultyLevels,
    getKeywordGroupingPrompt,
    getOpenAiCache,
    getCurrentProject,
    getPreferredAuthorProfile,
    getKeywordVolumeThresholds,
    getSprintCluster,
    prefillBusinessPositioningFromWebsite,
    syncShopifyAuthorMetaobjectDefinition,
    updateBusinessPositioning,
    updateBusinessPositioningAnswersOnly,
    extractBusinessPositioningKeywords,
    updateBusinessPositioningKeywordExtractionPrompt,
    updateBlogArticleFromSuggestionPrompt,
    updateBlogArticlePlanFromSuggestionPrompt,
    updateBlogArticleSecondaryKeywordsSuggestionPrompt,
    updateBlogArticleFromSuggestionTone,
    updateCustomerProblemKeywordExtractionPrompt,
    updateCurrentSprint,
    updateKeywordDifficultyLevels,
    updateKeywordAnalysisPrompt,
    updateKeywordAnalysisMiniScanPrompt,
    updateKeywordGroupDeduplicationPrompt,
    updateKeywordGroupTemplatePrompt,
    updateSeoClusterSuggestionPrompt,
    updateKeywordGroupingPrompt,
    updateKeywordVolumeThresholds,
    updateCurrentProject,
    updatePreferredAuthorProfile,
    updateSprintCluster,
  };
}
