export const EMPTY_KEYWORD_GROUPING_RESULT = {
  totalKeywords: 0,
  createdGroups: 0,
  updatedGroups: 0,
  groups: [] as unknown[],
} as const;

export const EMPTY_GOOGLE_KEYWORD_SUGGESTIONS_RESULT = {
  query: '',
  suggestions: [] as Array<{
    keyword: string;
    sourceQuery: string;
  }>,
  total: 0,
} as const;

export const EMPTY_KEYWORD_GROUP_TEMPLATE_RESULT = {
  updatedCount: 0,
  skippedCount: 0,
  updatedKeywords: [] as unknown[],
  pageType: 'OTHER',
} as const;
