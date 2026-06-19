import type { CustomerProblem } from "~/types/customer-problems";

export type SuggestedKeywordCard = {
  id: string | null;
  keyword: string;
  isFavorite: boolean;
  volume: number | null;
  searchIntent?: string | null;
  isAnalyzed: boolean;
  globalKeywordId: string | null;
  sourceProblems: CustomerProblem[];
};
