import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PageStatus, PageType } from 'src/common/types/prisma-enums';
import { PagesService } from './pages.service';
import { requireProjectId } from '../../common/project-query';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  listPages(@Query('projectId') projectId?: string) {
    return this.pagesService.listPages(requireProjectId(projectId, 'pages'));
  }

  @Get(':id')
  getPage(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.pagesService.findOne(id, requireProjectId(projectId, 'pages'));
  }

  @Patch(':id')
  updatePage(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string | null;
      slug?: string | null;
      status?: PageStatus | null;
      clusterId?: string | null;
    },
  ) {
    return this.pagesService.updatePage(id, body);
  }

  @Delete(':id')
  deletePage(@Param('id') id: string) {
    return this.pagesService.deletePage(id);
  }

  @Post('maintenance/rebuild-blog-article-urls')
  rebuildBlogArticlePageUrls(@Query('projectId') projectId?: string) {
    return this.pagesService.rebuildBlogArticlePageUrls(
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post('from-suggestion/:groupId')
  createFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      plan?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.createFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post(':id/generate-article')
  regenerateArticle(
    @Param('id') id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.regenerateArticleFromPage(
      id,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post('from-suggestion/:groupId/blank')
  createBlankFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.createBlankFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post('from-suggestion/:groupId/associate-existing')
  associateExistingPageFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
      pageId?: string | null;
      shopifyPageId?: string | null;
      blogArticleId?: string | null;
      shopifyArticleId?: string | null;
      title?: string | null;
      handle?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.associateExistingPageFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post('from-suggestion/:groupId/plan')
  generatePlanFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      force?: boolean;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.generatePlanFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Post('from-suggestion/:groupId/secondary-keywords')
  suggestSecondaryKeywordsFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.suggestSecondaryKeywordsFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Get('from-suggestion/:groupId/plan')
  getStoredPlanFromSuggestion(
    @Param('groupId') groupId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.getStoredPlanFromSuggestion(
      groupId,
      requireProjectId(projectId, 'pages'),
    );
  }

  @Patch('from-suggestion/:groupId/plan')
  savePlanFromSuggestion(
    @Param('groupId') groupId: string,
    @Body()
    body: {
      pageType?: PageType | null;
      subjectExact?: string | null;
      primaryKeyword?: string | null;
      secondaryKeywords?: string | null;
      target?: string | null;
      conversionObjective?: string | null;
      approxLength?: string | null;
      plan?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    return this.pagesService.savePlanFromSuggestion(
      groupId,
      body ?? null,
      requireProjectId(projectId, 'pages'),
    );
  }
}
