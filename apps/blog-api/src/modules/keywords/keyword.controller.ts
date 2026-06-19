import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseUser } from '../auth/supabase-auth/supabase-auth.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth/supabase-auth.guard';
import type { SupabaseAuthenticatedUser } from '../auth/supabase-auth/supabase-auth.types';
import { requireProjectId } from '../../common/project-query';
import { GoogleKeywordSuggestionsService } from './services/google-keyword-suggestions.service';
import { KeywordGroupService } from './services/keyword-group.service';
import { KeywordGroupingService } from './services/keyword-grouping.service';
import { KeywordSiteVisibilityService } from './services/keyword-site-visibility.service';
import { KeywordService } from './services/keyword.service';

@Controller('keywords')
export class KeywordController {
  constructor(
    private readonly keywordService: KeywordService,
    private readonly keywordGroupService: KeywordGroupService,
    private readonly googleKeywordSuggestionsService: GoogleKeywordSuggestionsService,
    private readonly keywordGroupingService: KeywordGroupingService,
    private readonly keywordSiteVisibilityService: KeywordSiteVisibilityService,
  ) {}

  @Get('suggest')
  suggestKeywords(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
    @Query('hl') language?: string,
    @Query('gl') country?: string,
    @Query('expand') expand?: string,
  ) {
    if (!query?.trim()) {
      throw new BadRequestException('Query param "q" is required');
    }

    const normalizedLimit = limit ? Number.parseInt(limit, 10) : undefined;

    if (limit && !Number.isFinite(normalizedLimit)) {
      throw new BadRequestException('Query param "limit" must be a number');
    }

    return this.googleKeywordSuggestionsService.suggestKeywords(query, {
      limit: normalizedLimit,
      language,
      country,
      expand: expand !== 'false',
    });
  }

  @Get()
  listKeywords(
    @Query('projectId') projectId?: string,
    @Query('includeGrouped') includeGrouped?: string,
  ) {
    return this.keywordService.listKeywords({
      projectId: requireProjectId(projectId, 'keywords'),
      includeGrouped: includeGrouped !== 'false',
    });
  }

  @Get('site-visibility')
  searchSiteVisibility(@Query('siteUrl') siteUrl?: string) {
    if (!siteUrl?.trim()) {
      throw new BadRequestException('Query param "siteUrl" is required');
    }

    return this.keywordSiteVisibilityService.searchCachedSiteVisibility(
      siteUrl.trim(),
    );
  }

  @Post()
  createKeyword(
    @Body()
    body: {
      keyword?: string;
      source?: string | null;
      isFavorite?: boolean | null;
      volume?: number | null;
      difficulty?: number | null;
      searchIntent?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    if (!body.keyword?.trim()) {
      throw new BadRequestException('Body field "keyword" is required');
    }

    return this.keywordService.findExistingOrCreateKeyword({
      projectId: requireProjectId(projectId, 'keywords'),
      keyword: body.keyword,
      source: body.source as any,
      isFavorite: body.isFavorite,
      volume: body.volume,
      difficulty: body.difficulty,
      searchIntent: body.searchIntent,
    });
  }

  @Delete(':id')
  deleteKeyword(@Param('id') keywordId: string) {
    if (!keywordId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    return this.keywordService.deleteKeyword(keywordId.trim());
  }

  @Patch(':id')
  renameKeyword(
    @Param('id') keywordId: string,
    @Body() body: { keyword?: string },
  ) {
    if (!keywordId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (!body.keyword?.trim()) {
      throw new BadRequestException('Body field "keyword" is required');
    }

    return this.keywordService.renameKeyword(keywordId.trim(), body.keyword);
  }

  @Patch(':id/template')
  assignTemplate(
    @Param('id') keywordId: string,
    @Body() body: { pageType?: string },
  ) {
    if (!keywordId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (!body.pageType?.trim()) {
      throw new BadRequestException('Body field "pageType" is required');
    }

    return this.keywordService.assignTemplate(
      keywordId.trim(),
      body.pageType.trim(),
    );
  }

  @Patch('templates/auto-assign')
  autoAssignTemplates(@Body() body: { keywordIds?: string[] }) {
    return this.keywordService.autoAssignTemplates(body.keywordIds);
  }

  @Patch('groups/:id/template')
  assignTemplateToGroup(
    @Param('id') groupId: string,
    @Body() body: { pageType?: string },
  ) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (!body.pageType?.trim()) {
      throw new BadRequestException('Body field "pageType" is required');
    }

    return this.keywordService.assignTemplateToKeywordGroup(
      groupId.trim(),
      body.pageType.trim(),
    );
  }

  @Patch('groups/:id/template/auto-assign')
  autoAssignTemplateToGroup(@Param('id') groupId: string) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    return this.keywordGroupService.autoAssignTemplates(groupId.trim());
  }

  @Post('groups/deduplicate-suggestions')
  deduplicateKeywordGroupSuggestions(
    @Body()
    body: {
      keywordGroups?: Array<{
        id: string;
        name: string;
        description?: string | null;
      }>;
    },
  ) {
    return this.keywordGroupService.suggestDuplicateKeywordGroups(
      body.keywordGroups ?? [],
    );
  }

  @Post('groups/deduplicate-suggestions/cached')
  getCachedKeywordGroupDeduplicationSuggestions(
    @Body()
    body: {
      keywordGroups?: Array<{
        id: string;
        name: string;
        description?: string | null;
      }>;
    },
  ) {
    return this.keywordGroupService.getCachedDuplicateKeywordGroups(
      body.keywordGroups ?? [],
    );
  }

  @Post('groups/:targetId/merge')
  mergeKeywordGroups(
    @Param('targetId') targetGroupId: string,
    @Body() body: { sourceGroupIds?: string[] },
  ) {
    if (!targetGroupId?.trim()) {
      throw new BadRequestException('Route param "targetId" is required');
    }

    return this.keywordGroupService.mergeKeywordGroups(
      targetGroupId.trim(),
      body.sourceGroupIds ?? [],
    );
  }

  @Patch('groups/:id/favorite')
  setKeywordGroupFavorite(
    @Param('id') groupId: string,
    @Body() body: { isFavorite?: boolean },
  ) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (typeof body.isFavorite !== 'boolean') {
      throw new BadRequestException('Body field "isFavorite" is required');
    }

    return this.keywordService.setKeywordGroupFavorite(
      groupId.trim(),
      body.isFavorite,
    );
  }

  @Delete('groups/:id')
  deleteKeywordGroup(@Param('id') groupId: string) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    return this.keywordService.deleteKeywordGroup(groupId.trim());
  }

