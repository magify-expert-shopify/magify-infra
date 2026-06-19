import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { extractHostname, toBaseUrl } from '../../../common/utils/url.util';
import type {
  DataForSeoOrganicLiveTaskResult,
  DataForSeoTaskResponse,
  DataForSeoSerpResultItem,
} from '../../keyword-analysis/dataforseo.types';
import type { SearchIntent } from 'src/common/types/prisma-enums';

type KeywordVisibilityKeyword = {
  id: string;
  keyword: string;
  projectId: string | null;
  isFavorite: boolean;
  volume: number | null;
  difficulty: number | null;
  searchIntent: SearchIntent | null;
  lastScannedAt: Date | null;
};

type KeywordVisibilityCandidate = {
  keyword: string;
  keywordKey: string;
  position: number;
  url: string;
  title: string;
  snippet: string;
  cacheCreatedAt: Date;
  pageTitle?: string | null;
  existingKeyword: KeywordVisibilityKeyword | null;
};

type KeywordVisibilityObservationCandidate = {
  keyword: string;
  keywordKey: string;
  position: number;
  url: string;
  title: string;
  snippet: string;
  cacheKey: string;
  cacheCreatedAt: Date;
  responseBody: string;
};

@Injectable()
export class KeywordSiteVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCachedSiteVisibility(rawSiteUrl: string) {
    const normalizedSiteUrl = this.normalizeSiteUrl(rawSiteUrl);
    const siteBaseUrl = toBaseUrl(normalizedSiteUrl);
    const siteHostname = this.normalizeHostname(
      extractHostname(normalizedSiteUrl),
    );

    const cacheEntries = await (this.prisma as any).dataForSeoCache.findMany({
      where: {
        endpoint: '/v3/serp/google/organic/live/advanced',
        responseBody: {
          contains: siteHostname,
        },
      },
      select: {
        cacheKey: true,
        requestPayload: true,
        responseBody: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const matchedKeywords = new Map<string, KeywordVisibilityCandidate>();
    const matchedObservations: KeywordVisibilityObservationCandidate[] = [];

    for (const entry of cacheEntries) {
      const sourceKeyword = this.extractKeywordFromRequestPayload(
        entry.requestPayload,
      );

      if (!sourceKeyword) {
        continue;
      }

      const response = this.parseOrganicResponse(entry.responseBody);

      if (!response) {
        continue;
      }

      const bestMatch = this.findBestSiteMatch(
        response,
        siteHostname,
        entry.createdAt,
      );

      if (!bestMatch) {
        continue;
      }

      matchedObservations.push({
        keyword: sourceKeyword,
        keywordKey: this.normalizeKeywordKey(sourceKeyword),
        position: bestMatch.position,
        url: bestMatch.url,
        title: bestMatch.title,
        snippet: bestMatch.snippet,
        cacheKey: entry.cacheKey,
        cacheCreatedAt: bestMatch.cacheCreatedAt,
        responseBody: entry.responseBody,
      });

      const keywordKey = this.normalizeKeywordKey(sourceKeyword);
      const existingCandidate = matchedKeywords.get(keywordKey);

      if (
        !existingCandidate ||
        bestMatch.position < existingCandidate.position ||
        (bestMatch.position === existingCandidate.position &&
          bestMatch.cacheCreatedAt > existingCandidate.cacheCreatedAt)
      ) {
        matchedKeywords.set(keywordKey, {
          ...bestMatch,
          keyword: sourceKeyword,
          keywordKey,
          existingKeyword: null,
        });
      }
    }

    const keywordValues = Array.from(matchedKeywords.values()).map(
      (item) => item.keyword,
    );
    const existingKeywords = keywordValues.length
      ? await (this.prisma as any).keyword.findMany({
          where: {
            keyword: {
              in: keywordValues,
            },
            trashedAt: null,
          },
          select: {
            id: true,
            keyword: true,
            projectId: true,
            isFavorite: true,
            volume: true,
            difficulty: true,
            searchIntent: true,
            lastScannedAt: true,
          },
        })
      : [];

    const existingKeywordMap = new Map(
      (existingKeywords as KeywordVisibilityKeyword[]).map((keyword) => [
        this.normalizeKeywordKey(keyword.keyword),
        keyword,
      ]),
    );
    const matchedPageUrls = Array.from(
      new Set(
        matchedObservations
          .map((item) => item.url.trim())
          .filter((value) => Boolean(value)),
      ),
    );
    const matchedPages = matchedPageUrls.length
      ? await (this.prisma as any).page.findMany({
          where: {
            url: {
              in: matchedPageUrls,
            },
            trashedAt: null,
          },
          select: {
            id: true,
            url: true,
            title: true,
            projectId: true,
          },
        })
      : [];
    const matchedPagesByUrl = new Map(
      (
        matchedPages as Array<{
          id: string;
          url: string;
          title: string;
          projectId?: string | null;
        }>
      ).map((page) => [page.url, page]),
    );

    for (const observation of matchedObservations) {
      const existingKeyword =
        existingKeywordMap.get(this.normalizeKeywordKey(observation.keyword)) ??
        null;
      const matchedPage = matchedPagesByUrl.get(observation.url) ?? null;
      const normalizedPageUrl = observation.url.trim();
      const normalizedSiteBaseUrl = siteBaseUrl.trim();
      const normalizedSiteHostname = siteHostname.trim();

      if (!normalizedPageUrl) {
        continue;
      }

      await this.persistKeywordSiteVisibilityObservation({
        observation,
        existingKeyword,
        matchedPage,
        siteBaseUrl: normalizedSiteBaseUrl,
        siteHostname: normalizedSiteHostname,
      });
    }

    const items = Array.from(matchedKeywords.values())
      .map((item) => ({
        ...item,
        pageTitle: matchedPagesByUrl.get(item.url)?.title?.trim() || null,
        existingKeyword:
          existingKeywordMap.get(this.normalizeKeywordKey(item.keyword)) ??
          null,
      }))
      .sort((left, right) => {
        if (left.position !== right.position) {
          return left.position - right.position;
        }

        return left.keyword.localeCompare(right.keyword);
      });

    return {
      siteUrl: normalizedSiteUrl,
      siteBaseUrl,
      totalKeywords: items.length,
      scannedCacheEntries: cacheEntries.length,
      items,
    };
  }

  private async persistKeywordSiteVisibilityObservation(input: {
    observation: KeywordVisibilityObservationCandidate;
    existingKeyword: KeywordVisibilityKeyword | null;
    matchedPage: {
      id: string;
      url: string;
      title: string;
      projectId?: string | null;
    } | null;
    siteBaseUrl: string;
    siteHostname: string;
  }) {
    const keywordText = input.observation.keyword.trim();
    const pageUrl = input.observation.url.trim();
    const sourceCacheKey = input.observation.cacheKey.trim();

    if (!keywordText || !pageUrl || !sourceCacheKey) {
      return;
    }

    const payload = {
      projectId:
        input.matchedPage?.projectId?.trim() ||
        input.existingKeyword?.projectId?.trim() ||
        null,
      keywordId: input.existingKeyword?.id ?? null,
      keywordText,
      keywordVolume: input.existingKeyword?.volume ?? null,
      keywordDifficulty: input.existingKeyword?.difficulty ?? null,
      keywordIntent: input.existingKeyword?.searchIntent ?? null,
      pageId: input.matchedPage?.id ?? null,
      pageUrl,
      siteBaseUrl: input.siteBaseUrl,
      siteHostname: input.siteHostname,
      position: input.observation.position,
      serpResponseBody: input.observation.responseBody,
      sourceCacheKey,
      sourceCacheCreatedAt: input.observation.cacheCreatedAt,
      observedAt: input.observation.cacheCreatedAt,
    };

    const existingObservation = await (
      this.prisma as any
    ).keywordSiteVisibilityObservation.findFirst({
      where: {
        sourceCacheKey,
        pageUrl,
      },
      select: {
        id: true,
      },
    });

    if (existingObservation) {
      await (this.prisma as any).keywordSiteVisibilityObservation.update({
        where: {
          id: existingObservation.id,
        },
        data: payload,
      });
      return;
    }

    await (this.prisma as any).keywordSiteVisibilityObservation.create({
      data: payload,
    });
  }

  private normalizeSiteUrl(siteUrl: string) {
    const trimmed = siteUrl.trim();

    if (!trimmed) {
      throw new BadRequestException('Body field "siteUrl" is required');
    }

    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        throw new BadRequestException(
          'Body field "siteUrl" must be a valid URL',
        );
      }
    }
  }

