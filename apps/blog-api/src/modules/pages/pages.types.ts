import { PageStatus, PageType } from 'src/common/types/prisma-enums';

export type EditorialPageType =
  | 'BLOG_ARTICLE'
  | 'TUTORIAL'
  | 'GUIDE'
  | 'DEFINITION';

export type SuggestionKeyword = {
  id: string;
  keyword: string;
  template?: PageType | null;
  pageId?: string | null;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: string | null;
};

export type SuggestionGroup = {
  id: string;
  name: string;
  projectId?: string | null;
  seoClusterId?: string | null;
  primaryKeyword?: string | null;
  description?: string | null;
  keywords: SuggestionKeyword[];
};

export type PageUpdateInput = {
  title?: string | null;
  slug?: string | null;
  status?: PageStatus | null;
  clusterId?: string | null;
};

export type CreateFromSuggestionInput = {
  pageType?: PageType | null;
  subjectExact?: string | null;
  primaryKeyword?: string | null;
  secondaryKeywords?: string | null;
  target?: string | null;
  conversionObjective?: string | null;
  approxLength?: string | null;
  plan?: string | null;
  force?: boolean;
};

export type AssociateExistingPageInput = {
  pageType?: PageType | null;
  pageId?: string | null;
  shopifyPageId?: string | null;
  blogArticleId?: string | null;
  shopifyArticleId?: string | null;
  title?: string | null;
  handle?: string | null;
};

export type RebuildBlogArticlePageUrlsResult = {
  totalCount: number;
  updatedCount: number;
  skippedCount: number;
};

export type StoredSuggestionPlanRecord = {
  id: string;
  keywordGroupId: string;
  pageId?: string | null;
  projectId?: string | null;
  pageType: PageType;
  subjectExact: string;
  primaryKeyword: string;
  secondaryKeywords?: string | null;
  target: string;
  conversionObjective: string;
  approxLength: string;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SuggestionCreationContext = {
  group: SuggestionGroup;
  normalizedGroupId: string;
  normalizedProjectId: string | null;
  targetPageType: EditorialPageType;
  matchingKeywords: SuggestionKeyword[];
  matchingKeywordIds: string[];
  articleBrief: {
    subjectExact: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    target: string;
    conversionObjective: string;
    approxLength: string;
    plan?: string | null;
  };
};
