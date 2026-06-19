import type { KeywordIntent } from "~/types/keyword-analysis";
import type { KeywordRecord } from "~/types/keywords";

export type KeywordSheeterSuggestion = {
  keyword: string;
  sourceQuery: string;
};

export type KeywordSheeterAnalysis = {
  volume: number | null;
  difficulty: number | null;
  intent: KeywordIntent | null;
};

export type KeywordSheeterSearchResultItem = KeywordSheeterSuggestion & {
  existingKeyword: KeywordRecord | null;
  analysis: KeywordSheeterAnalysis | null;
  canAnalyze: boolean;
  canAddToBase: boolean;
  canAddToBaseAndFavorite: boolean;
};

export type KeywordSheeterResponse = {
  query: string;
  suggestions: KeywordSheeterSuggestion[];
  total: number;
};
