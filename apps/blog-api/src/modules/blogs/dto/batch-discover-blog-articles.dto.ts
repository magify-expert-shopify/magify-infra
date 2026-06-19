export class BatchDiscoverBlogArticlesDto {
  mode!: 'sync' | 'async';
  ids?: string[];
}