  @Patch('groups/:id/assignment')
  @UseGuards(SupabaseAuthGuard)
  assignKeywordGroupToCurrentUser(
    @Param('id') groupId: string,
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
  ) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.keywordService.assignKeywordGroupToCurrentUser(
      groupId.trim(),
      user,
    );
  }

  @Delete('groups/:id/assignment')
  @UseGuards(SupabaseAuthGuard)
  clearKeywordGroupAssignment(
    @Param('id') groupId: string,
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
  ) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (!user) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.keywordService.clearKeywordGroupAssignment(
      groupId.trim(),
      user,
    );
  }

  @Patch(':id/favorite')
  setKeywordFavorite(
    @Param('id') keywordId: string,
    @Body() body: { isFavorite?: boolean },
  ) {
    if (!keywordId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    if (typeof body.isFavorite !== 'boolean') {
      throw new BadRequestException('Body field "isFavorite" is required');
    }

    return this.keywordService.setKeywordFavorite(
      keywordId.trim(),
      body.isFavorite,
    );
  }

  @Get('subjects')
  listSubjects() {
    return this.keywordService.listSubjects();
  }

  @Post('subjects')
  createSubject(@Body() body: { name?: string; description?: string | null }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Body field "name" is required');
    }

    return this.keywordService.createSubject({
      name: body.name,
      description: body.description,
    });
  }

  @Get('groups')
  listKeywordGroups(@Query('projectId') projectId?: string) {
    return this.keywordGroupService.listKeywordGroups(
      requireProjectId(projectId, 'keyword groups'),
    );
  }

  @Post('groups')
  createKeywordGroup(
    @Body()
    body: {
      name?: string;
      description?: string | null;
      keywordIds?: string[];
      primaryKeyword?: string | null;
      parentGroupId?: string | null;
      parentGroupIds?: string[] | null;
      seoClusterId?: string | null;
    },
    @Query('projectId') projectId?: string,
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Body field "name" is required');
    }

    return this.keywordGroupService.createKeywordGroup({
      projectId: requireProjectId(projectId, 'keyword groups'),
      name: body.name,
      description: body.description,
      keywordIds: body.keywordIds,
      primaryKeyword: body.primaryKeyword,
      parentGroupId: body.parentGroupId,
      parentGroupIds: body.parentGroupIds,
      seoClusterId: body.seoClusterId,
    });
  }

  @Post('groups/form-groups')
  formKeywordGroupsWithAi() {
    return this.keywordGroupingService.handleFormGroupsWithAi();
  }

  @Patch('groups/:id')
  updateKeywordGroup(
    @Param('id') groupId: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      keywordIds?: string[];
      primaryKeyword?: string | null;
      parentGroupId?: string | null;
      parentGroupIds?: string[] | null;
      seoClusterId?: string | null;
    },
  ) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    return this.keywordService.updateKeywordGroup(groupId.trim(), body);
  }

  @Post('groups/:id/to-cluster')
  convertKeywordGroupToCluster(@Param('id') groupId: string) {
    if (!groupId?.trim()) {
      throw new BadRequestException('Route param "id" is required');
    }

    return this.keywordService.convertKeywordGroupToCluster(groupId.trim());
  }
}
