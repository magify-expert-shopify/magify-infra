import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DataForSeoService } from './dataforseo.service';
import { OpenAiPlatformService } from '../openai-platform/openai-platform.service';
import { KeywordSource } from 'src/common/types/prisma-enums';
import type { DataForSeoSerpResultItem } from './dataforseo.types';
import type { KeywordMetrics, SerpResult } from './keyword-analysis.types';
import { toBaseUrl } from '../../common/utils/url.util';
import type { AnalyzeKeywordWithAiDto } from './dto/analyze-keyword-with-ai.dto';
import { KeywordService } from '../keywords/services/keyword.service';
import { UpsertKeywordDto } from './dto/upsert-keyword.dto';
import {
  extractOpenAiText,
  parseStructuredOpenAiResponse,
} from '../../common/utils/openai-response';
import {
  KEYWORD_ANALYSIS_ALLOWED_INTENTS,
  KEYWORD_ANALYSIS_FALLBACK_INTENT,
} from './keyword-analysis.constants';
import {
  KEYWORD_ANALYSIS_MINI_SCAN_OPENAI_JSON_SCHEMA,
  keywordAnalysisMiniScanResponseSchema,
} from './keyword-analysis.schemas';
import type { KnownAgencySiteMatch } from './keyword-analysis.service.types';
import { SettingsPromptConfigsService } from '../admin/settings/settings-prompt-configs.service';

@Injectable()
export class KeywordAnalysisService {
  constructor(
    private readonly dataForSeoService: DataForSeoService,
    private readonly prisma: PrismaService,
    private readonly openAiPlatformService: OpenAiPlatformService,
    private readonly keywordService: KeywordService,
    private readonly promptConfigsService: SettingsPromptConfigsService,
  ) {}

  async analyze(rawKeyword: string, forceRefresh = false) {
    const keyword = rawKeyword.trim();
    const [{ metrics }, serpResults] = await Promise.all([
      this.getKeywordOverviewAnalysis(keyword, forceRefresh),
      this.getTopResults(keyword, forceRefresh),
    ]);

    const miniScan = await this.getKeywordMiniScan({
      keyword,
      volume: metrics.volume,
      difficulty: metrics.difficulty,
      intent: metrics.intent,
      serpResults,
    });

    await this.saveAnalyzedKeyword(
      keyword,
      metrics.volume,
      metrics.difficulty,
      metrics.intent,
      miniScan,
    );

    return {
      keyword,
      volume: metrics.volume,
      difficulty: metrics.difficulty,
      intent: metrics.intent,
      monthlySearches: metrics.monthlySearches,
      serpResults,
      miniScan,
    };
  }

  async getStoredAnalysis(rawKeyword: string) {
    const keyword = rawKeyword.trim();

    if (!keyword) {
      return null;
    }

    const existingKeyword =
      await this.keywordService.findExistingKeyword(keyword);

    if (!existingKeyword?.lastScannedAt) {
      return null;
    }

    const [cachedOverviewResponse, cachedOrganicResponse] = await Promise.all([
      this.dataForSeoService.getCachedGoogleKeywordOverview(keyword),
      this.dataForSeoService.getCachedGoogleOrganicLive(keyword, {
        depth: 10,
      }),
    ]);

    const overviewItem =
      cachedOverviewResponse?.tasks[0]?.result[0]?.items?.[0];
    const keywordInfo = overviewItem?.keyword_info;
    const intentInfo = overviewItem?.search_intent_info;
    const serpItems = (
      cachedOrganicResponse?.tasks[0]?.result[0]?.items ?? []
    ).filter((item) => item.type && item.type !== 'search_information');
    const serpResults = serpItems.length
      ? await this.mapSerpItemsToResults(serpItems)
      : [];
    const miniScan =
      existingKeyword.searchIntentDescription?.trim() ||
      (await this.getKeywordMiniScan({
        keyword: existingKeyword.keyword,
        volume: keywordInfo?.search_volume ?? existingKeyword.volume ?? 0,
        difficulty:
          this.normalizeDifficulty(keywordInfo?.competition) ??
          existingKeyword.difficulty ??
          0,
        intent: this.normalizeIntent(
          intentInfo?.main_intent ?? existingKeyword.searchIntent ?? undefined,
        ),
        serpResults,
      }));

    if (!existingKeyword.searchIntentDescription?.trim() && miniScan) {
      await this.saveAnalyzedKeyword(
        existingKeyword.keyword,
        keywordInfo?.search_volume ?? existingKeyword.volume ?? 0,
        this.normalizeDifficulty(keywordInfo?.competition) ??
          existingKeyword.difficulty ??
          0,
        this.normalizeIntent(
          intentInfo?.main_intent ?? existingKeyword.searchIntent ?? undefined,
        ),
        miniScan,
      );
    }

    return {
      keyword: existingKeyword.keyword,
      volume: keywordInfo?.search_volume ?? existingKeyword.volume ?? 0,
      difficulty:
        this.normalizeDifficulty(keywordInfo?.competition) ??
        existingKeyword.difficulty ??
        0,
      intent: this.normalizeIntent(
        intentInfo?.main_intent ?? existingKeyword.searchIntent ?? undefined,
      ),
      monthlySearches: (keywordInfo?.monthly_searches ?? [])
        .map((entry) => ({
          year: entry.year,
          month: entry.month,
          searchVolume: entry.search_volume,
        }))
        .sort((left, right) => {
          const leftValue = left.year * 100 + left.month;
          const rightValue = right.year * 100 + right.month;

          return leftValue - rightValue;
        })
        .slice(-12),
      serpResults,
      miniScan,
    };
  }

