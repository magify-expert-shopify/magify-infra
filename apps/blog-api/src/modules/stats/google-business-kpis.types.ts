export type GoogleBusinessKpisInput = {
  ga4PropertyId: string;
  startDate: string;
  endDate: string;
  accessToken?: string;
  refreshToken?: string;
  leadEventName?: string;
  formSubmitEventName?: string;
  articlePathPrefix?: string;
};

export type GoogleBusinessKpis = {
  configured: boolean;
  sosDevLeadsGenerated: number | null;
  formsSubmitted: number | null;
  convertingPages: number | null;
  articlesGeneratingRequests: number | null;
};

