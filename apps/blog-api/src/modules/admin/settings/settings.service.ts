import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DiscordBotService } from '../../discord-bot/discord-bot.service';
import { GoogleAuthService } from '../../auth/google-auth/google-auth.service';
import { GmailMailService } from '../../mail/mail.service';
import { KeywordService } from '../../keywords/services/keyword.service';
import { OpenAiPlatformService } from '../../openai-platform/openai-platform.service';
import { OPENAI_PROMPT_TYPE_LABELS } from '../../openai-platform/openai-prompt-types.constants';
import { ShopifyAuthService } from '../../shopify/shopify-auth.service';
import { ShopifyService } from '../../shopify/shopify.service';
import { SettingsPromptConfigsService } from './settings-prompt-configs.service';
import {
  businessPositioningKeywordExtractionResponseSchema,
  businessPositioningPrefillResponseSchema,
} from './settings.schemas';
import {
  BUSINESS_POSITIONING_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA,
  BUSINESS_POSITIONING_PREFILL_OPENAI_JSON_SCHEMA,
} from './settings-openai-schemas.constants';
import {
  extractHtmlTag,
  extractMetaDescription,
} from '../../../common/utils/html';
import {
  extractOpenAiText,
  parseStructuredOpenAiResponse,
} from '../../../common/utils/openai-response';
import { extractHostname } from '../../../common/utils/url.util';
import {
  BUSINESS_POSITIONING_SETTING_KEY,
  BLOG_ARTICLE_FROM_SUGGESTION_TONE_SETTING_KEY,
  CURRENT_SPRINT_SETTING_KEY,
  CURRENT_SPRINT_CLUSTER_SETTING_KEY,
  CURRENT_SPRINT_RECORD_ID,
  DEFAULT_BLOG_ARTICLE_FROM_SUGGESTION_TONE,
  DEFAULT_BUSINESS_POSITIONING_KEYWORD_EXTRACTION_AI_MODEL,
  DEFAULT_KEYWORD_DIFFICULTY_LEVELS,
  DEFAULT_KEYWORD_VOLUME_THRESHOLDS,
  SUPABASE_USER_CURRENT_PROJECT_SETTING_KEY_PREFIX,
  KEYWORD_DIFFICULTY_LEVELS_SETTING_KEY,
  KEYWORD_VOLUME_THRESHOLDS_SETTING_KEY,
  SUPABASE_USER_PREFERRED_AUTHOR_SETTING_KEY_PREFIX,
} from './settings.constants';
import { KeywordSource } from 'src/common/types/prisma-enums';
import type { SupabaseAuthenticatedUser } from '../../auth/supabase-auth/supabase-auth.types';
import type {
  BusinessPositioningSettings,
  IntegrationConnectionStatus,
  IntegrationsStatusResponse,
  KeywordDifficultyLevel,
  KeywordDifficultyLevelsSettings,
  KeywordVolumeThresholdsSettings,
  OpenAiPromptType,
} from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly shopifyAuthService: ShopifyAuthService,
    private readonly shopifyService: ShopifyService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly discordBotService: DiscordBotService,
    private readonly gmailMailService: GmailMailService,
    private readonly keywordService: KeywordService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  async getCurrentSprint() {
    const sprint = await this.getCurrentSprintRecord();

    if (!sprint) {
      return {
        clusterId: null,
        clusterName: null,
        blogArticleTargetCount: 0,
        startDate: '',
        durationDays: null,
        endDate: '',
        isInProgress: false,
      };
    }

    return this.serializeSprint(sprint);
  }

  async getSprintCluster() {
    const sprint = await this.getCurrentSprintRecord();
    const cluster = sprint?.cluster ?? null;

    return {
      clusterId: cluster?.id ?? null,
      clusterName: cluster?.name ?? null,
    };
  }

  async getIntegrations(): Promise<IntegrationsStatusResponse> {
    const googleOauthClientId =
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID') ?? '';
    const googleOauthRedirectUri =
      this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URI') ?? '';
    const [
      googleOauthStatus,
      googleGmailStatus,
      discordBotStatus,
      shopifyConnectionStatus,
    ] = await Promise.all([
      this.getGoogleOauthConnectionStatus(),
      this.getGoogleGmailConnectionStatus(),
      this.getDiscordBotConnectionStatus(),
      this.getShopifyConnectionStatus(),
    ]);
    const dataForSeoLogin =
      this.configService.get<string>('DATAFORSEO_LOGIN') ?? '';
    const dataForSeoBaseUrl =
      this.configService.get<string>('DATAFORSEO_BASE_URL') ?? '';
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    const openAiBaseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ?? '';
    const openAiOrganization =
      this.configService.get<string>('OPENAI_ORGANIZATION') ?? '';
    const openAiProject =
      this.configService.get<string>('OPENAI_PROJECT') ?? '';
    const databaseUrl = this.configService.get<string>('DATABASE_URL') ?? '';

    const databaseConnectionStatus =
      await this.getDatabaseConnectionStatus(databaseUrl);

    const connections: IntegrationConnectionStatus[] = [
      {
        key: 'google-oauth',
        label: 'Google Auth',
        configured: googleOauthStatus.configured,
        accountLabel:
          googleOauthStatus.accountLabel ||
          (googleOauthClientId
            ? this.maskClientId(googleOauthClientId)
            : 'Non configuré'),
        detail:
          googleOauthStatus.detail ||
          googleOauthRedirectUri ||
          'Aucune URI de redirection',
        error: googleOauthStatus.error,
        authUrl: googleOauthStatus.authUrl,
        profile: googleOauthStatus.profile,
      },
      {
        key: 'discord-bot',
        label: 'Bot Discord',
        configured: discordBotStatus.configured,
        accountLabel: discordBotStatus.accountLabel,
        detail: discordBotStatus.detail,
        error: discordBotStatus.error,
        authUrl: discordBotStatus.authUrl,
        profile: discordBotStatus.profile,
      },
      {
        key: 'google-gmail',
        label: 'API Gmail',
        configured: googleGmailStatus.configured,
        accountLabel:
          googleGmailStatus.accountLabel ||
          (googleOauthClientId
            ? this.maskClientId(googleOauthClientId)
            : 'Non configuré'),
        detail:
          googleGmailStatus.detail ||
          googleOauthRedirectUri ||
          'Aucune URI de redirection',
        error: googleGmailStatus.error,
        authUrl: googleGmailStatus.authUrl,
        profile: googleGmailStatus.profile,
      },
      {
        key: 'dataforseo',
        label: 'DataForSEO',
        configured: !!dataForSeoLogin,
        accountLabel: dataForSeoLogin
          ? this.maskAccountValue(dataForSeoLogin)
          : 'Non configuré',
        detail: dataForSeoBaseUrl || 'Aucune URL API',
        error: null,
        authUrl: null,
        profile: null,
      },
      {
        key: 'openai',
        label: 'OpenAI',
        configured: !!openAiApiKey,
        accountLabel: this.getOpenAiAccountLabel(
          openAiOrganization,
          openAiProject,
          openAiApiKey,
        ),
        detail: openAiBaseUrl || 'URL API par défaut',
        error: null,
        authUrl: null,
        profile: null,
      },
      {
        key: 'shopify',
        label: 'Shopify',
        configured: shopifyConnectionStatus.configured,
        accountLabel: shopifyConnectionStatus.accountLabel,
        detail: shopifyConnectionStatus.detail,
        error: shopifyConnectionStatus.error,
        authUrl: shopifyConnectionStatus.authUrl,
        profile: shopifyConnectionStatus.profile,
      },
      {
        key: 'database',
        label: 'Database',
        configured: databaseConnectionStatus.configured,
        accountLabel: this.getDatabaseLabel(databaseUrl),
        detail: databaseConnectionStatus.detail,
        error: databaseConnectionStatus.error,
        authUrl: null,
        profile: null,
      },
    ];

    return { connections };
  }

  async getBusinessPositioning(): Promise<BusinessPositioningSettings> {
    const answers = this.parseBusinessPositioningValue(
      await this.findAppSettingValue(BUSINESS_POSITIONING_SETTING_KEY),
    );
    const keywords = await this.keywordService.listKeywords({
      source: KeywordSource.BUSINESS_POSITIONING,
    });

    return {
      ...answers,
      keywords,
      isComplete: this.isBusinessPositioningComplete(answers),
    };
  }

  async getBlogArticleFromSuggestionTone() {
    return (
      (await this.findAppSettingValue(
        BLOG_ARTICLE_FROM_SUGGESTION_TONE_SETTING_KEY,
      )) || DEFAULT_BLOG_ARTICLE_FROM_SUGGESTION_TONE
    );
  }

  async getKeywordDifficultyLevels(): Promise<KeywordDifficultyLevelsSettings> {
    return {
      levels: this.parseKeywordDifficultyLevelsValue(
        await this.findAppSettingValue(KEYWORD_DIFFICULTY_LEVELS_SETTING_KEY),
      ),
    };
  }

  async getKeywordVolumeThresholds(): Promise<KeywordVolumeThresholdsSettings> {
    return this.parseKeywordVolumeThresholdsValue(
      await this.findAppSettingValue(KEYWORD_VOLUME_THRESHOLDS_SETTING_KEY),
    );
  }

  async getOpenAiCacheEntries(
    promptType?: string | null,
    pagination?: {
      page?: string | number | null;
      pageSize?: string | number | null;
    },
  ) {
    const normalizedPromptType =
      this.normalizeOpenAiPromptTypeFilter(promptType);
    const page = this.normalizePositiveInteger(pagination?.page, 1);
    const pageSize = this.normalizePositiveInteger(
      pagination?.pageSize,
      10,
      50,
    );
    const skip = (page - 1) * pageSize;
    const where = normalizedPromptType
      ? {
          promptType: normalizedPromptType,
        }
      : undefined;
    const total = await (this.prisma as any).openAiCache.count({
      where,
    });
    const entries = await (this.prisma as any).openAiCache.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    });

    const promptTypes = Object.entries(OPENAI_PROMPT_TYPE_LABELS).map(
      ([type, label]) => ({
        type,
        label,
      }),
    );

    return {
      activePromptType: normalizedPromptType,
      promptTypes,
      entries: entries.map((entry: any) =>
        this.serializeOpenAiCacheEntry(entry),
      ),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasPreviousPage: page > 1,
        hasNextPage: page * pageSize < total,
      },
    };
  }

  private normalizePositiveInteger(
    value: string | number | null | undefined,
    fallback: number,
    max?: number,
  ) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    if (typeof max === 'number') {
      return Math.min(parsed, max);
    }

    return parsed;
  }

  private async findAppSettingValue(key: string) {
    try {
      const setting = await (this.prisma as any).appSetting.findUnique({
        where: { key },
      });

      return setting?.value?.trim() || null;
    } catch (error) {
      if (this.isMissingAppSettingTableError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async safeUpsertAppSetting(key: string, value: string) {
    try {
      await (this.prisma as any).appSetting.upsert({
        where: { key },
        update: { value },
        create: {
          id: randomUUID(),
          key,
          value,
        },
      });
    } catch (error) {
      if (this.isMissingAppSettingTableError(error)) {
        return;
      }

      throw error;
    }
  }

  private isMissingAppSettingTableError(error: unknown) {
    const candidate = error as {
      code?: string;
      message?: string;
      meta?: {
        driverAdapterError?: {
          cause?: {
            kind?: string;
            table?: string;
          };
        };
      };
    };
    const cause = candidate.meta?.driverAdapterError?.cause;

    return (
      candidate.code === 'P2021' ||
      cause?.kind === 'TableDoesNotExist' ||
      cause?.table === 'public.appsetting' ||
      candidate.message?.includes('relation "public.appsetting" does not exist') ||
      candidate.message?.includes('public.appsetting does not exist')
    );
  }

  async getPreferredAuthorProfile(user: SupabaseAuthenticatedUser | null) {
    const authenticatedUser = this.requireSupabaseUser(user);
    const authorId = await this.findAppSettingValue(
      this.getPreferredAuthorSettingKey(authenticatedUser.id),
    );

    if (!authorId) {
      return {
        authorId: null,
      };
    }

    const author = await (this.prisma as any).author.findFirst({
      where: {
        id: authorId,
        trashedAt: null,
        source: 'MAGIFY',
      },
      select: {
        id: true,
      },
    });

    if (!author) {
      return {
        authorId: null,
      };
    }

    return {
      authorId: author.id,
    };
  }

  async getCurrentProject(user: SupabaseAuthenticatedUser | null) {
    const authenticatedUser = this.requireSupabaseUser(user);
    const projectId = await this.findAppSettingValue(
      this.getCurrentProjectSettingKey(authenticatedUser.id),
    );

    if (!projectId) {
      return {
        project: null,
      };
    }

    const project = await this.findProjectForSupabaseUser(
      authenticatedUser.id,
      projectId,
    );

    if (!project) {
      await this.safeUpsertAppSetting(
        this.getCurrentProjectSettingKey(authenticatedUser.id),
        '',
      );

      return {
        project: null,
      };
    }

    return {
      project: this.serializeProjectSummary(project),
    };
  }

  async prefillBusinessPositioningFromWebsite(websiteUrl: string) {
    const normalizedWebsiteUrl = websiteUrl.trim();

    if (!normalizedWebsiteUrl) {
      return {
        websiteUrl: '',
        offering: '',
        differentiator: '',
        problemsSolved: '',
      };
    }

    const websiteContext = await this.fetchWebsiteContext(normalizedWebsiteUrl);

    if (!this.openAiPlatformService.isConfigured()) {
      return this.buildBusinessPositioningPrefillFallback(
        normalizedWebsiteUrl,
        websiteContext,
      );
    }

    try {
      const response = await this.openAiPlatformService.createResponse({
        model: process.env.OPENAI_KEYWORD_ANALYSIS_MODEL || 'gpt-4.1-mini',
        promptType: 'BUSINESS_POSITIONING_PREFILL',
        instructions:
          'Tu aides à pré-rédiger un onboarding business. Réponds uniquement avec un JSON valide contenant websiteUrl, offering, differentiator et problemsSolved.',
        input: [
          "À partir de l'URL et des éléments extraits du site, pré-rédige trois réponses courtes et concrètes en français.",
          'Si une information manque, formule une hypothèse prudente et exploitable.',
          '',
          `URL: ${normalizedWebsiteUrl}`,
          `Titre: ${websiteContext.title || 'Non trouvé'}`,
          `Description: ${websiteContext.description || 'Non trouvée'}`,
          `Contenu: ${websiteContext.content || 'Non trouvé'}`,
          '',
          'Format attendu:',
          '{"websiteUrl":"...","offering":"...","differentiator":"...","problemsSolved":"..."}',
        ].join('\n'),
        text: {
          format: {
            type: 'json_schema',
            name: 'business_positioning_prefill_response',
            strict: true,
            schema: BUSINESS_POSITIONING_PREFILL_OPENAI_JSON_SCHEMA,
          },
        },
        max_output_tokens: 500,
      });
      const parsed = parseStructuredOpenAiResponse(
        response,
        businessPositioningPrefillResponseSchema,
      );

      return {
        websiteUrl: parsed.websiteUrl || normalizedWebsiteUrl,
        offering: parsed.offering,
        differentiator: parsed.differentiator,
        problemsSolved: parsed.problemsSolved,
      };
    } catch {
      return this.buildBusinessPositioningPrefillFallback(
        normalizedWebsiteUrl,
        websiteContext,
      );
    }
  }

  async updateCurrentSprint(
    clusterId?: string | null,
    blogArticleTargetCount?: number | null,
    startDate?: string | null,
    durationDays?: number | null,
  ) {
    const normalizedClusterId = clusterId?.trim() || null;
    const normalizedStartDate = startDate?.trim() || null;
    const normalizedTargetCount = Number.isFinite(blogArticleTargetCount)
      ? Math.max(0, Math.trunc(blogArticleTargetCount ?? 0))
      : 0;
    const normalizedDurationDays = Number.isFinite(durationDays)
      ? Math.max(1, Math.trunc(durationDays ?? 0))
      : null;
    const startDateValue = normalizedStartDate
      ? this.parseDateInput(normalizedStartDate)
      : null;

    await this.assertSprintClusterExists(normalizedClusterId);
    await this.syncSprintClusterFlag(normalizedClusterId);

    const sprint = await (this.prisma as any).sprint.upsert({
      where: {
        id: CURRENT_SPRINT_RECORD_ID,
      },
      update: {
        clusterId: normalizedClusterId,
        blogArticleTargetCount: normalizedTargetCount,
        startDate: startDateValue,
        durationDays: normalizedDurationDays,
      },
      create: {
        id: CURRENT_SPRINT_RECORD_ID,
        clusterId: normalizedClusterId,
        blogArticleTargetCount: normalizedTargetCount,
        startDate: startDateValue,
        durationDays: normalizedDurationDays,
      },
      include: {
        seoCluster: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.serializeSprint(sprint);
  }

  async updateKeywordDifficultyLevels(
    levels: Array<{
      label?: string;
      maxScore?: number;
    }>,
  ): Promise<KeywordDifficultyLevelsSettings> {
    const normalizedLevels = this.normalizeKeywordDifficultyLevels(levels);
    const value = JSON.stringify(normalizedLevels);

    await this.safeUpsertAppSetting(KEYWORD_DIFFICULTY_LEVELS_SETTING_KEY, value);

    return {
      levels: normalizedLevels,
    };
  }

  async updateKeywordVolumeThresholds(input: {
    lowMax?: number;
    mediumMax?: number;
    highMin?: number;
  }): Promise<KeywordVolumeThresholdsSettings> {
    const normalizedThresholds = this.normalizeKeywordVolumeThresholds(input);
    const value = JSON.stringify(normalizedThresholds);

    await this.safeUpsertAppSetting(KEYWORD_VOLUME_THRESHOLDS_SETTING_KEY, value);

    return normalizedThresholds;
  }

  async updateBusinessPositioning(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ): Promise<BusinessPositioningSettings> {
    const normalizedAnswers = {
      websiteUrl: websiteUrl.trim(),
      offering: offering.trim(),
      differentiator: differentiator.trim(),
      problemsSolved: problemsSolved.trim(),
    };
    const keywords =
      await this.extractBusinessPositioningKeywords(normalizedAnswers);

    return this.persistBusinessPositioning(normalizedAnswers, keywords);
  }

  async updateBusinessPositioningWithoutKeywordExtraction(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ): Promise<BusinessPositioningSettings> {
    const normalizedAnswers = {
      websiteUrl: websiteUrl.trim(),
      offering: offering.trim(),
      differentiator: differentiator.trim(),
      problemsSolved: problemsSolved.trim(),
    };
    const currentBusinessPositioning = await this.getBusinessPositioning();

    return this.persistBusinessPositioning(
      normalizedAnswers,
      currentBusinessPositioning.keywords.map((keyword) => keyword.keyword),
    );
  }

  async updateBlogArticleFromSuggestionTone(tone: string) {
    const normalizedTone = tone.trim();

    await this.safeUpsertAppSetting(
      BLOG_ARTICLE_FROM_SUGGESTION_TONE_SETTING_KEY,
      normalizedTone || DEFAULT_BLOG_ARTICLE_FROM_SUGGESTION_TONE,
    );

    return this.getBlogArticleFromSuggestionTone();
  }

  async updatePreferredAuthorProfile(
    user: SupabaseAuthenticatedUser | null,
    authorId?: string | null,
  ) {
    const authenticatedUser = this.requireSupabaseUser(user);
    const normalizedAuthorId = authorId?.trim() || null;

    if (normalizedAuthorId) {
      const author = await (this.prisma as any).author.findFirst({
        where: {
          id: normalizedAuthorId,
          trashedAt: null,
          source: 'MAGIFY',
        },
        select: {
          id: true,
        },
      });

      if (!author) {
        throw new Error(`Author ${normalizedAuthorId} not found`);
      }
    }

    await this.safeUpsertAppSetting(
      this.getPreferredAuthorSettingKey(authenticatedUser.id),
      normalizedAuthorId ?? '',
    );

    return {
      authorId: normalizedAuthorId,
    };
  }

  async updateCurrentProject(
    user: SupabaseAuthenticatedUser | null,
    projectId?: string | null,
  ) {
    const authenticatedUser = this.requireSupabaseUser(user);
    const normalizedProjectId = projectId?.trim() || null;

    if (!normalizedProjectId) {
      await this.safeUpsertAppSetting(
        this.getCurrentProjectSettingKey(authenticatedUser.id),
        '',
      );

      return {
        project: null,
      };
    }

    const project = await this.findProjectForSupabaseUser(
      authenticatedUser.id,
      normalizedProjectId,
    );

    if (!project) {
      throw new BadRequestException('Projet introuvable ou inaccessible.');
    }

    await this.safeUpsertAppSetting(
      this.getCurrentProjectSettingKey(authenticatedUser.id),
      normalizedProjectId,
    );

    return {
      project: this.serializeProjectSummary(project),
    };
  }

  async extractBusinessPositioningKeywordsOnly(
    websiteUrl: string,
    offering: string,
    differentiator: string,
    problemsSolved: string,
  ): Promise<BusinessPositioningSettings> {
    const normalizedAnswers = {
      websiteUrl: websiteUrl.trim(),
      offering: offering.trim(),
      differentiator: differentiator.trim(),
      problemsSolved: problemsSolved.trim(),
    };
    const keywords =
      await this.extractBusinessPositioningKeywords(normalizedAnswers);
    const createdKeywords =
      await this.replaceBusinessPositioningKeywords(keywords);

    return {
      ...normalizedAnswers,
      keywords: createdKeywords,
      isComplete: this.isBusinessPositioningComplete(normalizedAnswers),
    };
  }

  private async persistBusinessPositioning(
    normalizedAnswers: {
      websiteUrl: string;
      offering: string;
      differentiator: string;
      problemsSolved: string;
    },
    keywords: string[],
  ): Promise<BusinessPositioningSettings> {
    try {
      const createdKeywords = await this.prisma.$transaction(async (tx) => {
        await (tx as any).appSetting.upsert({
          where: {
            key: BUSINESS_POSITIONING_SETTING_KEY,
          },
          update: {
            value: JSON.stringify(normalizedAnswers),
          },
          create: {
            id: randomUUID(),
            key: BUSINESS_POSITIONING_SETTING_KEY,
            value: JSON.stringify(normalizedAnswers),
          },
        });

        return this.replaceBusinessPositioningKeywords(keywords, tx);
      });

      return {
        ...normalizedAnswers,
        keywords: createdKeywords,
        isComplete: this.isBusinessPositioningComplete(normalizedAnswers),
      };
    } catch (error) {
      if (!this.isMissingAppSettingTableError(error)) {
        throw error;
      }

      const createdKeywords = await this.replaceBusinessPositioningKeywords(
        keywords,
      );

      return {
        ...normalizedAnswers,
        keywords: createdKeywords,
        isComplete: this.isBusinessPositioningComplete(normalizedAnswers),
      };
    }
  }

  async updateSprintCluster(clusterId?: string | null) {
    const normalizedClusterId = clusterId?.trim() || null;

    await this.assertSprintClusterExists(normalizedClusterId);
    await this.syncSprintClusterFlag(normalizedClusterId);

    await (this.prisma as any).sprint.upsert({
      where: {
        id: CURRENT_SPRINT_RECORD_ID,
      },
      update: {
        clusterId: normalizedClusterId,
      },
      create: {
        id: CURRENT_SPRINT_RECORD_ID,
        clusterId: normalizedClusterId,
        blogArticleTargetCount: 0,
      },
    });

    return this.getSprintCluster();
  }

  async syncShopifyAuthorMetaobjectDefinition(projectId?: string | null) {
    const definition = await this.shopifyService.syncAuthorMetaobjectDefinition(
      projectId?.trim() || '',
    );

    return {
      id: definition.id,
      type: definition.type,
      displayNameKey: definition.displayNameKey ?? null,
      fieldDefinitions: definition.fieldDefinitions.map((fieldDefinition) => ({
        key: fieldDefinition.key,
        name: fieldDefinition.name ?? fieldDefinition.key,
        type: fieldDefinition.type?.name ?? null,
      })),
    };
  }

  private async getCurrentSprintRecord() {
    const sprint = await (this.prisma as any).sprint.findUnique({
      where: {
        id: CURRENT_SPRINT_RECORD_ID,
      },
      include: {
        seoCluster: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (sprint) {
      return sprint;
    }

    const [legacySprintSetting, legacySprintClusterSetting] = await Promise.all(
      [
        this.findAppSettingValue(CURRENT_SPRINT_SETTING_KEY),
        this.findAppSettingValue(CURRENT_SPRINT_CLUSTER_SETTING_KEY),
      ],
    );

    const legacySprint = this.parseLegacyCurrentSprintValue(
      legacySprintSetting ?? '',
    );
    const legacyClusterId =
      legacySprintClusterSetting ||
      (await this.getLegacySprintClusterId());
    const startDateValue = legacySprint.startDate
      ? this.parseDateInput(legacySprint.startDate)
      : null;
    const durationDays = this.getSprintDurationDays(
      legacySprint.startDate,
      legacySprint.endDate,
    );

    if (!legacyClusterId && !startDateValue && durationDays === null) {
      return null;
    }

    await this.assertSprintClusterExists(legacyClusterId);

    const createdSprint = await (this.prisma as any).sprint.upsert({
      where: {
        id: CURRENT_SPRINT_RECORD_ID,
      },
      update: {
        clusterId: legacyClusterId,
        blogArticleTargetCount: 0,
        startDate: startDateValue,
        durationDays,
      },
      create: {
        id: CURRENT_SPRINT_RECORD_ID,
        clusterId: legacyClusterId,
        blogArticleTargetCount: 0,
        startDate: startDateValue,
        durationDays,
      },
      include: {
        seoCluster: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (legacyClusterId) {
      await this.syncSprintClusterFlag(legacyClusterId);
    }

    return createdSprint;
  }

  private async assertSprintClusterExists(clusterId: string | null) {
    if (!clusterId) {
      return;
    }

    const cluster = await (this.prisma as any).seoCluster.findFirst({
      where: {
        id: clusterId,
        trashedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!cluster) {
      throw new Error(`SeoCluster ${clusterId} not found`);
    }
  }

  private async syncSprintClusterFlag(clusterId: string | null) {
    await (this.prisma as any).seoCluster.updateMany({
      where: {
        isSprintCluster: true,
      },
      data: {
        isSprintCluster: false,
      },
    });

    if (clusterId) {
      await (this.prisma as any).seoCluster.update({
        where: {
          id: clusterId,
        },
        data: {
          isSprintCluster: true,
        },
      });
    }

    await this.safeUpsertAppSetting(
      CURRENT_SPRINT_CLUSTER_SETTING_KEY,
      clusterId ?? '',
    );
  }

  private serializeSprint(sprint: {
    seocluster?: {
      id: string;
      name: string | null;
    } | null;
    cluster?: {
      id: string;
      name: string | null;
    } | null;
    clusterId: string | null;
    blogArticleTargetCount: number;
    startDate: Date | null;
    durationDays: number | null;
  }) {
    const startDate = sprint.startDate
      ? this.formatDateInput(sprint.startDate)
      : '';
    const endDate =
      sprint.startDate && sprint.durationDays
        ? this.formatDateInput(
            this.getSprintEndDate(sprint.startDate, sprint.durationDays),
          )
        : '';

    return {
      clusterId:
        sprint.seocluster?.id ?? sprint.cluster?.id ?? sprint.clusterId ?? null,
      clusterName: sprint.seocluster?.name ?? sprint.cluster?.name ?? null,
      blogArticleTargetCount: sprint.blogArticleTargetCount ?? 0,
      startDate,
      durationDays: sprint.durationDays ?? null,
      endDate,
      isInProgress: this.isSprintInProgress(
        sprint.startDate,
        sprint.durationDays,
      ),
    };
  }

  private parseLegacyCurrentSprintValue(value: string) {
    try {
      const parsed = JSON.parse(value) as {
        startDate?: string;
        endDate?: string;
      };

      return {
        startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
        endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
      };
    } catch {
      return {
        startDate: '',
        endDate: '',
      };
    }
  }

  private parseDateInput(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const date = new Date(`${normalized}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatDateInput(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private requireSupabaseUser(user: SupabaseAuthenticatedUser | null) {
    if (!user) {
      throw new UnauthorizedException('Supabase user is required.');
    }

    return user;
  }

  private getPreferredAuthorSettingKey(supabaseUserId: string) {
    return `${SUPABASE_USER_PREFERRED_AUTHOR_SETTING_KEY_PREFIX}.${supabaseUserId}`;
  }

  private getCurrentProjectSettingKey(supabaseUserId: string) {
    return `${SUPABASE_USER_CURRENT_PROJECT_SETTING_KEY_PREFIX}.${supabaseUserId}`;
  }

  private async findProjectForSupabaseUser(
    supabaseUserId: string,
    projectId: string,
  ) {
    return await (this.prisma as any).project.findFirst({
      where: {
        id: projectId,
        projectMembers: {
          some: {
            supabaseUserId,
          },
        },
      },
      include: {
        projectMembers: {
          where: {
            supabaseUserId,
          },
          select: {
            role: true,
          },
        },
        _count: {
          select: {
            projectMembers: true,
            blogArticles: true,
          },
        },
      },
    });
  }

  private serializeProjectSummary(project: any) {
    const currentUserRole = project.projectMembers?.[0]?.role ?? null;

    return {
      ...project,
      currentUserRole,
      canDelete: currentUserRole === 'admin',
      projectMembers: undefined,
    };
  }

  private getSprintEndDate(startDate: Date, durationDays: number) {
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + durationDays - 1);
    return endDate;
  }

  private isSprintInProgress(
    startDate: Date | null,
    durationDays: number | null,
  ) {
    if (!startDate || !durationDays) {
      return false;
    }

    const now = new Date();
    const endDate = this.getSprintEndDate(startDate, durationDays);

    return (
      startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime()
    );
  }

  private async getLegacySprintClusterId() {
    const cluster = await (this.prisma as any).seoCluster.findFirst({
      where: {
        trashedAt: null,
        isSprintCluster: true,
      },
      select: {
        id: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return cluster?.id ?? null;
  }

  private parseBusinessPositioningValue(value?: string) {
    if (!value) {
      return {
        websiteUrl: '',
        offering: '',
        differentiator: '',
        problemsSolved: '',
      };
    }

    try {
      const parsed = JSON.parse(value) as {
        websiteUrl?: string;
        offering?: string;
        differentiator?: string;
        problemsSolved?: string;
      };

      return {
        websiteUrl:
          typeof parsed.websiteUrl === 'string' ? parsed.websiteUrl.trim() : '',
        offering:
          typeof parsed.offering === 'string' ? parsed.offering.trim() : '',
        differentiator:
          typeof parsed.differentiator === 'string'
            ? parsed.differentiator.trim()
            : '',
        problemsSolved:
          typeof parsed.problemsSolved === 'string'
            ? parsed.problemsSolved.trim()
            : '',
      };
    } catch {
      return {
        websiteUrl: '',
        offering: '',
        differentiator: '',
        problemsSolved: '',
      };
    }
  }

  private parseKeywordDifficultyLevelsValue(value?: string | null) {
    if (!value) {
      return this.getDefaultKeywordDifficultyLevels();
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      if (!Array.isArray(parsed)) {
        return this.getDefaultKeywordDifficultyLevels();
      }

      return this.normalizeKeywordDifficultyLevels(
        parsed as Array<{
          label?: string;
          maxScore?: number;
        }>,
      );
    } catch {
      return this.getDefaultKeywordDifficultyLevels();
    }
  }

  private parseKeywordVolumeThresholdsValue(value?: string) {
    if (!value) {
      return this.getDefaultKeywordVolumeThresholds();
    }

    try {
      const parsed = JSON.parse(value) as {
        lowMax?: number;
        mediumMax?: number;
        highMin?: number;
      };

      return this.normalizeKeywordVolumeThresholds(parsed);
    } catch {
      return this.getDefaultKeywordVolumeThresholds();
    }
  }

  private parseKeywordListValue(value?: string) {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private normalizeKeywordDifficultyLevels(
    levels: Array<{
      label?: string;
      maxScore?: number;
    }>,
  ): KeywordDifficultyLevel[] {
    const normalizedLevels = levels
      .map((level) => ({
        label: typeof level.label === 'string' ? level.label.trim() : '',
        maxScore:
          typeof level.maxScore === 'number' && Number.isFinite(level.maxScore)
            ? Math.max(0, Math.min(100, Math.round(level.maxScore)))
            : null,
      }))
      .filter(
        (
          level,
        ): level is {
          label: string;
          maxScore: number;
        } => Boolean(level.label) && level.maxScore !== null,
      )
      .sort((left, right) => left.maxScore - right.maxScore);

    if (!normalizedLevels.length) {
      return this.getDefaultKeywordDifficultyLevels();
    }

    let previousMaxScore = -1;

    return normalizedLevels.map((level, index) => {
      const nextMinScore = Math.max(previousMaxScore + 1, level.maxScore);
      previousMaxScore = nextMinScore;

      return {
        label: level.label,
        maxScore:
          index === normalizedLevels.length - 1
            ? 100
            : Math.min(nextMinScore, 99),
      };
    });
  }

  private getDefaultKeywordDifficultyLevels(): KeywordDifficultyLevel[] {
    return DEFAULT_KEYWORD_DIFFICULTY_LEVELS.map((level) => ({
      label: level.label,
      maxScore: level.maxScore,
    }));
  }

  private normalizeKeywordVolumeThresholds(input: {
    lowMax?: number;
    mediumMax?: number;
    highMin?: number;
  }) {
    const rawLowMax =
      typeof input.lowMax === 'number' && Number.isFinite(input.lowMax)
        ? Math.max(0, Math.round(input.lowMax))
        : DEFAULT_KEYWORD_VOLUME_THRESHOLDS.lowMax;
    const rawMediumMax =
      typeof input.mediumMax === 'number' && Number.isFinite(input.mediumMax)
        ? Math.max(rawLowMax + 1, Math.round(input.mediumMax))
        : DEFAULT_KEYWORD_VOLUME_THRESHOLDS.mediumMax;
    const rawHighMin =
      typeof input.highMin === 'number' && Number.isFinite(input.highMin)
        ? Math.max(rawMediumMax + 1, Math.round(input.highMin))
        : Math.max(DEFAULT_KEYWORD_VOLUME_THRESHOLDS.highMin, rawMediumMax + 1);

    return {
      lowMax: rawLowMax,
      mediumMax: rawMediumMax,
      highMin: rawHighMin,
    };
  }

  private getDefaultKeywordVolumeThresholds(): KeywordVolumeThresholdsSettings {
    return {
      lowMax: DEFAULT_KEYWORD_VOLUME_THRESHOLDS.lowMax,
      mediumMax: DEFAULT_KEYWORD_VOLUME_THRESHOLDS.mediumMax,
      highMin: DEFAULT_KEYWORD_VOLUME_THRESHOLDS.highMin,
    };
  }

  private isBusinessPositioningComplete(value: {
    websiteUrl?: string;
    offering: string;
    differentiator: string;
    problemsSolved: string;
  }) {
    return Boolean(
      value.offering.trim() &&
      value.differentiator.trim() &&
      value.problemsSolved.trim(),
    );
  }

  private async extractBusinessPositioningKeywords(value: {
    offering: string;
    differentiator: string;
    problemsSolved: string;
  }) {
    if (!this.isBusinessPositioningComplete(value)) {
      throw new Error(
        'Le positionnement business doit être complet avant extraction.',
      );
    }

    if (!this.openAiPlatformService.isConfigured()) {
      throw new Error('OpenAI n’est pas configuré.');
    }

    try {
      const { input, instructions, model, maxOutputTokens } =
        await this.promptConfigsService.getBusinessPositioningKeywordExtractionPrompt();
      const response = await this.openAiPlatformService.createResponse({
        model:
          model ||
          process.env.OPENAI_KEYWORD_ANALYSIS_MODEL ||
          DEFAULT_BUSINESS_POSITIONING_KEYWORD_EXTRACTION_AI_MODEL,
        promptType: 'BUSINESS_POSITIONING_KEYWORD_EXTRACTION',
        instructions,
        input: this.buildBusinessPositioningKeywordExtractionPrompt(
          input,
          value,
        ),
        text: {
          format: {
            type: 'json_schema',
            name: 'business_positioning_keyword_extraction_response',
            strict: true,
            schema: BUSINESS_POSITIONING_KEYWORD_EXTRACTION_OPENAI_JSON_SCHEMA,
          },
        },
        max_output_tokens: maxOutputTokens,
      });
      const parsed = parseStructuredOpenAiResponse(
        response,
        businessPositioningKeywordExtractionResponseSchema,
      );

      if (!parsed.keywords.length) {
        throw new Error(
          'OpenAI a renvoyé une liste vide pour l’extraction du positionnement business.',
        );
      }

      return parsed.keywords;
    } catch (error) {
      throw error;
    }
  }

  private async replaceBusinessPositioningKeywords(
    keywords: string[],
    client?: any,
  ) {
    const deduplicatedKeywords = Array.from(
      new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)),
    );

    const prismaClient = client ?? this.prisma;

    const existingBusinessPositioningKeywords =
      await this.keywordService.listKeywords(
        {
          source: KeywordSource.BUSINESS_POSITIONING,
        },
        prismaClient,
      );

    await this.keywordService.deleteKeywords(
      existingBusinessPositioningKeywords.map(
        (keyword: { id: string }) => keyword.id,
      ),
      prismaClient,
    );

    const businessPositioningKeywords = await Promise.all(
      deduplicatedKeywords.map((keyword) =>
        this.keywordService.findExistingOrCreateKeyword(
          {
            keyword,
            source: KeywordSource.BUSINESS_POSITIONING,
          },
          prismaClient,
        ),
      ),
    );

    return businessPositioningKeywords.map(({ keyword }) => keyword);
  }

  private buildBusinessPositioningKeywordExtractionPrompt(
    promptTemplate: string,
    value: {
      offering: string;
      differentiator: string;
      problemsSolved: string;
    },
  ) {
    return promptTemplate
      .replaceAll('{{offering}}', value.offering)
      .replaceAll('{{differentiator}}', value.differentiator)
      .replaceAll('{{problemsSolved}}', value.problemsSolved);
  }

  private async fetchWebsiteContext(websiteUrl: string) {
    try {
      const response = await fetch(websiteUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; BlogMagifyBot/1.0)',
        },
      });
      const html = await response.text();
      const title = extractHtmlTag(html, 'title');
      const description = extractMetaDescription(html);
      const content = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);

      return {
        title,
        description,
        content,
      };
    } catch {
      return {
        title: '',
        description: '',
        content: '',
      };
    }
  }

  private buildBusinessPositioningPrefillFallback(
    websiteUrl: string,
    websiteContext: {
      title: string;
      description: string;
      content: string;
    },
  ) {
    const hostname = extractHostname(websiteUrl);
    const title = websiteContext.title || hostname;
    const description = websiteContext.description || websiteContext.content;

    return {
      websiteUrl,
      offering: title
        ? `Le site semble proposer ${title.toLowerCase()}.`
        : 'Décrivez précisément ce que vous vendez.',
      differentiator: description
        ? `Le site met surtout en avant: ${description.slice(0, 180)}`
        : 'Décrivez ce que vous faites mieux ou différemment que vos concurrents.',
      problemsSolved: description
        ? `Le site semble répondre à ces besoins: ${description.slice(0, 180)}`
        : 'Décrivez les problèmes clients que vous résolvez.',
    };
  }

  private maskClientId(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 'Non configuré';
    }

    if (trimmedValue.length <= 18) {
      return trimmedValue;
    }

    return `${trimmedValue.slice(0, 12)}...${trimmedValue.slice(-20)}`;
  }

  private maskAccountValue(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 'Non configuré';
    }

    const [localPart, domainPart] = trimmedValue.split('@');

    if (!domainPart) {
      return trimmedValue.length > 6
        ? `${trimmedValue.slice(0, 3)}***${trimmedValue.slice(-2)}`
        : trimmedValue;
    }

    const visibleLocalPart =
      localPart.length > 3
        ? `${localPart.slice(0, 3)}***`
        : `${localPart.slice(0, 1)}***`;

    return `${visibleLocalPart}@${domainPart}`;
  }

  private getDiscordBotLabel(token: string) {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return 'Non configuré';
    }

    const [botIdSegment] = trimmedToken.split('.');

    if (!botIdSegment) {
      return 'Bot configuré';
    }

    try {
      const normalizedSegment = botIdSegment
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const paddedSegment = normalizedSegment.padEnd(
        Math.ceil(normalizedSegment.length / 4) * 4,
        '=',
      );
      const decodedBotId = Buffer.from(paddedSegment, 'base64').toString(
        'utf8',
      );

      return decodedBotId ? `Bot ID ${decodedBotId}` : 'Bot configuré';
    } catch {
      return 'Bot configuré';
    }
  }

  private getDatabaseLabel(databaseUrl: string) {
    const trimmedUrl = databaseUrl.trim();

    if (!trimmedUrl) {
      return 'Non configuré';
    }

    if (trimmedUrl.startsWith('file:')) {
      return 'SQLite';
    }

    try {
      const url = new URL(trimmedUrl);
      const protocol = url.protocol.replace(':', '');

      if (protocol === 'postgresql' || protocol === 'postgres') {
        return 'PostgreSQL';
      }

      if (protocol === 'mysql') {
        return 'MySQL';
      }

      if (protocol === 'sqlserver') {
        return 'SQL Server';
      }

      return protocol.toUpperCase();
    } catch {
      return 'Database configurée';
    }
  }

  private getDatabaseDetail(databaseUrl: string) {
    const trimmedUrl = databaseUrl.trim();

    if (!trimmedUrl) {
      return 'Aucune base configurée';
    }

    if (trimmedUrl.startsWith('file:')) {
      return trimmedUrl;
    }

    try {
      const url = new URL(trimmedUrl);
      const host = url.host || 'host inconnu';
      const databaseName =
        url.pathname.replace(/^\//, '') || 'database inconnue';

      return `${host} / ${databaseName}`;
    } catch {
      return 'Base configurée';
    }
  }

  private getOpenAiAccountLabel(
    organization: string,
    project: string,
    apiKey: string,
  ) {
    const trimmedOrganization = organization.trim();
    const trimmedProject = project.trim();

    if (trimmedProject) {
      return `Projet ${trimmedProject}`;
    }

    if (trimmedOrganization) {
      return `Organisation ${trimmedOrganization}`;
    }

    if (apiKey.trim()) {
      return 'Clé API configurée';
    }

    return 'Non configuré';
  }

  private async getGoogleOauthConnectionStatus() {
    try {
      const account = await this.googleAuthService.getCurrentOauthAccount();
      const { profileName, profileEmail, audience, scopes, scopePreview } =
        this.getGoogleOauthDisplayValues(account);
      const detailParts = [
        profileName ? `Nom: ${profileName}` : '',
        profileEmail ? `Email: ${profileEmail}` : '',
        audience ? `Audience: ${this.maskClientId(audience)}` : '',
        scopePreview ? `Scopes: ${scopePreview}` : '',
        scopes.length > 2 ? `+${scopes.length - 2} scopes` : '',
        'Access token valide',
        !account.profile && account.hasIdentityScopes
          ? 'Profil indisponible pour ce token'
          : '',
        !account.profile && !account.hasIdentityScopes
          ? 'Réauthentification Google requise pour récupérer le profil'
          : '',
      ].filter(Boolean);

      return {
        configured: true,
        accountLabel:
          profileEmail ||
          profileName ||
          (audience ? this.maskClientId(audience) : 'Client Google connecté'),
        detail: detailParts.join(' • '),
        error: null,
        authUrl: null,
        profile: account.profile,
      };
    } catch (error) {
      return {
        configured: false,
        accountLabel: 'Non configuré',
        detail: 'Impossible de générer un access token Google',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Échec de validation du refresh token Google',
        authUrl: this.googleAuthService.getOauthAuthPageUrl(),
        profile: null,
      };
    }
  }

  private getGoogleOauthDisplayValues(account: {
    profile?: {
      name?: string | null;
      email?: string | null;
    } | null;
    tokenInfo: {
      audience?: string | null;
      scopes?: string[] | null;
    };
  }) {
    const scopes = account.tokenInfo.scopes ?? [];

    return {
      profileName: account.profile?.name?.trim() || '',
      profileEmail: account.profile?.email?.trim() || '',
      audience: account.tokenInfo.audience?.trim() || '',
      scopes,
      scopePreview: scopes.slice(0, 2).join(', '),
    };
  }

  private async getGoogleGmailConnectionStatus() {
    try {
      const account = await this.gmailMailService.getProfile();

      const email = account.email?.trim() || '';
      const detailParts = [
        email ? `Email: ${email}` : '',
        account.messagesTotal !== null
          ? `Messages: ${account.messagesTotal}`
          : '',
        account.threadsTotal !== null ? `Threads: ${account.threadsTotal}` : '',
        'Access token valide',
      ].filter(Boolean);

      return {
        configured: true,
        accountLabel: email || 'Compte Gmail connecté',
        detail: detailParts.join(' • '),
        error: null,
        authUrl: null,
        profile: {
          id: email || null,
          name: email || 'Compte Gmail',
          email: email || null,
          verifiedEmail: true,
          picture: null,
        },
      };
    } catch (error) {
      return {
        configured: false,
        accountLabel: 'Non configuré',
        detail: 'Impossible de générer un access token Gmail',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Échec de validation du refresh token Gmail',
        authUrl: this.googleAuthService.getOauthAuthPageUrl(),
        profile: null,
      };
    }
  }

  private async getDiscordBotConnectionStatus() {
    try {
      const profile = await this.discordBotService.getCurrentBotProfile();

      return {
        configured: true,
        accountLabel: profile.displayName || profile.username,
        detail: `Bot ID ${profile.id} • Token valide`,
        error: null,
        authUrl: null,
        profile: {
          id: profile.id,
          name: profile.displayName || profile.username,
          email: null,
          verifiedEmail: true,
          picture: profile.avatarUrl,
        },
      };
    } catch (error) {
      return {
        configured: false,
        accountLabel: 'Non configuré',
        detail: 'Impossible de récupérer le profil du bot Discord',
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Échec de validation du token Discord',
        authUrl: null,
        profile: null,
      };
    }
  }

  private async getShopifyConnectionStatus() {
    const status = this.shopifyAuthService.getStatus();

    if (!status.configured) {
      return {
        configured: false,
        accountLabel: 'Shopify non configuré',
        detail: `API ${status.apiVersion}`,
        error: null,
        authUrl: null,
        profile: null,
      };
    }

    return {
      configured: true,
      accountLabel: 'Shopify connecté',
      detail: `API ${status.apiVersion}`,
      error: null,
      authUrl: null,
      profile: null,
    };
  }

  private async getDatabaseConnectionStatus(databaseUrl: string) {
    if (!databaseUrl.trim()) {
      return {
        configured: false,
        detail: 'Aucune base configurée',
        error: null,
      };
    }

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        configured: true,
        detail: this.getDatabaseDetail(databaseUrl),
        error: null,
      };
    } catch (error) {
      return {
        configured: false,
        detail: this.getDatabaseDetail(databaseUrl),
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Test SQL échoué',
      };
    }
  }

  private getSprintDurationDays(startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      return null;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) {
      return null;
    }

    return Math.floor(diffMs / 8640000) + 1;
  }

  private normalizeOpenAiPromptTypeFilter(
    value?: string | null,
  ): OpenAiPromptType | null {
    const normalizedValue = value?.trim();

    if (!normalizedValue || normalizedValue === 'ALL') {
      return null;
    }

    return normalizedValue in OPENAI_PROMPT_TYPE_LABELS
      ? (normalizedValue as OpenAiPromptType)
      : null;
  }

  private serializeOpenAiCacheEntry(entry: {
    id: string;
    endpoint: string;
    model?: string | null;
    promptType?: string | null;
    cacheKey: string;
    requestPayload: string;
    responseBody: string;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date;
    expiresAt?: Date | null;
  }) {
    const parsedRequestPayload = this.safeJsonParse(entry.requestPayload);
    const requestBody =
      parsedRequestPayload && typeof parsedRequestPayload === 'object'
        ? ((parsedRequestPayload as Record<string, unknown>).body as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const parsedResponseBody = this.safeJsonParse(entry.responseBody);
    const output = this.serializeOpenAiCacheOutput(parsedResponseBody);

    return {
      id: entry.id,
      endpoint: entry.endpoint,
      model: entry.model ?? null,
      promptType:
        this.normalizeOpenAiPromptTypeFilter(entry.promptType) ?? 'OTHER',
      promptTypeLabel:
        OPENAI_PROMPT_TYPE_LABELS[
          this.normalizeOpenAiPromptTypeFilter(entry.promptType) ?? 'OTHER'
        ],
      cacheKey: entry.cacheKey,
      input: this.prettySerializeValue(requestBody?.input),
      instructions:
        typeof requestBody?.instructions === 'string'
          ? requestBody.instructions.trim()
          : '',
      output,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      lastUsedAt: entry.lastUsedAt.toISOString(),
      expiresAt: entry.expiresAt?.toISOString() ?? null,
    };
  }

  private serializeOpenAiCacheOutput(responseBody: unknown) {
    const outputText =
      responseBody && typeof responseBody === 'object'
        ? extractOpenAiText(
            responseBody as {
              output_parsed?: unknown;
              output_text?: string;
              output?: unknown[];
            },
          )
        : '';
    const parsedCandidate = this.safeJsonParse(outputText);

    if (parsedCandidate !== null) {
      return {
        format: 'json' as const,
        content: JSON.stringify(parsedCandidate, null, 2),
      };
    }

    if (outputText.trim()) {
      return {
        format: 'text' as const,
        content: outputText.trim(),
      };
    }

    return {
      format: 'text' as const,
      content: '',
    };
  }

  private prettySerializeValue(value: unknown) {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const parsed = this.safeJsonParse(trimmed);

      return parsed !== null ? JSON.stringify(parsed, null, 2) : trimmed;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private safeJsonParse(value: unknown) {
    if (typeof value !== 'string') {
      return value ?? null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
}
