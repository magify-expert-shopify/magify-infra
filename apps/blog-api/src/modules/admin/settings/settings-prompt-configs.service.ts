import { Injectable } from '@nestjs/common';
import {
  PROMPT_CONFIG_DEFAULTS,
  type PromptConfigKey,
} from './settings-prompt-configs.constants';
import {
  BUSINESS_POSITIONING_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
  BLOG_ARTICLE_FROM_SUGGESTION_PROMPT_CONFIG_KEY,
  BLOG_ARTICLE_PLAN_FROM_SUGGESTION_PROMPT_CONFIG_KEY,
  BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION_PROMPT_CONFIG_KEY,
  CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
  KEYWORD_ANALYSIS_PROMPT_CONFIG_KEY,
  KEYWORD_ANALYSIS_MINI_SCAN_PROMPT_CONFIG_KEY,
  KEYWORD_GROUP_DEDUPLICATION_PROMPT_CONFIG_KEY,
  KEYWORD_GROUP_TEMPLATE_PROMPT_CONFIG_KEY,
  KEYWORD_GROUPING_PROMPT_CONFIG_KEY,
  SEO_CLUSTER_SUGGESTION_PROMPT_CONFIG_KEY,
} from './settings.constants';
import type { PromptConfigSettings } from 'src/common/types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettingsPromptConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKeywordAnalysisPrompt() {
    return this.getPromptConfig(KEYWORD_ANALYSIS_PROMPT_CONFIG_KEY);
  }

  async getKeywordAnalysisMiniScanPrompt() {
    return this.getPromptConfig(KEYWORD_ANALYSIS_MINI_SCAN_PROMPT_CONFIG_KEY);
  }

  async getCustomerProblemKeywordExtractionPrompt() {
    return this.getPromptConfig(
      CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
    );
  }

  async getBusinessPositioningKeywordExtractionPrompt() {
    return this.getPromptConfig(
      BUSINESS_POSITIONING_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
    );
  }

  async getKeywordGroupingPrompt() {
    return this.getPromptConfig(KEYWORD_GROUPING_PROMPT_CONFIG_KEY);
  }

  async getKeywordGroupTemplatePrompt() {
    return this.getPromptConfig(KEYWORD_GROUP_TEMPLATE_PROMPT_CONFIG_KEY);
  }

  async getKeywordGroupDeduplicationPrompt() {
    return this.getPromptConfig(KEYWORD_GROUP_DEDUPLICATION_PROMPT_CONFIG_KEY);
  }

  async getSeoClusterSuggestionPrompt() {
    return this.getPromptConfig(SEO_CLUSTER_SUGGESTION_PROMPT_CONFIG_KEY);
  }

  async getBlogArticleFromSuggestionPrompt() {
    return this.getPromptConfig(BLOG_ARTICLE_FROM_SUGGESTION_PROMPT_CONFIG_KEY);
  }

  async getBlogArticlePlanFromSuggestionPrompt() {
    return this.getPromptConfig(
      BLOG_ARTICLE_PLAN_FROM_SUGGESTION_PROMPT_CONFIG_KEY,
    );
  }

  async getBlogArticleSecondaryKeywordsSuggestionPrompt() {
    return this.getPromptConfig(
      BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION_PROMPT_CONFIG_KEY,
    );
  }

  async updateKeywordAnalysisPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(KEYWORD_ANALYSIS_PROMPT_CONFIG_KEY, {
      input,
      instructions,
      model,
      maxOutputTokens,
    });
  }

  async updateKeywordAnalysisMiniScanPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      KEYWORD_ANALYSIS_MINI_SCAN_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateCustomerProblemKeywordExtractionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      CUSTOMER_PROBLEM_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateBusinessPositioningKeywordExtractionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      BUSINESS_POSITIONING_KEYWORD_EXTRACTION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateKeywordGroupingPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(KEYWORD_GROUPING_PROMPT_CONFIG_KEY, {
      input,
      instructions,
      model,
      maxOutputTokens,
    });
  }

  async updateKeywordGroupTemplatePrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(KEYWORD_GROUP_TEMPLATE_PROMPT_CONFIG_KEY, {
      input,
      instructions,
      model,
      maxOutputTokens,
    });
  }

  async updateKeywordGroupDeduplicationPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      KEYWORD_GROUP_DEDUPLICATION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateSeoClusterSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(SEO_CLUSTER_SUGGESTION_PROMPT_CONFIG_KEY, {
      input,
      instructions,
      model,
      maxOutputTokens,
    });
  }

  async updateBlogArticleFromSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      BLOG_ARTICLE_FROM_SUGGESTION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateBlogArticlePlanFromSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      BLOG_ARTICLE_PLAN_FROM_SUGGESTION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  async updateBlogArticleSecondaryKeywordsSuggestionPrompt(
    input: string,
    instructions: string,
    model: string,
    maxOutputTokens: number,
  ) {
    return this.updatePromptConfig(
      BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION_PROMPT_CONFIG_KEY,
      {
        input,
        instructions,
        model,
        maxOutputTokens,
      },
    );
  }

  private async getPromptConfig(
    key: PromptConfigKey,
  ): Promise<PromptConfigSettings> {
    const defaults = PROMPT_CONFIG_DEFAULTS[key];
    const legacyPromptKey =
      'legacyPromptKey' in defaults ? defaults.legacyPromptKey : undefined;
    const legacyModelKey =
      'legacyModelKey' in defaults ? defaults.legacyModelKey : undefined;
    const promptConfig = await (this.prisma as any).promptConfig.findUnique({
      where: {
        key: defaults.key,
      },
    });

    if (promptConfig) {
      return {
        key: defaults.key,
        model: promptConfig.model,
        instructions: promptConfig.instructions,
        input: promptConfig.inputTemplate,
        maxOutputTokens: this.parsePromptMaxOutputTokens(
          promptConfig.maxOutputTokens,
          defaults.maxOutputTokens,
        ),
      };
    }

    const legacyPromptSetting = legacyPromptKey
      ? await this.findAppSettingValue(legacyPromptKey)
      : null;
    const legacyModelSetting = legacyModelKey
      ? await this.findAppSettingValue(legacyModelKey)
      : null;

    return {
      key: defaults.key,
      model: legacyModelSetting || defaults.model,
      instructions: defaults.instructions,
      input: legacyPromptSetting || defaults.input,
      maxOutputTokens: defaults.maxOutputTokens,
    };
  }

  private async updatePromptConfig(
    key: PromptConfigKey,
    value: {
      input: string;
      instructions: string;
      model: string;
      maxOutputTokens: number;
    },
  ): Promise<PromptConfigSettings> {
    const defaults = PROMPT_CONFIG_DEFAULTS[key];
    const maxOutputTokens = this.normalizePromptMaxOutputTokens(
      value.maxOutputTokens,
      defaults.maxOutputTokens,
    );

    const promptConfig = await (this.prisma as any).promptConfig.upsert({
      where: {
        key: defaults.key,
      },
      create: {
        key: defaults.key,
        model: value.model.trim() || defaults.model,
        instructions: value.instructions.trim() || defaults.instructions,
        inputTemplate: value.input.trim() || defaults.input,
        maxOutputTokens,
      },
      update: {
        model: value.model.trim() || defaults.model,
        instructions: value.instructions.trim() || defaults.instructions,
        inputTemplate: value.input.trim() || defaults.input,
        maxOutputTokens,
      },
    });

    return {
      key: defaults.key,
      model: promptConfig.model,
      instructions: promptConfig.instructions,
      input: promptConfig.inputTemplate,
      maxOutputTokens: this.parsePromptMaxOutputTokens(
        promptConfig.maxOutputTokens,
        defaults.maxOutputTokens,
      ),
    };
  }

  private parsePromptMaxOutputTokens(
    value: number | string | null | undefined,
    fallback: number,
  ) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.normalizePromptMaxOutputTokens(value, fallback);
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value, 10);

      if (Number.isFinite(parsed)) {
        return this.normalizePromptMaxOutputTokens(parsed, fallback);
      }
    }

    return fallback;
  }

  private normalizePromptMaxOutputTokens(value: number, fallback: number) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(1, Math.round(value));
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
}
