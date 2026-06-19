import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DATAFORSEO_DEFAULT_CACHE_TTL_MS,
  DATAFORSEO_DEFAULT_FRENCH_LANGUAGE_CODE,
  DATAFORSEO_DEFAULT_FRANCE_LOCATION_CODE,
} from './dataforseo.constants';
import type {
  DataForSeoKeywordOverviewTaskResult,
  DataForSeoOrganicLiveTaskResult,
  DataForSeoSerpResultItem,
  DataForSeoTaskResponse,
} from './dataforseo.types';

@Injectable()
export class DataForSeoService {
  private readonly baseUrl: string;
  private readonly login: string;
  private readonly password: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl =
      this.configService.get<string>('DATAFORSEO_BASE_URL') ??
      'https://api.dataforseo.com';
    this.login = this.configService.get<string>('DATAFORSEO_LOGIN') ?? '';
    this.password = this.configService.get<string>('DATAFORSEO_PASSWORD') ?? '';
  }

  isConfigured() {
    return !!this.login && !!this.password;
  }

  async getGoogleKeywordOverview(
    keyword: string,
    options?: {
      locationCode?: number;
      languageCode?: string;
      includeClickstreamData?: boolean;
      includeSerpInfo?: boolean;
      forceRefresh?: boolean;
    },
  ) {
    return this.post<DataForSeoKeywordOverviewTaskResult>(
      '/v3/dataforseo_labs/google/keyword_overview/live',
      [
        {
          keywords: [keyword],
          location_code:
            options?.locationCode ?? DATAFORSEO_DEFAULT_FRANCE_LOCATION_CODE,
          language_code:
            options?.languageCode ?? DATAFORSEO_DEFAULT_FRENCH_LANGUAGE_CODE,
          include_clickstream_data: options?.includeClickstreamData ?? false,
          include_serp_info: options?.includeSerpInfo ?? true,
        },
      ],
      {
        forceRefresh: options?.forceRefresh ?? false,
      },
    );
  }

  async getGoogleOrganicLive(
    keyword: string,
    options?: {
      locationCode?: number;
      languageCode?: string;
      depth?: number;
      forceRefresh?: boolean;
    },
  ) {
    return this.post<DataForSeoOrganicLiveTaskResult>(
      '/v3/serp/google/organic/live/advanced',
      [
        {
          keyword,
          location_code:
            options?.locationCode ?? DATAFORSEO_DEFAULT_FRANCE_LOCATION_CODE,
          language_code:
            options?.languageCode ?? DATAFORSEO_DEFAULT_FRENCH_LANGUAGE_CODE,
          depth: options?.depth ?? 10,
        },
      ],
      {
        forceRefresh: options?.forceRefresh ?? false,
      },
    );
  }

  async getCachedGoogleKeywordOverview(
    keyword: string,
    options?: {
      locationCode?: number;
      languageCode?: string;
      includeClickstreamData?: boolean;
      includeSerpInfo?: boolean;
    },
  ) {
    return this.readCachedResponse<DataForSeoKeywordOverviewTaskResult>(
      '/v3/dataforseo_labs/google/keyword_overview/live',
      [
        {
          keywords: [keyword],
          location_code:
            options?.locationCode ?? DATAFORSEO_DEFAULT_FRANCE_LOCATION_CODE,
          language_code:
            options?.languageCode ?? DATAFORSEO_DEFAULT_FRENCH_LANGUAGE_CODE,
          include_clickstream_data: options?.includeClickstreamData ?? false,
          include_serp_info: options?.includeSerpInfo ?? true,
        },
      ],
    );
  }

  async getCachedGoogleOrganicLive(
    keyword: string,
    options?: {
      locationCode?: number;
      languageCode?: string;
      depth?: number;
    },
  ) {
    return this.readCachedResponse<DataForSeoOrganicLiveTaskResult>(
      '/v3/serp/google/organic/live/advanced',
      [
        {
          keyword,
          location_code:
            options?.locationCode ?? DATAFORSEO_DEFAULT_FRANCE_LOCATION_CODE,
          language_code:
            options?.languageCode ?? DATAFORSEO_DEFAULT_FRENCH_LANGUAGE_CODE,
          depth: options?.depth ?? 10,
        },
      ],
    );
  }

  async post<T>(
    path: string,
    payload: unknown,
    options?: {
      forceRefresh?: boolean;
    },
  ) {
    const serializedPayload = this.stableStringify(payload);
    const cacheKey = `${path}::${serializedPayload}`;
    const now = new Date();
    const cachedEntry = options?.forceRefresh
      ? null
      : await (this.prisma as any).dataForSeoCache.findUnique({
          where: { cacheKey },
        });

    if (
      cachedEntry &&
      (!cachedEntry.expiresAt || new Date(cachedEntry.expiresAt) > now)
    ) {
      await (this.prisma as any).dataForSeoCache.update({
        where: { cacheKey },
        data: {
          lastUsedAt: now,
        },
      });

      return JSON.parse(cachedEntry.responseBody) as DataForSeoTaskResponse<T>;
    }

    this.assertConfigured();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.toBasicAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 402) {
        throw new HttpException(
          {
            statusCode: 402,
            message: 'DataForSEO quota exceeded.',
            error: 'Payment Required',
            provider: 'DataForSEO',
          },
          402,
        );
      }

      throw new HttpException(
        {
          statusCode: response.status,
          message: `DataForSEO request failed with status ${response.status}`,
          error: 'DataForSEO request failed',
          provider: 'DataForSEO',
        },
        response.status,
      );
    }

    const data = (await response.json()) as DataForSeoTaskResponse<T>;

    if (data.status_code !== 20000) {
      if (data.status_code === 40200) {
        throw new HttpException(
          {
            statusCode: 402,
            message: data.status_message ?? 'DataForSEO quota exceeded.',
            error: 'Payment Required',
            provider: 'DataForSEO',
            status_code: data.status_code,
            status_message: data.status_message,
          },
          402,
        );
      }

      throw new HttpException(
        {
          statusCode: 502,
          message: `DataForSEO request failed: ${data.status_code} ${data.status_message}`,
          error: 'DataForSEO request failed',
          provider: 'DataForSEO',
          status_code: data.status_code,
          status_message: data.status_message,
        },
        502,
      );
    }

    await (this.prisma as any).dataForSeoCache.upsert({
      where: { cacheKey },
      update: {
        requestPayload: serializedPayload,
        responseBody: JSON.stringify(data),
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + DATAFORSEO_DEFAULT_CACHE_TTL_MS),
      },
      create: {
        endpoint: path,
        cacheKey,
        requestPayload: serializedPayload,
        responseBody: JSON.stringify(data),
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + DATAFORSEO_DEFAULT_CACHE_TTL_MS),
      },
    });

    return data;
  }

  private async readCachedResponse<T>(
    path: string,
    payload: unknown,
    options?: {
      forceRefresh?: boolean;
    },
  ) {
    const serializedPayload = this.stableStringify(payload);
    const cacheKey = `${path}::${serializedPayload}`;
    const now = new Date();
    const cachedEntry = options?.forceRefresh
      ? null
      : await (this.prisma as any).dataForSeoCache.findUnique({
          where: { cacheKey },
        });

    if (
      !cachedEntry ||
      (cachedEntry.expiresAt && new Date(cachedEntry.expiresAt) <= now)
    ) {
      return null;
    }

    await (this.prisma as any).dataForSeoCache.update({
      where: { cacheKey },
      data: {
        lastUsedAt: now,
      },
    });

    return JSON.parse(cachedEntry.responseBody) as DataForSeoTaskResponse<T>;
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
          .map(([key, nestedValue]) => [key, this.sortValue(nestedValue)]),
      );
    }

    return value;
  }

  private assertConfigured() {
    if (this.isConfigured()) {
      return;
    }

    throw new Error(
      'DataForSEO credentials are missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    );
  }

  private toBasicAuthToken() {
    return Buffer.from(`${this.login}:${this.password}`).toString('base64');
  }
}
