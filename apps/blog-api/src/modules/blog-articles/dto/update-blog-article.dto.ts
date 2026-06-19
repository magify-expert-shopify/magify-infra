export class UpdateBlogArticleDto {
  title?: string;
  content?: string | null;
  scriptAssetUrls?: string[] | null;
  slug?: string | null;
  primaryKeyword?: string | null;
  requiredKeywords?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  videoYoutubeUrl?: string | null;
  plannedFor?: string | null;
  reviewDueAt?: string | null;
  status?: string;
  authorId?: string | null;
  shopifyBlogId?: string | null;
}
