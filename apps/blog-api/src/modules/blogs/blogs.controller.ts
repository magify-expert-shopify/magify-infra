import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { BlogArticlesService } from '../blog-articles/blog-articles.service';
import { BlogArticleDiscoveryService } from './blog-article-discovery.service';
import { requireProjectId } from '../../common/project-query';
import type { BlogSyncApplyInput } from './blogs.types';
import { BatchDiscoverBlogArticlesDto, DiscoverBlogArticlesDto } from './dto';

@Controller('blogs')
export class BlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly blogArticlesService: BlogArticlesService,
    private readonly blogArticleDiscoveryService: BlogArticleDiscoveryService,
  ) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.blogsService.findAll(requireProjectId(projectId, 'blogs'));
  }

  @Get('sync-shopify/preview')
  previewShopifyBlogsSync(@Query('projectId') projectId?: string) {
    return this.blogsService.getShopifyBlogSyncPreview(
      requireProjectId(projectId, 'blogs'),
    );
  }

  @Post('sync-shopify/apply')
  applyShopifyBlogsSync(
    @Body() dto: BlogSyncApplyInput,
    @Query('projectId') projectId?: string,
  ) {
    return this.blogsService.applyShopifyBlogSync(
      requireProjectId(projectId, 'blogs'),
      dto,
    );
  }

  @Post('sync-relations')
  syncBlogArticleRelations(@Query('projectId') projectId?: string) {
    return this.blogsService.syncBlogArticleRelationsFromShopify(
      requireProjectId(projectId, 'blogs'),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.blogsService.findOne(id, requireProjectId(projectId, 'blogs'));
  }

  @Get(':id/articles')
  findArticles(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.blogArticlesService.findByBlog(
      id,
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('discover-articles')
  async discoverArticlesBatch(@Body() dto: BatchDiscoverBlogArticlesDto) {
    const ids = dto.ids?.length ? dto.ids : await this.blogsService.findAllIds();

    if (dto.mode === 'async') {
      const jobs = await this.blogArticleDiscoveryService.enqueueDiscoveryMany(
        ids,
      );

      return {
        mode: 'async',
        ids,
        jobs,
      };
    }

    const results = await this.blogArticleDiscoveryService.discoverAndPersistMany(
      ids,
    );

    return {
      mode: 'sync',
      ids,
      results,
    };
  }

  @Post(':id/discover-articles')
  async discoverArticles(
    @Param('id') id: string,
    @Body() dto: DiscoverBlogArticlesDto,
  ) {
    if (dto.mode === 'async') {
      const job = await this.blogArticleDiscoveryService.enqueueDiscovery(id);

      return {
        mode: 'async',
        blogId: id,
        job,
      };
    }

    const result = await this.blogArticleDiscoveryService.discoverAndPersist(id);

    return {
      mode: 'sync',
      blogId: id,
      ...result,
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blogsService.remove(id);
  }
}
