export enum KeywordIntent {
  INFORMATIONAL = "INFORMATIONAL",
  COMMERCIAL = "COMMERCIAL",
  TRANSACTIONAL = "TRANSACTIONAL",
  NAVIGATIONAL = "NAVIGATIONAL",
}

export type KeywordAnalysisSerpResult = {
  position: number;
  type: string;
  title: string;
  url: string;
  checkUrl: string;
  snippet: string;
  knownAgencySite: {
    id: string;
    name: string;
    baseUrl: string;
  } | null;
};

export type KeywordMonthlySearch = {
  year: number;
  month: number;
  searchVolume: number;
};

export type KeywordAnalysisResponse = {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: KeywordIntent;
  monthlySearches: KeywordMonthlySearch[];
  serpResults: KeywordAnalysisSerpResult[];
  miniScan: string | null;
};

export type KeywordSuggestion = {
  id: string;
  keyword: string;
  isFavorite: boolean;
  volume: number | null;
  difficulty: number | null;
  intent?: KeywordIntent | null;
  lastScannedAt?: string | null;
  source?: "history" | "database" | "suggest";
};

export type KeywordAnalysisAiReview = {
  keyword: string;
  review: string;
  responseId: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

export type UpsertKeywordInput = {
  keyword: string;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: KeywordIntent | null;
};

export type KeywordImportProgress = {
  total: number;
  processed: number;
  createdKeywords: number;
  existingKeywords: number;
  skippedKeywords: number;
  currentKeyword: string;
};
