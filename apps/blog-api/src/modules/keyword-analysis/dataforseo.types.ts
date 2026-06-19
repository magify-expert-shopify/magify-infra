export type DataForSeoTaskResponse<T> = {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, unknown>;
    result: T[];
  }>;
};

export type DataForSeoKeywordOverviewItem = {
  keyword: string;
  keyword_info?: {
    search_volume?: number;
    competition?: number;
    monthly_searches?: Array<{
      year: number;
      month: number;
      search_volume: number;
    }>;
  };
  serp_info?: {
    items?: DataForSeoSerpResultItem[];
  } | null;
  search_intent_info?: {
    main_intent?: string;
  };
};

export type DataForSeoSerpResultItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string;
  url?: string;
  check_url?: string;
  description?: string;
};

export type DataForSeoKeywordOverviewTaskResult = {
  items?: DataForSeoKeywordOverviewItem[];
};

export type DataForSeoOrganicLiveTaskResult = {
  items?: DataForSeoSerpResultItem[];
};
