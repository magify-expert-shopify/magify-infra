export type Project = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  shopifyStoreDomain?: string | null;
  currentUserRole?: string | null;
  canDelete?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    members: number;
    blogArticles: number;
  };
};

export type ProjectMember = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
};
