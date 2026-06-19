import type { SearchResponse } from 'src/common/types';

export const EMPTY_SEARCH_RESULT: SearchResponse = Object.freeze({
  createdAgencySite: false,
  createdAgencySiteJob: null,
  competitorAgencySites: [],
  blogs: [],
  authors: [],
  blogArticles: [],
  seoClusters: [],
});
