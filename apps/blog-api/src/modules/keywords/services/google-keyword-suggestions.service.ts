import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EMPTY_GOOGLE_KEYWORD_SUGGESTIONS_RESULT } from '../keywords-response.constants';

type GoogleSuggestResponse = [string, string[], ...unknown[]];

const GOOGLE_SUGGEST_DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_GOOGLE_SUGGEST_LANGUAGE = 'fr';
const DEFAULT_GOOGLE_SUGGEST_COUNTRY = 'FR';

@Injectable()
export class GoogleKeywordSuggestionsService {
  private readonly googleSuggestBaseUrl =
    'https://suggestqueries.google.com/complete/search';

  constructor(private readonly prisma: PrismaService) {}

  async suggestKeywords(
    rawQuery: string,
    input?: {
      limit?: number;
      language?: string;
      country?: string;
      expand?: boolean;
    },
  ) {
    const query = rawQuery.trim();

    if (!query) {
      return EMPTY_GOOGLE_KEYWORD_SUGGESTIONS_RESULT;
    }

    const language = input?.language?.trim() || DEFAULT_GOOGLE_SUGGEST_LANGUAGE;
    const country = input?.country?.trim() || DEFAULT_GOOGLE_SUGGEST_COUNTRY;
    const limit = this.normalizeLimit(input?.limit);
    const expand = input?.expand !== false;
    const cacheKey = this.buildCacheKey(query, {
      language,
      country,
      limit,
      expand,
    });
    const cachedResponse = await this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    const searchQueries = this.buildSearchQueries(query, expand);
    const seenKeywords = new Set<string>();
    const suggestions: Array<{
      keyword: string;
      sourceQuery: string;
    }> = [];

    for (const searchQuery of searchQueries) {
      if (suggestions.length >= limit) {
        break;
      }

      let searchQuerySuggestions: string[] = [];

      try {
        searchQuerySuggestions = await this.fetchSuggestionsForQuery(
          searchQuery,
          {
            language,
            country,
          },
        );
      } catch (error) {
        console.warn(
          `[Google Suggest] query "${searchQuery}" skipped due to fetch error`,
          error,
        );
        continue;
      }

      for (const keyword of searchQuerySuggestions) {
        const normalizedKeyword = keyword.trim().toLowerCase();

        if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) {
          continue;
        }

        seenKeywords.add(normalizedKeyword);
        suggestions.push({
          keyword: keyword.trim(),
          sourceQuery: searchQuery,
        });

        if (suggestions.length >= limit) {
          break;
        }
      }
    }

    const response = {
      query,
      suggestions,
      total: suggestions.length,
    };

    await this.storeCachedResponse(cacheKey, response);

    return response;
  }

  private buildSearchQueries(query: string, expand: boolean) {
    if (!expand) {
      return [query];
    }

    const suffixes = [
      '',
      ...'abcdefghijklmnopqrstuvwxyz'.split(''),
      ...'0123456789'.split(''),
    ];

    return suffixes.map((suffix) =>
      suffix ? `${query} ${suffix}`.trim() : query,
    );
  }

  private async fetchSuggestionsForQuery(
    query: string,
    input: {
      language: string;
      country: string;
    },
  ) {
    const url = new URL(this.googleSuggestBaseUrl);

    url.searchParams.set('client', 'firefox');
    url.searchParams.set('hl', input.language);
    url.searchParams.set('gl', input.country.toUpperCase());
    url.searchParams.set('lr', `lang_${input.language.toLowerCase()}`);
    url.searchParams.set('q', query);

    console.log('[Google Suggest] request url', url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; BlogMagifyBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Google Suggest request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as GoogleSuggestResponse;

    return Array.isArray(payload?.[1])
      ? payload[1].filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async getCachedResponse(cacheKey: string) {
    const now = new Date();
    const cachedEntry = await (
      this.prisma as any
    ).googleSuggestCache.findUnique({
      where: { cacheKey },
    });

    if (
      !cachedEntry ||
      (cachedEntry.expiresAt && new Date(cachedEntry.expiresAt) <= now)
    ) {
      return null;
    }

    await (this.prisma as any).googleSuggestCache.update({
      where: { cacheKey },
      data: {
        lastUsedAt: now,
      },
    });

    return JSON.parse(cachedEntry.responseBody);
  }

  private async storeCachedResponse(
    cacheKey: string,
    response: {
      query: string;
      suggestions: Array<{
        keyword: string;
        sourceQuery: string;
      }>;
      total: number;
    },
  ) {
    const now = new Date();

    await (this.prisma as any).googleSuggestCache.upsert({
      where: { cacheKey },
      update: {
        requestPayload: JSON.stringify({ cacheKey }),
        responseBody: JSON.stringify(response),
        lastUsedAt: now,
        expiresAt: new Date(
          now.getTime() + GOOGLE_SUGGEST_DEFAULT_CACHE_TTL_MS,
        ),
      },
      create: {
        id: cacheKey,
        endpoint: this.googleSuggestBaseUrl,
        cacheKey,
        requestPayload: JSON.stringify({ cacheKey }),
        responseBody: JSON.stringify(response),
        lastUsedAt: now,
        expiresAt: new Date(
          now.getTime() + GOOGLE_SUGGEST_DEFAULT_CACHE_TTL_MS,
        ),
      },
    });
  }

  private buildCacheKey(
    query: string,
    input: {
      language: string;
      country: string;
      limit: number;
      expand: boolean;
    },
  ) {
    return this.stableStringify({
      query,
      language: input.language,
      country: input.country,
      limit: input.limit,
      expand: input.expand,
    });
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, item]) => [key, this.sortValue(item)]),
      );
    }

    return value;
  }

  private normalizeLimit(limit?: number) {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return 200;
    }

    return Math.max(1, Math.min(Math.round(limit), 500));
  }
}
