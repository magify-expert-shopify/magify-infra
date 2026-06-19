import type { SeoCluster } from "~/types/domain";

export type ProblemSource =
  | "CUSTOMER_INTERVIEW"
  | "CLIENT_CALL"
  | "YOUTUBE_COMMENT"
  | "EMAIL"
  | "SUPPORT_TICKET"
  | "PERSONAL_OBSERVATION"
  | "OTHER";

export type SearchIntent =
  | "INFORMATIONAL"
  | "COMMERCIAL"
  | "TRANSACTIONAL"
  | "NAVIGATIONAL";

export type CustomerProblem = {
  id: string;
  title: string;
  description?: string | null;
  source: ProblemSource;
  intention?: SearchIntent | null;
  category?: CustomerProblemCategory | null;
  clusters: Array<
    Pick<SeoCluster, "id" | "name" | "slug" | "primaryKeyword">
  >;
  keywords: Array<{
    id: string;
    keyword: string;
    volume?: number | null;
    difficulty?: number | null;
    searchIntent?: SearchIntent | null;
    lastScannedAt?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerProblemCategory = {
  id: string;
  title: string;
  clusters?: Array<
    Pick<SeoCluster, "id" | "name" | "slug" | "primaryKeyword">
  >;
  _count?: {
    customerProblems: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertCustomerProblemInput = {
  title: string;
  description?: string | null;
  source: ProblemSource;
  intention?: SearchIntent | null;
  categoryId?: string | null;
  clusterIds?: string[];
};

export type UpsertCustomerProblemCategoryInput = {
  title: string;
  clusterIds?: string[];
};
