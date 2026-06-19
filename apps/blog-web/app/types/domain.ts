
export type AgencySite = {
  id: string;
  name: string;
  baseUrl: string;
  lastScannedAt?: string | null;
  _count?: {
    blogs: number;
  };
};

export enum BlogPlatform {
  SHOPIFY = "SHOPIFY",
  WORDPRESS = "WORDPRESS",
  WEBFLOW = "WEBFLOW",
  CUSTOM = "CUSTOM",
  UNKNOWN = "UNKNOWN",
}

export type Blog = {
  id: string;
  name: string | null;
  title: string | null;
  baseUrl: string;
  shopifyBlogId?: string | null;
  feedUrl?: string | null;
  slug?: string | null;
  description?: string | null;
  platform?: BlogPlatform;
  languageCode?: string | null;
  lastScannedAt?: string | null;
  competitorAgencySiteId: string;
  _count?: {
    articles: number;
  };
};


export type BlogArticleStatus =
  | "IDEA"
  | "DRAFT"
  | "READY_TO_PUBLISH"
  | "PLANNED"
  | "PUSHED"
  | "PUBLISHED"
  | "ARCHIVED";

export type BlogArticle = {
  id: string;
  title: string;
  projectId?: string | null;
  pageId?: string | null;
  scriptAssetUrls?: string[];
  content?: string | null;
  url?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  status?: BlogArticleStatus;
  description?: string | null;
  angle?: string | null;
  notes?: string | null;
  primaryKeyword?: string | null;
  requiredKeywords?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  videoYoutubeUrl?: string | null;
  plannedFor?: string | null;
  publishedAt?: string | null;
  reviewSupabaseUserId?: string | null;
  reviewSupabaseUserEmail?: string | null;
  reviewSupabaseUserName?: string | null;
  reviewAssignedAt?: string | null;
  reviewDueAt?: string | null;
  reviewCompletedAt?: string | null;
  reviewOutcome?: "APPROVED" | "REJECTED" | null;
  reviewComment?: string | null;
  isReviewCompleted?: boolean;
  lastScannedAt?: string | null;
  shopifyArticleId?: string | null;
  shopifyBlogId?: string | null;
  blogId?: string | null;
  authorId?: string | null;
  blog?: {
    id: string;
    title: string | null;
    name: string | null;
    baseUrl: string;
  } | null;
  cluster?: {
    id: string;
    name: string;
    icon?: string | null;
    slug?: string | null;
  } | null;
  author: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type ClusterPage = {
  id: string;
  title: string;
  url: string;
  slug?: string | null;
  status?: string;
  pageType:
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
  seoRole: "PILLAR" | "SATELLITE" | "SUPPORT";
  keywordGroupId?: string | null;
};

export type Author = {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  slug?: string | null;
  bio?: string | null;
  shopifyAvatarId?: string | null;
  profileUrl?: string | null;
  shopifyPageId?: string | null;
  linkedinProfileUrl?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  source?: AuthorSource;
  createdAt?: string;
  updatedAt?: string;
};

export type SeoCluster = {
  id: string;
  name: string;
  hierarchyLevel?: 0 | 1 | 2;
  articleCount?: number;
  parentClusterId?: string | null;
  pillarKeywordGroupId?: string | null;
  slug?: string | null;
  icon?: string | null;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  topic: string;
  description?: string | null;
  primaryKeyword: string;
  notes?: string | null;
  parentCluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
  pillarKeywordGroup?: {
    id: string;
    name: string;
    primaryKeyword?: string | null;
  } | null;
  keywordGroups?: Array<{
    id: string;
    name: string;
    primaryKeyword?: string | null;
    description?: string | null;
    isFavorite?: boolean;
    seoClusterId?: string | null;
  }>;
  parentClusters?: Array<{
    id: string;
    name: string;
    slug?: string | null;
  }>;
  childClusters?: Array<{
    id: string;
    name: string;
    slug?: string | null;
  }>;
  pages?: ClusterPage[];
  blogArticles?: BlogArticle[];
  descendantBlogArticles?: BlogArticle[];
  _count?: {
    blogArticles: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSeoClusterInput = {
  name: string;
  parentClusterId?: string;
  slug?: string;
  pillarKeywordGroupId?: string | null;
  secondaryKeywordGroupIds?: string[];
  childClusterIds?: string[];
  icon?: string;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  description?: string;
  primaryKeyword: string;
};

export type UpdateSeoClusterInput = {
  name?: string;
  parentClusterId?: string | null;
  slug?: string;
  pillarKeywordGroupId?: string | null;
  secondaryKeywordGroupIds?: string[];
  childClusterIds?: string[];
  icon?: string;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  description?: string;
  primaryKeyword?: string;
};
