import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BlogArticleRefreshService } from './blog-article-refresh.service';
import { BlogArticlesService } from './blog-articles.service';
import { KeywordService } from '../keywords/services/keyword.service';
import { requireProjectId } from '../../common/project-query';
import { AssignBlogArticleClusterDto, BatchRefreshBlogArticlesDto, CreateBlogArticleIdeaDto, RefreshBlogArticleDto, UpdateBlogArticleDto } from './dto';

@Controller()
export class BlogArticlesController {
  constructor(
    private readonly blogArticlesService: BlogArticlesService,
    private readonly blogArticleRefreshService: BlogArticleRefreshService,
    private readonly keywordService: KeywordService,
  ) {}

  @Get('blog-articles')
  findAll(@Query('projectId') projectId?: string) {
    return this.blogArticlesService.findAll(
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Get('blog-articles/ideas')
  findIdeas(@Query('projectId') projectId?: string) {
    return this.blogArticlesService.findIdeas(
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('blog-articles/ideas')
  createIdea(
    @Body() dto: CreateBlogArticleIdeaDto,
    @Query('projectId') projectId?: string,
  ) {
    return this.blogArticlesService.createIdea(
      dto,
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('blog-articles/blank')
  createBlank(@Query('projectId') projectId?: string) {
    return this.blogArticlesService.createBlankArticle(
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('blog-articles/ideas/assign-clusters')
  assignIdeasToClustersWithAi() {
    return this.blogArticlesService.assignIdeasToClustersWithAi();
  }

  @Post('blog-articles/:id/assign-cluster')
  assignCluster(
    @Param('id') id: string,
    @Body() dto: AssignBlogArticleClusterDto,
  ) {
    return this.blogArticlesService.assignCluster(id, dto.clusterId);
  }

  @Get('blog-articles/:id')
  findOne(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.blogArticlesService.findOne(
      id,
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('blog-articles/:id/update')
  update(@Param('id') id: string, @Body() dto: UpdateBlogArticleDto) {
    return this.blogArticlesService.update(id, dto);
  }

  @Patch('blog-articles/:id/review-assignment')
  assignReview(
    @Param('id') id: string,
    @Body()
    body: {
      supabaseUserId?: string | null;
      supabaseUserEmail?: string | null;
      supabaseUserName?: string | null;
      reviewDueAt?: string | null;
    },
  ) {
    return this.blogArticlesService.assignReview(id, body ?? null);
  }

  @Patch('blog-articles/:id/review-status')
  setReviewStatus(
    @Param('id') id: string,
    @Body()
    body: {
      isReviewCompleted?: boolean;
      reviewOutcome?: 'APPROVED' | 'REJECTED' | null;
      reviewComment?: string | null;
    },
  ) {
    return this.blogArticlesService.setReviewStatus(id, body ?? null);
  }

  @Post('blog-articles/refresh')
  async refreshBatch(@Body() dto: BatchRefreshBlogArticlesDto) {
    const ids = dto.ids?.length ? dto.ids : await this.blogArticlesService.findAllIds();

    if (dto.mode === 'async') {
      const jobs = await this.blogArticleRefreshService.enqueueRefreshMany(ids);

      return {
        mode: 'async',
        ids,
        jobs,
      };
    }

    const articles = await this.blogArticleRefreshService.refreshMany(ids);

    return {
      mode: 'sync',
      ids,
      articles,
    };
  }

  @Post('blog-articles/sync-statuses')
  syncStatuses(@Query('projectId') projectId?: string) {
    return this.blogArticlesService.syncStatusesFromShopify(
      requireProjectId(projectId, 'blog articles'),
    );
  }

  @Post('blog-articles/:id/refresh')
  async refresh(
    @Param('id') id: string,
    @Body() dto: RefreshBlogArticleDto,
  ) {
    if (dto.mode === 'async') {
      const job = await this.blogArticleRefreshService.enqueueRefresh(id);

      return {
        mode: 'async',
        blogArticleId: id,
        job,
      };
    }

    const article = await this.blogArticleRefreshService.refresh(id);

    return {
      mode: 'sync',
      blogArticleId: id,
      article,
    };
  }

  @Get('articles/suggestions')
  listArticleSuggestions(@Query('projectId') projectId?: string) {
    return this.keywordService.listArticleSuggestions(
      requireProjectId(projectId, 'article suggestions'),
    );
  }

  @Get('tutorials/suggestions')
  listTutorialSuggestions(@Query('projectId') projectId?: string) {
    return this.keywordService.listTutorialSuggestions(
      requireProjectId(projectId, 'tutorial suggestions'),
    );
  }

  @Get('guides/suggestions')
  listGuideSuggestions(@Query('projectId') projectId?: string) {
    return this.keywordService.listGuideSuggestions(
      requireProjectId(projectId, 'guide suggestions'),
    );
  }

  @Get('definitions/suggestions')
  listDefinitionSuggestions(@Query('projectId') projectId?: string) {
    return this.keywordService.listDefinitionSuggestions(
      requireProjectId(projectId, 'definition suggestions'),
    );
  }

  @Get('suggestions')
  listSuggestions(@Query('projectId') projectId?: string) {
    return this.keywordService.listSuggestions(
      requireProjectId(projectId, 'keyword group suggestions'),
    );
  }

  @Delete('blog-articles/:id')
  remove(@Param('id') id: string) {
    return this.blogArticlesService.remove(id);
  }
}
