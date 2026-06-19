export type BlogSyncPropertyKey =
  | 'name'
  | 'title'
  | 'slug'
  | 'baseUrl'
  | 'feedUrl'
  | 'platform';

export type BlogSyncValueSource = 'local' | 'shopify';

export type BlogSyncAction = 'create_new' | 'associate_existing' | 'sync_existing' | 'ignore';

export type BlogSyncFieldComparison = {
  key: BlogSyncPropertyKey;
  label: string;
  localValue: string | null;
  shopifyValue: string | null;
  isDifferent: boolean;
};

export type BlogSyncExistingBlog = {
  id: string;
  name: string | null;
  title: string | null;
  baseUrl: string;
  feedUrl: string | null;
  slug: string | null;
  description: string | null;
  platform: string | null;
  languageCode: string | null;
  shopifyBlogId: string | null;
};

export type BlogSyncShopifyBlog = {
  id: string;
  title: string;
  handle: string;
};

export type BlogSyncCandidate = {
  shopifyBlog: {
    id: string;
    title: string;
    handle: string;
    baseUrl: string;
    feedUrl: string;
  };
  localBlog: BlogSyncExistingBlog | null;
  matchedBy: 'shopifyBlogId' | 'baseUrl' | null;
  defaultAction: BlogSyncAction;
  comparisons: BlogSyncFieldComparison[];
};

export type BlogSyncPreview = {
  projectId: string;
  storeDomain: string;
  candidates: BlogSyncCandidate[];
  existingBlogs: BlogSyncExistingBlog[];
};

export type BlogSyncApplyOperation = {
  shopifyBlogId: string;
  action: BlogSyncAction;
  targetBlogId?: string | null;
  propertySources?: Partial<Record<BlogSyncPropertyKey, BlogSyncValueSource>>;
};

export type BlogSyncApplyInput = {
  operations: BlogSyncApplyOperation[];
};

export type BlogSyncApplyResult = {
  processedCount: number;
  createdCount: number;
  associatedCount: number;
  synchronizedCount: number;
  ignoredCount: number;
};

export type BlogArticleRelationSyncResult = {
  projectId: string;
  matchedBlogsCount: number;
  matchedArticlesCount: number;
  updatedCount: number;
  skippedCount: number;
};
