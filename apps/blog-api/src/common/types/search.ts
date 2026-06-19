import type { BlogResult } from "./domain.js";

export type SearchClusterPage = {
  id: string;
  title: string;
  url: string;
  slug?: string | null;
  status?: string;
  pageType?:
    | "BLOG_ARTICLE"
    | "PRODUCT"
    | "COLLECTION"
    | "LANDING_PAGE"
    | "SERVICE_PAGE"
    | "CATEGORY_PAGE"
    | "HOMEPAGE"
    | "FAQ"
    | "OTHER";
  seoRole?: "PILLAR" | "SATELLITE" | "SUPPORT";
};

export type SearchBlogArticle = {
  id: string;
  title: string;
  url?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  status?:
    | "IDEA"
    | "DRAFT"
    | "READY_TO_PUBLISH"
    | "PLANNED"
    | "PUSHED"
    | "PUBLISHED"
    | "ARCHIVED";
  description?: string | null;
  angle?: string | null;
  notes?: string | null;
  primaryKeyword?: string | null;
  publishedAt?: string | null;
  lastScannedAt?: string | null;
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
  } | null;
};

export type CompetitorAgencySiteResult = {
  id: string;
  name: string;
  baseUrl: string;
  lastScannedAt?: string | null;
  _count?: {
    blogs: number;
  };
};

export type AuthorResult = {
  id: string;
  name: string;
  profileUrl: string | null;
  blogs: Array<{
    id: string;
    baseUrl: string;
    title: string | null;
    name: string | null;
  }>;
};

export type BlogArticleResult = {
  id: string;
  title: string;
  url: string;
  blog: {
    title: string | null;
    name: string | null;
  };
  author: {
    name: string;
  } | null;
};

export type SeoClusterResult = {
  id: string;
  name: string;
  hierarchyLevel?: 0 | 1 | 2;
  articleCount?: number;
  parentClusterId?: string | null;
  slug?: string | null;
  icon?: string | null;
  isFavorite?: boolean;
  isSprintCluster?: boolean;
  topic: string;
  description?: string | null;
  primaryKeyword: string;
  userProblem?: string | null;
  notes?: string | null;
  parentCluster?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
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
  pages?: SearchClusterPage[];
  blogArticles?: SearchBlogArticle[];
  descendantBlogArticles?: SearchBlogArticle[];
  _count?: {
    blogArticles: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type SearchResponse = {
  createdAgencySite: boolean;
  createdAgencySiteJob: SearchJobResult | null;
  competitorAgencySites: CompetitorAgencySiteResult[];
  blogs: BlogResult[];
  authors: AuthorResult[];
  blogArticles: BlogArticleResult[];
  seoClusters: SeoClusterResult[];
};

export type SearchJobResult = {
  id: string | number | undefined;
  name: string;
  queueName: string;
  data: {
    competitorAgencySiteId: string;
  };
  attemptsMade: number;
  timestamp: number;
};
