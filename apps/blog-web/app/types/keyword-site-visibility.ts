import type { KeywordIntent } from "~/types/keyword-analysis";

export type KeywordSiteVisibilityKeyword = {
  id: string;
  keyword: string;
  isFavorite: boolean;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: KeywordIntent | null;
  lastScannedAt?: string | null;
};

export type KeywordSiteVisibilityItem = {
  keyword: string;
  position: number;
  url: string;
  title: string;
  snippet: string;
  cacheCreatedAt: string;
  pageTitle?: string | null;
  existingKeyword: KeywordSiteVisibilityKeyword | null;
};

export type KeywordSiteVisibilityResponse = {
  siteUrl: string;
  siteBaseUrl: string;
  totalKeywords: number;
  scannedCacheEntries: number;
  items: KeywordSiteVisibilityItem[];
};
