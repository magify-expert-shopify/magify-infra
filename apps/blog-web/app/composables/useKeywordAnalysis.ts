import type {
  KeywordAnalysisAiReview,
  KeywordAnalysisResponse,
  KeywordSuggestion,
  UpsertKeywordInput,
} from "~/types/keyword-analysis";

export function useKeywordAnalysis() {
  const { request } = useApi();

  async function analyzeKeyword(
    keyword: string,
    input?: {
      force?: boolean;
    },
  ) {
    return await request<KeywordAnalysisResponse>("/keyword-analysis", {
      query: {
        q: keyword,
        ...(input?.force ? { force: "true" } : {}),
      },
    });
  }

  async function getStoredKeywordAnalysis(keyword: string) {
    return await request<KeywordAnalysisResponse | null>("/keyword-analysis/stored", {
      query: {
        q: keyword,
      },
    });
  }

  async function suggestKeywords(query: string, limit?: number) {
    return await request<KeywordSuggestion[]>("/keyword-analysis/suggestions", {
      query: {
        q: query,
        ...(typeof limit === "number" ? { limit } : {}),
      },
    });
  }

  async function analyzeKeywordWithAi(analysis: KeywordAnalysisResponse) {
    return await request<KeywordAnalysisAiReview>("/keyword-analysis/ai-review", {
      method: "POST",
      body: {
        keyword: analysis.keyword,
        volume: analysis.volume,
        difficulty: analysis.difficulty,
        intent: analysis.intent,
        serpResults: analysis.serpResults,
      },
    });
  }

  async function upsertKeyword(input: UpsertKeywordInput) {
    return await request("/keywords", {
      method: "POST",
      body: input,
    });
  }

  return {
    analyzeKeyword,
    analyzeKeywordWithAi,
    getStoredKeywordAnalysis,
    suggestKeywords,
    upsertKeyword,
  };
}
