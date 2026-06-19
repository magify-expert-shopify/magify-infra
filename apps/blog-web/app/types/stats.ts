export type { SeoKpiRange };
export type OpenAiUsageRange = "7d" | "30d" | "90d" | "180d";

export type OpenAiUsagePromptTypeStats = {
  type: OpenAiPromptType;
  label: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
};

export type OpenAiUsageDailyStats = {
  date: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  promptTypes: OpenAiUsagePromptTypeStats[];
};

export type OpenAiUsageEntryStats = {
  id: string;
  createdAt: string;
  model: string;
  promptType: OpenAiPromptType;
  label: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type SeoKpisResponse = {
  configured: boolean;
  range: SeoKpiRange;
  totalClicks: number;
  organicVisitors: number | null;
  googleClicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  articlesAnalyzed: number;
  indexedPages: number | null;
};

export type BusinessKpisResponse = {
  configured: boolean;
  sosDevLeadsGenerated: number | null;
  formsSubmitted: number | null;
  convertingPages: number | null;
  articlesGeneratingRequests: number | null;
};

export type OpenAiUsageResponse = {
  configured: boolean;
  range: OpenAiUsageRange;
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    calls: number;
  };
  promptTypes: OpenAiUsagePromptTypeStats[];
  daily: OpenAiUsageDailyStats[];
  entries: OpenAiUsageEntryStats[];
};
