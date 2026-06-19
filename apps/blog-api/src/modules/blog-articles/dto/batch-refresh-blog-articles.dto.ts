export class BatchRefreshBlogArticlesDto {
  mode!: 'sync' | 'async';
  ids?: string[];
}
