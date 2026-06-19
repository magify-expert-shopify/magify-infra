import type { KeywordIntent } from "~/types/keyword-analysis";
import type { KeywordPageType } from "~/types/keywords";
import type { ClusterPage } from "~/types/domain";

export type PageStatus =
  | "IDEA"
  | "DRAFT"
  | "PLANNED"
  | "READY_TO_PUBLISH"
  | "PUSHED"
  | "PUBLISHED"
  | "ARCHIVED";

export type PageKeywordRecord = {
  id: string;
  keyword: string;
  template?: KeywordPageType | null;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: KeywordIntent | null;
  pageId?: string | null;
  keywordGroup?: {
    id: string;
    name: string;
    primaryKeyword?: string | null;
    description?: string | null;
  } | null;
};

export type PageListRecord = {
  id: string;
  title: string;
  url: string;
  slug?: string | null;
  status?: PageStatus | null;
  pageType: ClusterPage["pageType"];
  seoRole: ClusterPage["seoRole"];
  searchIntent?: KeywordIntent | null;
  cluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  _count?: {
    keywords: number;
  };
  assignedSupabaseUserId?: string | null;
  assignedSupabaseUserEmail?: string | null;
  assignedSupabaseUserName?: string | null;
  assignedSupabaseAssignedAt?: string | null;
  blogArticle?: {
    id: string;
    title: string;
    content?: string | null;
    excerpt?: string | null;
    slug?: string | null;
    url?: string | null;
    status?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    primaryKeyword?: string | null;
    requiredKeywords?: string | null;
    reviewSupabaseUserId?: string | null;
    reviewAssignedAt?: string | null;
    reviewDueAt?: string | null;
    reviewCompletedAt?: string | null;
    reviewOutcome?: string | null;
    reviewComment?: string | null;
    reviewSupabaseUser?: {
      id: string;
      email?: string | null;
      displayName?: string | null;
    } | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PageDetailRecord = PageListRecord & {
  keywords: PageKeywordRecord[];
  blogArticleGenerationJob?: {
    id?: string | number | null;
    name: string;
    queueName: string;
    state: string;
    attemptsMade: number;
    timestamp: number;
    processedOn?: number | null;
    finishedOn?: number | null;
    delay: number;
  } | null;
  blogArticle?: {
    id: string;
    title: string;
    slug?: string | null;
    url?: string | null;
    status?: string | null;
    excerpt?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    primaryKeyword?: string | null;
    requiredKeywords?: string | null;
  } | null;
};

export type PageSuggestionPlanRecord = {
  id: string;
  keywordGroupId: string;
  pageId?: string | null;
  projectId?: string | null;
  pageType: KeywordPageType;
  subjectExact: string;
  primaryKeyword: string;
  secondaryKeywords?: string | null;
  target: string;
  conversionObjective: string;
  approxLength: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
};
