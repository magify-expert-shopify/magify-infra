import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsPromptConfigsService } from './settings-prompt-configs.service';
import { UpdateKeywordAnalysisPromptDto } from './dto/update-keyword-analysis-prompt.dto';
import { UpdateCurrentSprintDto } from './dto/update-current-sprint.dto';
import { UpdateSprintClusterDto } from './dto/update-sprint-cluster.dto';
import { UpdateBusinessPositioningDto } from './dto/update-business-positioning.dto';
import { SupabaseUser } from 'src/modules/auth/supabase-auth/supabase-auth.decorator';
import { SupabaseAuthGuard } from 'src/modules/auth/supabase-auth/supabase-auth.guard';
import { SupabaseAuthenticatedUser } from 'src/modules/auth/supabase-auth/supabase-auth.types';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  @Get('current-sprint')
  getCurrentSprint() {
    return this.settingsService.getCurrentSprint();
  }

  @Get('sprint-cluster')
  getSprintCluster() {
    return this.settingsService.getSprintCluster();
  }

  @Get('integrations')
  getIntegrations() {
    return this.settingsService.getIntegrations();
  }

  @Get('business-positioning')
  getBusinessPositioning() {
    return this.settingsService.getBusinessPositioning();
  }

  @Get('prompts/blog-article-from-suggestion-tone')
  getBlogArticleFromSuggestionTone() {
    return this.settingsService.getBlogArticleFromSuggestionTone();
  }

  @Get('keyword-difficulty-levels')
  getKeywordDifficultyLevels() {
    return this.settingsService.getKeywordDifficultyLevels();
  }

  @Get('keyword-volume-thresholds')
  getKeywordVolumeThresholds() {
    return this.settingsService.getKeywordVolumeThresholds();
  }

  @Get('openai-cache')
  getOpenAiCacheEntries(
    @Query('promptType') promptType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settingsService.getOpenAiCacheEntries(promptType, {
      page,
      pageSize,
    });
  }

  @Get('preferred-author-profile')
  @UseGuards(SupabaseAuthGuard)
  getPreferredAuthorProfile(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
  ) {
    return this.settingsService.getPreferredAuthorProfile(user);
  }

  @Get('current-project')
  @UseGuards(SupabaseAuthGuard)
  getCurrentProject(@SupabaseUser() user: SupabaseAuthenticatedUser | null) {
    return this.settingsService.getCurrentProject(user);
  }

  @Post('business-positioning/prefill-from-website')
  prefillBusinessPositioningFromWebsite(@Body() body: { websiteUrl?: string }) {
    return this.settingsService.prefillBusinessPositioningFromWebsite(
      body.websiteUrl ?? '',
    );
  }

  @Patch('keyword-analysis-prompt')
  updateKeywordAnalysisPrompt(@Body() dto: UpdateKeywordAnalysisPromptDto) {
    return this.promptConfigsService.updateKeywordAnalysisPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Get('keyword-analysis-prompt')
  getKeywordAnalysisPrompt() {
    return this.promptConfigsService.getKeywordAnalysisPrompt();
  }

  @Get('keyword-analysis-mini-scan-prompt')
  getKeywordAnalysisMiniScanPrompt() {
    return this.promptConfigsService.getKeywordAnalysisMiniScanPrompt();
  }

  @Get('prompts/keyword-analysis-mini-scan-prompt')
  getKeywordAnalysisMiniScanPromptPrompts() {
    return this.promptConfigsService.getKeywordAnalysisMiniScanPrompt();
  }

  @Get('prompts/customer-problem-keyword-extraction-prompt')
  getCustomerProblemKeywordExtractionPrompt() {
    return this.promptConfigsService.getCustomerProblemKeywordExtractionPrompt();
  }

  @Get('prompts/business-positioning-keyword-extraction-prompt')
  getBusinessPositioningKeywordExtractionPrompt() {
    return this.promptConfigsService.getBusinessPositioningKeywordExtractionPrompt();
  }

  @Get('prompts/keyword-grouping-prompt')
  getKeywordGroupingPrompt() {
    return this.promptConfigsService.getKeywordGroupingPrompt();
  }

  @Get('prompts/keyword-group-template-prompt')
  getKeywordGroupTemplatePrompt() {
    return this.promptConfigsService.getKeywordGroupTemplatePrompt();
  }

  @Get('prompts/keyword-group-deduplication-prompt')
  getKeywordGroupDeduplicationPrompt() {
    return this.promptConfigsService.getKeywordGroupDeduplicationPrompt();
  }

  @Get('prompts/seo-cluster-suggestion-prompt')
  getSeoClusterSuggestionPrompt() {
    return this.promptConfigsService.getSeoClusterSuggestionPrompt();
  }

  @Get('prompts/blog-article-from-suggestion-prompt')
  getBlogArticleFromSuggestionPrompt() {
    return this.promptConfigsService.getBlogArticleFromSuggestionPrompt();
  }

  @Get('prompts/blog-article-plan-from-suggestion-prompt')
  getBlogArticlePlanFromSuggestionPrompt() {
    return this.promptConfigsService.getBlogArticlePlanFromSuggestionPrompt();
  }

  @Get('prompts/blog-article-secondary-keywords-suggestion-prompt')
  getBlogArticleSecondaryKeywordsSuggestionPrompt() {
    return this.promptConfigsService.getBlogArticleSecondaryKeywordsSuggestionPrompt();
  }

  @Patch('prompts/customer-problem-keyword-extraction-prompt')
  updateCustomerProblemKeywordExtractionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateCustomerProblemKeywordExtractionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('customer-problem-keyword-extraction-prompt')
  updateCustomerProblemKeywordExtractionPromptLegacy(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.updateCustomerProblemKeywordExtractionPrompt(dto);
  }

  @Patch('prompts/business-positioning-keyword-extraction-prompt')
  updateBusinessPositioningKeywordExtractionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateBusinessPositioningKeywordExtractionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('business-positioning-keyword-extraction-prompt')
  updateBusinessPositioningKeywordExtractionPromptLegacy(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.updateBusinessPositioningKeywordExtractionPrompt(dto);
  }

  @Patch('prompts/keyword-grouping-prompt')
  updateKeywordGroupingPrompt(@Body() dto: UpdateKeywordAnalysisPromptDto) {
    return this.promptConfigsService.updateKeywordGroupingPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/keyword-group-template-prompt')
  updateKeywordGroupTemplatePrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateKeywordGroupTemplatePrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/keyword-group-deduplication-prompt')
  updateKeywordGroupDeduplicationPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateKeywordGroupDeduplicationPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/seo-cluster-suggestion-prompt')
  updateSeoClusterSuggestionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateSeoClusterSuggestionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/blog-article-from-suggestion-prompt')
  updateBlogArticleFromSuggestionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateBlogArticleFromSuggestionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/blog-article-plan-from-suggestion-prompt')
  updateBlogArticlePlanFromSuggestionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateBlogArticlePlanFromSuggestionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/blog-article-secondary-keywords-suggestion-prompt')
  updateBlogArticleSecondaryKeywordsSuggestionPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateBlogArticleSecondaryKeywordsSuggestionPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('keyword-analysis-mini-scan-prompt')
  updateKeywordAnalysisMiniScanPromptLegacy(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateKeywordAnalysisMiniScanPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('prompts/keyword-analysis-mini-scan-prompt')
  updateKeywordAnalysisMiniScanPrompt(
    @Body() dto: UpdateKeywordAnalysisPromptDto,
  ) {
    return this.promptConfigsService.updateKeywordAnalysisMiniScanPrompt(
      dto.input,
      dto.instructions,
      dto.model,
      dto.maxOutputTokens,
    );
  }

  @Patch('current-sprint')
  updateCurrentSprint(@Body() dto: UpdateCurrentSprintDto) {
    return this.settingsService.updateCurrentSprint(
      dto.clusterId,
      dto.blogArticleTargetCount,
      dto.startDate,
      dto.durationDays,
    );
  }

  @Patch('sprint-cluster')
  updateSprintCluster(@Body() dto: UpdateSprintClusterDto) {
    return this.settingsService.updateSprintCluster(dto.clusterId);
  }

  @Patch('business-positioning')
  updateBusinessPositioning(@Body() dto: UpdateBusinessPositioningDto) {
    return this.settingsService.updateBusinessPositioning(
      dto.websiteUrl,
      dto.offering,
      dto.differentiator,
      dto.problemsSolved,
    );
  }

  @Patch('business-positioning/answers-only')
  updateBusinessPositioningAnswersOnly(
    @Body() dto: UpdateBusinessPositioningDto,
  ) {
    return this.settingsService.updateBusinessPositioningWithoutKeywordExtraction(
      dto.websiteUrl,
      dto.offering,
      dto.differentiator,
      dto.problemsSolved,
    );
  }

  @Post('business-positioning/extract-keywords')
  extractBusinessPositioningKeywords(
    @Body() dto: UpdateBusinessPositioningDto,
  ) {
    return this.settingsService.extractBusinessPositioningKeywordsOnly(
      dto.websiteUrl,
      dto.offering,
      dto.differentiator,
      dto.problemsSolved,
    );
  }

  @Patch('keyword-difficulty-levels')
  updateKeywordDifficultyLevels(
    @Body()
    body: {
      levels?: Array<{
        label?: string;
        maxScore?: number;
      }>;
    },
  ) {
    return this.settingsService.updateKeywordDifficultyLevels(
      body.levels ?? [],
    );
  }

  @Patch('prompts/blog-article-from-suggestion-tone')
  updateBlogArticleFromSuggestionTone(@Body() body: { tone?: string }) {
    return this.settingsService.updateBlogArticleFromSuggestionTone(
      body.tone ?? '',
    );
  }

  @Patch('preferred-author-profile')
  @UseGuards(SupabaseAuthGuard)
  updatePreferredAuthorProfile(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Body() body: { authorId?: string | null },
  ) {
    return this.settingsService.updatePreferredAuthorProfile(
      user,
      body.authorId ?? null,
    );
  }

  @Patch('current-project')
  @UseGuards(SupabaseAuthGuard)
  updateCurrentProject(
    @SupabaseUser() user: SupabaseAuthenticatedUser | null,
    @Body() body: { projectId?: string | null },
  ) {
    return this.settingsService.updateCurrentProject(
      user,
      body.projectId ?? null,
    );
  }

  @Patch('keyword-volume-thresholds')
  updateKeywordVolumeThresholds(
    @Body()
    body: {
      lowMax?: number;
      mediumMax?: number;
      highMin?: number;
    },
  ) {
    return this.settingsService.updateKeywordVolumeThresholds(body);
  }

  @Post('shopify/author-metaobject-definition/sync')
  syncShopifyAuthorMetaobjectDefinition(
    @Query('projectId') projectId?: string,
  ) {
    return this.settingsService.syncShopifyAuthorMetaobjectDefinition(
      projectId,
    );
  }
}
