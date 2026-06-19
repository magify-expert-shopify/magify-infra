import { PageType } from 'src/common/types/prisma-enums';
import type { BlogArticleFromSuggestionResponse } from './blog-article-generation.schemas';

export type EditorialPageType =
  | 'BLOG_ARTICLE'
  | 'TUTORIAL'
  | 'GUIDE'
  | 'DEFINITION';

export type SuggestionKeyword = {
  keyword: string;
  template?: PageType | null;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: string | null;
};

export type SuggestionGroup = {
  id: string;
  name: string;
  primaryKeyword?: string | null;
  description?: string | null;
  keywords: SuggestionKeyword[];
};

export type BlogArticleSuggestionDraft = BlogArticleFromSuggestionResponse & {
  content: string;
};

export type BlogArticleSuggestionBrief = {
  subjectExact: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  target: string;
  conversionObjective: string;
  approxLength: string;
  plan?: string | null;
};
