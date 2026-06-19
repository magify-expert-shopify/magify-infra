export type SerpResult = {
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

export type KeywordMetrics = {
  volume: number;
  difficulty: number;
  intent: string;
  monthlySearches: KeywordMonthlySearch[];
};