  async suggest(rawQuery: string, limit?: number) {
    const query = rawQuery.trim();
    const take =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(limit, 5000)
        : query
          ? 8
          : 5;

    const suggestions = await (this.prisma as any).keyword.findMany({
      where: query
        ? {
            keyword: {
              contains: query,
            },
          }
        : undefined,
      select: {
        id: true,
        keyword: true,
        isFavorite: true,
        volume: true,
        difficulty: true,
        searchIntent: true,
        lastScannedAt: true,
      },
      orderBy: query
        ? [{ volume: 'desc' }, { keyword: 'asc' }]
        : [{ updatedAt: 'desc' }],
      take,
    });

    return suggestions.map((suggestion: any) => ({
      id: suggestion.id,
      keyword: suggestion.keyword,
      isFavorite: suggestion.isFavorite ?? false,
      volume: suggestion.volume ?? null,
      difficulty: suggestion.difficulty ?? null,
      intent: suggestion.searchIntent,
      lastScannedAt: suggestion.lastScannedAt ?? null,
      source: suggestion.lastScannedAt ? 'history' : 'database',
    }));
  }

  async analyzeWithAi(payload: AnalyzeKeywordWithAiDto) {
    const { input, instructions, model, maxOutputTokens } =
      await this.promptConfigsService.getKeywordAnalysisPrompt();
    const response = await this.openAiPlatformService.createResponse({
      model:
        model || process.env.OPENAI_KEYWORD_ANALYSIS_MODEL || 'gpt-4.1-mini',
      promptType: 'KEYWORD_ANALYSIS',
      instructions,
      input: this.buildAiReviewPrompt(input, payload),
      max_output_tokens: maxOutputTokens,
    });

    return {
      keyword: payload.keyword,
      review:
        extractOpenAiText(response) ||
        this.extractAiText(response) ||
        'OpenAI n’a pas retourné de texte exploitable pour cette analyse.',
      responseId: response.id,
      usage: response.usage ?? null,
    };
  }

  async upsertKeyword(input: UpsertKeywordDto) {
    const result = await this.keywordService.findExistingOrCreateKeyword({
      keyword: input.keyword.trim(),
      source: KeywordSource.MANUAL,
      volume: this.normalizeNullableInteger(input.volume),
      difficulty: this.normalizeDifficultyValue(input.difficulty),
      searchIntent: this.normalizeOptionalIntent(input.searchIntent),
    });

    return result.keyword;
  }

  private async getKeywordOverviewAnalysis(
    keyword: string,
    forceRefresh = false,
  ): Promise<{
    metrics: KeywordMetrics;
    serpResults: SerpResult[] | null;
  }> {
    const response = await this.dataForSeoService.getGoogleKeywordOverview(
      keyword,
      {
        includeSerpInfo: true,
        forceRefresh,
      },
    );
    const overviewItem = response.tasks[0]?.result[0]?.items?.[0];
    const keywordInfo = overviewItem?.keyword_info;
    const intentInfo = overviewItem?.search_intent_info;
    const serpItems = (overviewItem?.serp_info?.items ?? []).filter(
      (item) => item.type && item.type !== 'search_information',
    );
    return {
      metrics: {
        volume: keywordInfo?.search_volume ?? 0,
        difficulty: this.normalizeDifficulty(keywordInfo?.competition),
        intent: this.normalizeIntent(intentInfo?.main_intent),
        monthlySearches: (keywordInfo?.monthly_searches ?? [])
          .map((entry) => ({
            year: entry.year,
            month: entry.month,
            searchVolume: entry.search_volume,
          }))
          .sort((left, right) => {
            const leftValue = left.year * 100 + left.month;
            const rightValue = right.year * 100 + right.month;

            return leftValue - rightValue;
          })
          .slice(-12),
      },
      serpResults: serpItems.length
        ? await this.mapSerpItemsToResults(serpItems)
        : null,
    };
  }

