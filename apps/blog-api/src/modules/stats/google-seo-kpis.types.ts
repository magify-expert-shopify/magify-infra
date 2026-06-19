import type { SeoKpiRange } from 'src/common/types';

export type GoogleSeoKpisInput = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  range: SeoKpiRange;
  ga4PropertyId?: string;
  accessToken?: string;
  refreshToken?: string;
  articlePathPrefix?: string;
};

export type GoogleSeoKpis = {
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