  private extractKeywordFromRequestPayload(requestPayload: string) {
    try {
      const parsed = JSON.parse(requestPayload) as unknown;
      const payload = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { body?: unknown }).body)
          ? ((parsed as { body?: unknown[] }).body ?? [])
          : [];
      const firstEntry = payload[0] as { keyword?: unknown } | undefined;

      return typeof firstEntry?.keyword === 'string'
        ? firstEntry.keyword.trim()
        : '';
    } catch {
      return '';
    }
  }

  private parseOrganicResponse(responseBody: string) {
    try {
      return JSON.parse(
        responseBody,
      ) as DataForSeoTaskResponse<DataForSeoOrganicLiveTaskResult>;
    } catch {
      return null;
    }
  }

  private findBestSiteMatch(
    response: DataForSeoTaskResponse<DataForSeoOrganicLiveTaskResult>,
    siteHostname: string,
    cacheCreatedAt: Date,
  ) {
    const matchingItems = response.tasks
      .flatMap((task) => task.result ?? [])
      .flatMap((result) => result.items ?? [])
      .filter((item) => item.type && item.type !== 'search_information')
      .map((item, index) => ({
        item,
        position: item.rank_absolute ?? item.rank_group ?? index + 1,
      }))
      .filter(
        ({ item }) =>
          this.normalizeHostname(this.getResultHostname(item)) === siteHostname,
      )
      .sort((left, right) => left.position - right.position);

    const bestItem = matchingItems[0];

    if (!bestItem) {
      return null;
    }

    return {
      position: bestItem.position,
      url: bestItem.item.url ?? bestItem.item.check_url ?? '',
      title: bestItem.item.title ?? '',
      snippet: bestItem.item.description ?? '',
      cacheCreatedAt,
    };
  }

  private getResultHostname(item: DataForSeoSerpResultItem) {
    const url = item.url ?? '';

    if (!url) {
      return '';
    }

    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private normalizeHostname(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
  }

  private normalizeKeywordKey(keyword: string) {
    return keyword.trim().toLowerCase();
  }
}
