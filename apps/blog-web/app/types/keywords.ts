import type { KeywordIntent } from "~/types/keyword-analysis";

export type KeywordLengthType = "SHORT_TAIL" | "MID_TAIL" | "LONG_TAIL";

export type KeywordPageType =
  | "BLOG_ARTICLE"
  | "PRODUCT_PAGE"
  | "COLLECTION"
  | "LANDING_PAGE"
  | "SERVICE_PAGE"
  | "CATEGORY_PAGE"
  | "TUTORIAL"
  | "GUIDE"
  | "DEFINITION"
  | "FORM"
  | "HOMEPAGE"
  | "FAQ"
  | "OTHER";

export type KeywordRecord = {
  id: string;
  keyword: string;
  isFavorite: boolean;
  source: string;
  volume?: number | null;
  difficulty?: number | null;
  searchIntent?: KeywordIntent | null;
  searchIntentDescription?: string | null;
  lengthType?: KeywordLengthType | null;
  template?: KeywordPageType | null;
  lastScannedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  page?: {
    id: string;
    title: string;
    url: string;
    pageType: KeywordPageType;
  } | null;
  keywordGroup?: {
    id: string;
    name: string;
    description?: string | null;
    isFavorite?: boolean;
    seoClusterId?: string | null;
    subject?: {
      id: string;
      name: string;
    } | null;
  } | null;
  cluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
};

export type SubjectRecord = {
  id: string;
  name: string;
  description?: string | null;
  _count?: {
    keywordGroups: number;
  };
};

export type KeywordGroupRecord = {
  id: string;
  name: string;
  primaryKeyword?: string | null;
  description?: string | null;
  isFavorite?: boolean;
  assignedSupabaseUserId?: string | null;
  assignedSupabaseUserEmail?: string | null;
  assignedSupabaseUserName?: string | null;
  assignedSupabaseAssignedAt?: string | null;
  parentGroupId?: string | null;
  seoClusterId?: string | null;
  seoCluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  parentGroups?: Array<{
    id: string;
    name: string;
    parentGroupId?: string | null;
  }>;
  keywords: KeywordRecord[];
};

export type KeywordGroupTreeRecord = KeywordGroupRecord & {
  children: KeywordGroupTreeRecord[];
  renderParentGroupId?: string | null;
};

export type ArticleSuggestionRecord = {
  id: string;
  name: string;
  description?: string | null;
  primaryKeyword?: string | null;
  seoClusterId?: string | null;
  seoCluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  assignedSupabaseUserId?: string | null;
  assignedSupabaseUserEmail?: string | null;
  assignedSupabaseUserName?: string | null;
  assignedSupabaseAssignedAt?: string | null;
  keywords: Array<{
    id: string;
    keyword: string;
    template?: KeywordPageType | null;
    volume?: number | null;
    difficulty?: number | null;
    searchIntent?: KeywordIntent | null;
  }>;
};

export type KeywordGroupSuggestionRecord = ArticleSuggestionRecord;

export type KeywordGroupDeduplicationMergeSuggestionRecord = {
  keepGroupId: string;
  duplicateGroupIds: string[];
  reason: string;
};

export type KeywordGroupDeduplicationResponseRecord = {
  merges: KeywordGroupDeduplicationMergeSuggestionRecord[];
};
