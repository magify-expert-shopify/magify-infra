import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleBusinessKpisService } from './google-business-kpis.service';
import { GoogleSeoKpisService } from './google-seo-kpis.service';
import {
  OPENAI_PROMPT_TYPE_LABELS,
  OPENAI_PROMPT_TYPES,
} from '../openai-platform/openai-prompt-types.constants';
import { OpenAiPromptType, SeoKpiRange } from 'src/common/types';

@Injectable()
export class StatsService {
  private readonly currentGoalClusterId = 'cmpbexpq900005sukmflma13j';
  private readonly currentGoalTarget = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly googleSeoKpisService: GoogleSeoKpisService,
    private readonly googleBusinessKpisService: GoogleBusinessKpisService,
  ) {}

  async getCounts() {
    const [agencySites, blogs, blogArticles, authors] = await Promise.all([
      (this.prisma as any).competitorAgencySite.count({
        where: { trashedAt: null },
      }),
      (this.prisma as any).blog.count({
        where: { trashedAt: null },
      }),
      (this.prisma as any).blogArticle.count({
        where: { trashedAt: null },
      }),
      (this.prisma as any).author.count({
        where: { trashedAt: null },
      }),
    ]);

    return {
      agencySites,
      blogs,
      blogArticles,
      authors,
    };
  }

  async getSeoKpis(range?: string) {
    const siteUrl =
      this.configService.get<string>('GOOGLE_SEARCH_CONSOLE_SITE_URL') ?? '';
    const ga4PropertyId =
      this.configService.get<string>('GOOGLE_ANALYTICS_PROPERTY_ID') ?? '';
    const accessToken =
      this.configService.get<string>('GOOGLE_OAUTH_ACCESS_TOKEN') ?? '';
    const refreshToken =
      this.configService.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN') ?? '';
    const articlePathPrefix =
      this.configService.get<string>('GOOGLE_SEO_ARTICLE_PATH_PREFIX') ??
      '/blog';
    const normalizedRange = this.normalizeSeoKpiRange(range);

    if (!siteUrl || (!accessToken && !refreshToken)) {
      return {
        configured: false,
        range: normalizedRange,
        totalClicks: 0,
        organicVisitors: null,
        googleClicks: 0,
        impressions: 0,
        ctr: 0,
        averagePosition: 0,
        articlesAnalyzed: 0,
        indexedPages: null,
      };
    }

    const { startDate, endDate } =
      this.getDateRangeFromSeoKpiRange(normalizedRange);

    return this.googleSeoKpisService.getSeoKpis({
      siteUrl,
      range: normalizedRange,
      ga4PropertyId: ga4PropertyId || undefined,
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
      articlePathPrefix,
      startDate: this.toIsoDate(startDate),
      endDate: this.toIsoDate(endDate),
    });
  }

  async getBusinessKpis() {
    const ga4PropertyId =
      this.configService.get<string>('GOOGLE_ANALYTICS_PROPERTY_ID') ?? '';
    const accessToken =
      this.configService.get<string>('GOOGLE_OAUTH_ACCESS_TOKEN') ?? '';
    const refreshToken =
      this.configService.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN') ?? '';
    const leadEventName =
      this.configService.get<string>('GOOGLE_BUSINESS_LEAD_EVENT_NAME') ??
      'generate_lead';
    const formSubmitEventName =
      this.configService.get<string>(
        'GOOGLE_BUSINESS_FORM_SUBMIT_EVENT_NAME',
      ) ?? 'form_submit';
    const articlePathPrefix =
      this.configService.get<string>('GOOGLE_BUSINESS_ARTICLE_PATH_PREFIX') ??
      '/blog';

    if (!ga4PropertyId || (!accessToken && !refreshToken)) {
      return {
        configured: false,
        sosDevLeadsGenerated: null,
        formsSubmitted: null,
        convertingPages: null,
        articlesGeneratingRequests: null,
      };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 27);

    return this.googleBusinessKpisService.getBusinessKpis({
      ga4PropertyId,
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
      leadEventName,
      formSubmitEventName,
      articlePathPrefix,
      startDate: this.toIsoDate(startDate),
      endDate: this.toIsoDate(endDate),
    });
  }

  async getCurrentGoalProgress() {
    const cluster = await (this.prisma as any).seoCluster.findFirst({
      where: {
        id: this.currentGoalClusterId,
        trashedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const articleCount = cluster
      ? await (this.prisma as any).blogArticle.count({
          where: {
            trashedAt: null,
            clusterId: this.currentGoalClusterId,
          },
        })
      : 0;

    return {
      clusterId: this.currentGoalClusterId,
      goalLabel: cluster
        ? `Mettre en place le cluster ${cluster.name}`
        : 'Mettre en place le cluster Performance Shopify',
      current: articleCount,
      target: this.currentGoalTarget,
      progressPercentage:
        this.currentGoalTarget > 0
          ? Math.min(
              100,
              Math.round((articleCount / this.currentGoalTarget) * 100),
            )
          : 0,
    };
  }

  async getOpenAiUsage(range?: string) {
    const normalizedRange = this.normalizeOpenAiUsageRange(range);
    const { startDate, endDate } =
      this.getDateRangeFromOpenAiUsageRange(normalizedRange);
    const openAiCacheEntries = await (this.prisma as any).openAiCache.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        model: true,
        promptType: true,
        requestPayload: true,
        responseBody: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const dailyMap = new Map<
      string,
      {
        date: string;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalTokens: number;
        promptTypes: Map<
          OpenAiPromptType,
          {
            type: OpenAiPromptType;
            label: string;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            calls: number;
          }
        >;
      }
    >();
    const promptTypeTotals = new Map<
      OpenAiPromptType,
      {
        type: OpenAiPromptType;
        label: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        calls: number;
      }
    >();
    const entries: Array<{
      id: string;
      createdAt: Date;
      model: string;
      promptType: OpenAiPromptType;
      label: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    }> = [];

    for (const entry of openAiCacheEntries) {
      const usage = this.parseOpenAiUsage(entry.responseBody);

      if (!usage) {
        continue;
      }

      const promptType = this.normalizeOpenAiPromptType(entry.promptType);
      const promptTypeLabel =
        OPENAI_PROMPT_TYPE_LABELS[promptType] ??
        OPENAI_PROMPT_TYPE_LABELS.OTHER;
      const model = this.normalizeOpenAiModel(
        entry.model ?? this.parseOpenAiRequestModel(entry.requestPayload),
      );
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
      const date = new Date(entry.createdAt).toISOString().slice(0, 10);

      entries.push({
        id: entry.cacheKey,
        createdAt: entry.createdAt,
        model,
        promptType,
        label: promptTypeLabel,
        inputTokens,
        outputTokens,
        totalTokens,
      });

      const totalBucket = promptTypeTotals.get(promptType) ?? {
        type: promptType,
        label: promptTypeLabel,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        calls: 0,
      };

      totalBucket.inputTokens += inputTokens;
      totalBucket.outputTokens += outputTokens;
      totalBucket.totalTokens += totalTokens;
      totalBucket.calls += 1;
      promptTypeTotals.set(promptType, totalBucket);

      const dayBucket = dailyMap.get(date) ?? {
        date,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        promptTypes: new Map(),
      };

      dayBucket.totalInputTokens += inputTokens;
      dayBucket.totalOutputTokens += outputTokens;
      dayBucket.totalTokens += totalTokens;

      const dayPromptBucket = dayBucket.promptTypes.get(promptType) ?? {
        type: promptType,
        label: promptTypeLabel,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        calls: 0,
      };

      dayPromptBucket.inputTokens += inputTokens;
      dayPromptBucket.outputTokens += outputTokens;
      dayPromptBucket.totalTokens += totalTokens;
      dayPromptBucket.calls += 1;

      dayBucket.promptTypes.set(promptType, dayPromptBucket);
      dailyMap.set(date, dayBucket);
    }

    for (const promptType of OPENAI_PROMPT_TYPES) {
      if (!promptTypeTotals.has(promptType)) {
        promptTypeTotals.set(promptType, {
          type: promptType,
          label:
            OPENAI_PROMPT_TYPE_LABELS[promptType] ??
            OPENAI_PROMPT_TYPE_LABELS.OTHER,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          calls: 0,
        });
      }
    }

    return {
      configured: true,
      range: normalizedRange,
      totals: {
        inputTokens: Array.from(promptTypeTotals.values()).reduce(
          (sum, item) => sum + item.inputTokens,
          0,
        ),
        outputTokens: Array.from(promptTypeTotals.values()).reduce(
          (sum, item) => sum + item.outputTokens,
          0,
        ),
        totalTokens: Array.from(promptTypeTotals.values()).reduce(
          (sum, item) => sum + item.totalTokens,
          0,
        ),
        calls: Array.from(promptTypeTotals.values()).reduce(
          (sum, item) => sum + item.calls,
          0,
        ),
      },
      promptTypes: Array.from(promptTypeTotals.values()).sort(
        (left, right) =>
          right.totalTokens - left.totalTokens ||
          left.label.localeCompare(right.label, 'fr'),
      ),
      daily: Array.from(dailyMap.values())
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((entry) => ({
          date: entry.date,
          totalInputTokens: entry.totalInputTokens,
          totalOutputTokens: entry.totalOutputTokens,
          totalTokens: entry.totalTokens,
          promptTypes: OPENAI_PROMPT_TYPES.map((promptType) => {
            return (
              entry.promptTypes.get(promptType) ?? {
                type: promptType,
                label:
                  OPENAI_PROMPT_TYPE_LABELS[promptType] ??
                  OPENAI_PROMPT_TYPE_LABELS.OTHER,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                calls: 0,
              }
            );
          }).sort(
            (left, right) =>
              right.totalTokens - left.totalTokens ||
              left.label.localeCompare(right.label, 'fr'),
          ),
        })),
      entries: entries.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    };
  }

  private toIsoDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private normalizeSeoKpiRange(range?: string): SeoKpiRange {
    switch (range) {
      case '7d':
      case '28d':
      case '3m':
      case '6m':
      case '12m':
        return range;
      default:
        return '28d';
    }
  }

  private normalizeOpenAiUsageRange(range?: string) {
    switch (range) {
      case '7d':
      case '30d':
      case '90d':
      case '180d':
        return range;
      default:
        return '30d';
    }
  }

  private getDateRangeFromOpenAiUsageRange(range: string) {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 6);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 29);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 89);
        break;
      case '180d':
        startDate.setDate(endDate.getDate() - 179);
        break;
    }

    return { startDate, endDate };
  }

  private parseOpenAiUsage(responseBody: string) {
    try {
      const parsed = JSON.parse(responseBody) as {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
        };
      };

      if (!parsed?.usage) {
        return null;
      }

      return parsed.usage;
    } catch {
      return null;
    }
  }

  private parseOpenAiRequestModel(requestPayload: string) {
    try {
      const parsed = JSON.parse(requestPayload) as {
        body?: {
          model?: string;
        };
        model?: string;
      };

      return parsed?.body?.model ?? parsed?.model ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private normalizeOpenAiModel(value: string | null | undefined) {
    const normalized = value?.trim();

    return normalized && normalized.length > 0 ? normalized : 'unknown';
  }

  private normalizeOpenAiPromptType(
    value: OpenAiPromptType | string | null | undefined,
  ): OpenAiPromptType {
    if (
      value === 'KEYWORD_ANALYSIS' ||
      value === 'KEYWORD_ANALYSIS_MINI_SCAN' ||
      value === 'KEYWORD_GROUPING' ||
      value === 'BUSINESS_POSITIONING_PREFILL' ||
      value === 'BUSINESS_POSITIONING_KEYWORD_EXTRACTION' ||
      value === 'CUSTOMER_PROBLEM_KEYWORD_EXTRACTION' ||
      value === 'BLOG_ARTICLE_CLUSTER_SUGGESTION' ||
      value === 'BLOG_ARTICLE_FROM_SUGGESTION' ||
      value === 'BLOG_ARTICLE_PLAN_FROM_SUGGESTION' ||
      value === 'BLOG_ARTICLE_SECONDARY_KEYWORDS_SUGGESTION' ||
      value === 'SEO_CLUSTER_SUGGESTION' ||
      value === 'KEYWORD_GROUP_TEMPLATE' ||
      value === 'KEYWORD_GROUP_DEDUPLICATION' ||
      value === 'OTHER'
    ) {
      return value;
    }

    return 'OTHER';
  }

  private getDateRangeFromSeoKpiRange(range: SeoKpiRange) {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 6);
        break;
      case '28d':
        startDate.setDate(endDate.getDate() - 27);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        startDate.setDate(startDate.getDate() + 1);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        startDate.setDate(startDate.getDate() + 1);
        break;
      case '12m':
        startDate.setFullYear(endDate.getFullYear() - 1);
        startDate.setDate(startDate.getDate() + 1);
        break;
    }

    return { startDate, endDate };
  }
}