  private normalizeDifficulty(competition?: number) {
    if (typeof competition !== 'number' || Number.isNaN(competition)) {
      return 0;
    }

    return Math.round(competition * 100);
  }

  private normalizeNullableInteger(value?: number | null) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }

    const normalizedValue = Math.round(value);

    return normalizedValue >= 0 ? normalizedValue : null;
  }

  private normalizeDifficultyValue(value?: number | null) {
    const normalizedValue = this.normalizeNullableInteger(value);

    if (normalizedValue === null) {
      return null;
    }

    return Math.min(100, normalizedValue);
  }

  private normalizeIntent(intent?: string) {
    if (!intent) {
      return KEYWORD_ANALYSIS_FALLBACK_INTENT;
    }

    const normalized = intent.toUpperCase();

    if (
      (KEYWORD_ANALYSIS_ALLOWED_INTENTS as readonly string[]).includes(
        normalized,
      )
    ) {
      return normalized;
    }

    return KEYWORD_ANALYSIS_FALLBACK_INTENT;
  }

  private normalizeOptionalIntent(intent?: string | null) {
    if (!intent?.trim()) {
      return null;
    }

    const normalized = intent.trim().toUpperCase();

    if (
      (KEYWORD_ANALYSIS_ALLOWED_INTENTS as readonly string[]).includes(
        normalized,
      )
    ) {
      return normalized;
    }

    return null;
  }

  private buildAiReviewPrompt(
    promptTemplate: string,
    payload: AnalyzeKeywordWithAiDto,
  ) {
    const serpSummary = payload.serpResults
      .map((result) => {
        const parts = [
          `Position: ${result.position}`,
          `Type: ${result.type}`,
          `Titre: ${result.title}`,
        ];

        if (result.url) {
          parts.push(`URL: ${result.url}`);
        }

        if (result.snippet) {
          parts.push(`Snippet: ${result.snippet}`);
        }

        if (result.knownAgencySite?.name) {
          parts.push(`Site agence connu: ${result.knownAgencySite.name}`);
        }

        return parts.join('\n');
      })
      .join('\n\n');

    return promptTemplate
      .replaceAll('{{keyword}}', payload.keyword)
      .replaceAll('{{volume}}', String(payload.volume))
      .replaceAll('{{difficulty}}', String(payload.difficulty))
      .replaceAll('{{intent}}', payload.intent)
      .replaceAll(
        '{{serp_results}}',
        serpSummary || 'Aucun résultat SERP disponible.',
      );
  }

  private async getKeywordMiniScan(payload: {
    keyword: string;
    volume: number;
    difficulty: number;
    intent: string;
    serpResults: SerpResult[];
  }) {
    try {
      const { input, instructions, model, maxOutputTokens } =
        await this.promptConfigsService.getKeywordAnalysisMiniScanPrompt();
      const response = await this.openAiPlatformService.createResponse({
        model:
          model || process.env.OPENAI_KEYWORD_ANALYSIS_MODEL || 'gpt-4.1-mini',
        promptType: 'KEYWORD_ANALYSIS_MINI_SCAN',
        instructions,
        input: this.buildKeywordMiniScanPrompt(input, payload),
        max_output_tokens: maxOutputTokens,
        text: {
          format: {
            type: 'json_schema',
            name: 'keyword-analysis-mini-scan',
            strict: true,
            schema: KEYWORD_ANALYSIS_MINI_SCAN_OPENAI_JSON_SCHEMA,
          },
        },
      });

      const parsed = parseStructuredOpenAiResponse(
        response,
        keywordAnalysisMiniScanResponseSchema,
      );

      return parsed.pageIntent.trim();
    } catch (error) {
      console.error('[KeywordAnalysis] mini scan failed', error);
      return null;
    }
  }

  private buildKeywordMiniScanPrompt(
    promptTemplate: string,
    payload: {
      keyword: string;
      volume: number;
      difficulty: number;
      intent: string;
      serpResults: SerpResult[];
    },
  ) {
    const serpSummary = payload.serpResults
      .filter(
        (result) =>
          result.type === 'organic' &&
          !result.url.startsWith('https://www.shopify.com/'),
      )
      .slice(0, 6)
      .map((result) => {
        const parts = [
          `Position: ${result.position}`,
          `Titre: ${result.title}`,
        ];

        if (result.url) {
          parts.push(`URL: ${result.url}`);
        }

        return parts.join('\n');
      })
      .join('\n\n');

    return promptTemplate
      .replaceAll('{{keyword}}', payload.keyword)
      .replaceAll('{{volume}}', String(payload.volume))
      .replaceAll('{{difficulty}}', String(payload.difficulty))
      .replaceAll('{{intent}}', payload.intent)
      .replaceAll(
        '{{serp_results}}',
        serpSummary || 'Aucun résultat SERP disponible.',
      );
  }

  private extractAiText(response: {
    output_text?: string;
    output?: unknown[];
  }) {
    if (response.output_text?.trim()) {
      return response.output_text.trim();
    }

    const output = Array.isArray(response.output) ? response.output : [];

    for (const item of output) {
      const content = (item as { content?: unknown[] }).content;

      if (!Array.isArray(content)) {
        continue;
      }

      const text = content
        .map((part) => (part as { text?: string }).text)
        .filter((value): value is string => typeof value === 'string')
        .join('\n')
        .trim();

      if (text) {
        return text;
      }
    }

    return '';
  }

  private async getTopResults(
    keyword: string,
    forceRefresh = false,
  ): Promise<SerpResult[]> {
    const response = await this.dataForSeoService.getGoogleOrganicLive(
      keyword,
      {
        depth: 10,
        forceRefresh,
      },
    );
    const serpItems = (response.tasks[0]?.result[0]?.items ?? []).filter(
      (item) => item.type && item.type !== 'search_information',
    );

    return this.mapSerpItemsToResults(serpItems);
  }

  private async mapSerpItemsToResults(
    serpItems: DataForSeoSerpResultItem[],
  ): Promise<SerpResult[]> {
    const resultBaseUrls = Array.from(
      new Set(
        serpItems
          .map((item) => this.getResultBaseUrl(item.url))
          .filter((baseUrl): baseUrl is string => Boolean(baseUrl)),
      ),
    );
    const knownAgencySites: KnownAgencySiteMatch[] = resultBaseUrls.length
      ? await (this.prisma as any).competitorAgencySite.findMany({
          where: {
            trashedAt: null,
            baseUrl: {
              in: resultBaseUrls,
            },
          },
          select: {
            id: true,
            name: true,
            baseUrl: true,
          },
        })
      : [];
    const knownAgencySitesByBaseUrl = new Map<string, KnownAgencySiteMatch>(
      knownAgencySites.map((site) => [site.baseUrl, site]),
    );

    return serpItems.map((item, index) => ({
      position: item.rank_absolute ?? item.rank_group ?? index + 1,
      type: item.type ?? 'unknown',
      title: item.title ?? this.getFallbackSerpTitle(item.type, index),
      url: item.url ?? '',
      checkUrl: item.check_url ?? '',
      snippet: item.description ?? this.getFallbackSerpSnippet(item.type),
      knownAgencySite:
        knownAgencySitesByBaseUrl.get(this.getResultBaseUrl(item.url) ?? '') ??
        null,
    }));
  }

  private getResultBaseUrl(url?: string) {
    if (!url) {
      return null;
    }

    try {
      return toBaseUrl(url);
    } catch {
      return null;
    }
  }

  private getFallbackSerpTitle(type?: string, index?: number) {
    if (type === 'people_also_ask') {
      return 'Bloc "Autres questions posées"';
    }

    if (type === 'featured_snippet') {
      return 'Extrait optimisé Google';
    }

    if (type === 'local_pack') {
      return 'Pack local Google';
    }

    if (type === 'images') {
      return 'Bloc images';
    }

    if (type === 'video') {
      return 'Bloc vidéo';
    }

    return `Résultat ${typeof index === 'number' ? index + 1 : ''}`.trim();
  }

  private getFallbackSerpSnippet(type?: string) {
    if (type === 'people_also_ask') {
      return 'Google affiche ici des questions complémentaires liées à la requête.';
    }

    if (type === 'featured_snippet') {
      return 'Google met en avant une réponse directe dans la SERP.';
    }

    if (type === 'local_pack') {
      return 'Bloc local avec établissements ou résultats géolocalisés.';
    }

    if (type === 'images') {
      return 'Bloc visuel affiché directement dans la page de résultats.';
    }

    if (type === 'video') {
      return 'Bloc vidéo proposé dans les résultats de recherche.';
    }

    return '';
  }

  private async saveAnalyzedKeyword(
    keyword: string,
    volume: number,
    difficulty: number,
    intent: string,
    searchIntentDescription?: string | null,
  ) {
    const existingKeyword =
      await this.keywordService.findExistingKeyword(keyword);

    if (existingKeyword) {
      return this.keywordService.updateKeywordMetadata(existingKeyword.id, {
        volume,
        difficulty,
        searchIntent: intent,
        searchIntentDescription,
        lastScannedAt: new Date(),
      });
    }

    const result = await this.keywordService.findExistingOrCreateKeyword({
      keyword,
      source: KeywordSource.OTHER,
      volume,
      difficulty,
      searchIntent: intent,
    });

    return this.keywordService.updateKeywordMetadata(result.keyword.id, {
      lastScannedAt: new Date(),
      searchIntentDescription,
    });
  }
}
