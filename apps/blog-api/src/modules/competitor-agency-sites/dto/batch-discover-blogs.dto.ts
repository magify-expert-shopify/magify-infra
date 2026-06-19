export class BatchDiscoverBlogsDto {
  mode!: 'sync' | 'async';
  ids?: string[];
}
