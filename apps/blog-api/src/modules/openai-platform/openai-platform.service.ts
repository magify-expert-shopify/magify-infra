import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OPENAI_PROMPT_TYPES } from './openai-prompt-types.constants';
import {
  OPENAI_PLATFORM_DEFAULT_BASE_URL,
  OPENAI_PLATFORM_DEFAULT_CACHE_TTL_MS,
} from './openai-platform.constants';
import type {
  OpenAiPlatformRequestOptions,
  OpenAiResponseCreateInput,
  OpenAiResponseObject,
} from './openai-platform.types';
import { OpenAiPromptType } from 'src/common/types';

@Injectable()
export class OpenAiPlatformService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly organization: string;
  private readonly project: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ??
      OPENAI_PLATFORM_DEFAULT_BASE_URL;
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.organization =
      this.configService.get<string>('OPENAI_ORGANIZATION') ?? '';
    this.project = this.configService.get<string>('OPENAI_PROJECT') ?? '';
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async createResponse(payload: OpenAiResponseCreateInput) {
    const cachedResponse =
      await this.getCachedResponse<OpenAiResponseObject>(payload);

    if (cachedResponse) {
      return cachedResponse;
    }

    const normalizedPayload = this.withDisabledReasoning(payload);
    const requestBody = this.buildRequestBody(normalizedPayload);
    const normalizedPromptType = this.normalizeOpenAiPromptType(
      payload.promptType,
    );
    const requestOptions: OpenAiPlatformRequestOptions = {
      method: 'POST',
      path: '/responses',
      body: requestBody,
    };
    const cacheKey = this.buildCacheKey(requestOptions);
    const now = new Date();
    try {
      const cachedEntry = await (this.prisma as any).openAiCache.findUnique({
        where: { cacheKey },
      });

      if (
        cachedEntry &&
        (!cachedEntry.expiresAt || new Date(cachedEntry.expiresAt) > now)
      ) {
        const cachedEntryUpdateData = {
          model: payload.model,
          lastUsedAt: now,
          ...(this.shouldUpdatePromptType(
            cachedEntry.promptType,
            normalizedPromptType,
          )
            ? { promptType: normalizedPromptType }
            : {}),
        };

        try {
          await (this.prisma as any).openAiCache.update({
            where: { cacheKey },
            data: cachedEntryUpdateData,
          });
        } catch (cacheError) {
          if (!this.isPromptTypeValidationError(cacheError)) {
            console.warn('[OpenAI cache] cache hit update failed', cacheError);
          } else {
            try {
              const { promptType: _promptType, ...fallbackData } =
                cachedEntryUpdateData;

              await (this.prisma as any).openAiCache.update({
                where: { cacheKey },
                data: fallbackData,
              });
            } catch (fallbackCacheError) {
              console.warn(
                '[OpenAI cache] cache hit update fallback failed',
                fallbackCacheError,
              );
            }
          }
        }

        return JSON.parse(cachedEntry.responseBody) as OpenAiResponseObject;
      }
    } catch (cacheError) {
      console.warn('[OpenAI cache] cache lookup failed', cacheError);
    }

    const response =
      await this.requestRemote<OpenAiResponseObject>(requestOptions);

    try {
      const cacheWriteData = {
        where: { cacheKey },
        update: {
          model: payload.model,
          promptType: normalizedPromptType,
          requestPayload: this.stableStringify({
            method: requestOptions.method ?? 'GET',
            path: requestOptions.path,
            body: requestOptions.body,
            query: requestOptions.query,
          }),
          responseBody: JSON.stringify(response),
          lastUsedAt: now,
          expiresAt: new Date(
            now.getTime() + OPENAI_PLATFORM_DEFAULT_CACHE_TTL_MS,
          ),
        },
        create: {
          endpoint: requestOptions.path,
          model: payload.model,
          promptType: normalizedPromptType,
          cacheKey,
          requestPayload: this.stableStringify({
            method: requestOptions.method ?? 'GET',
            path: requestOptions.path,
            body: requestOptions.body,
            query: requestOptions.query,
          }),
          responseBody: JSON.stringify(response),
          lastUsedAt: now,
          expiresAt: new Date(
            now.getTime() + OPENAI_PLATFORM_DEFAULT_CACHE_TTL_MS,
          ),
        },
      };

      try {
        await (this.prisma as any).openAiCache.upsert(cacheWriteData);
      } catch (cacheError) {
        if (!this.isPromptTypeValidationError(cacheError)) {
          throw cacheError;
        }

        const { promptType: _promptType, ...fallbackCacheWriteData } =
          cacheWriteData.update;
        const { promptType: _createPromptType, ...fallbackCreateData } =
          cacheWriteData.create;

        await (this.prisma as any).openAiCache.upsert({
          where: { cacheKey },
          update: fallbackCacheWriteData,
          create: fallbackCreateData,
        });
      }
    } catch (cacheError) {
      console.warn('[OpenAI cache] cache write failed', cacheError);
    }

    return response;
  }

  async getCachedResponse<T>(payload: OpenAiResponseCreateInput) {
    const normalizedPayload = this.withDisabledReasoning(payload);
    const requestBody = this.buildRequestBody(normalizedPayload);
    const requestOptions: OpenAiPlatformRequestOptions = {
      method: 'POST',
      path: '/responses',
      body: requestBody,
    };
    const cacheKey = this.buildCacheKey(requestOptions);
    const now = new Date();

    try {
      const cachedEntry = await (this.prisma as any).openAiCache.findUnique({
        where: { cacheKey },
      });

      if (
        !cachedEntry ||
        (cachedEntry.expiresAt && new Date(cachedEntry.expiresAt) <= now)
      ) {
        return null;
      }

      try {
        await (this.prisma as any).openAiCache.update({
          where: { cacheKey },
          data: {
            model: payload.model,
            lastUsedAt: now,
            ...(this.shouldUpdatePromptType(
              cachedEntry.promptType,
              this.normalizeOpenAiPromptType(payload.promptType),
            )
              ? {
                  promptType: this.normalizeOpenAiPromptType(
                    payload.promptType,
                  ),
                }
              : {}),
          },
        });
      } catch (cacheError) {
        if (!this.isPromptTypeValidationError(cacheError)) {
          console.warn('[OpenAI cache] cache hit update failed', cacheError);
        }
      }

      return JSON.parse(cachedEntry.responseBody) as T;
    } catch (cacheError) {
      console.warn('[OpenAI cache] cache lookup failed', cacheError);
      return null;
    }
  }

  async retrieveResponse(responseId: string) {
    return this.request<OpenAiResponseObject>({
      method: 'GET',
      path: `/responses/${responseId}`,
    });
  }

  async deleteResponse(responseId: string) {
    return this.request<{ id: string; deleted: boolean }>({
      method: 'DELETE',
      path: `/responses/${responseId}`,
    });
  }

  async request<T>({
    method = 'GET',
    path,
    body,
    query,
  }: OpenAiPlatformRequestOptions) {
    return this.requestRemote<T>({
      method,
      path,
      body,
      query,
    });
  }

  private async requestRemote<T>({
    method = 'GET',
    path,
    body,
    query,
  }: OpenAiPlatformRequestOptions) {
    this.assertConfigured();

    const url = this.buildUrl(path, query);
    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `OpenAI request failed with status ${response.status}: ${errorText}`,
      );
    }

    if (response.status === 204) {
      console.log('[OpenAI response]', method, path, null);
      return null as T;
    }

    const parsedResponse = (await response.json()) as T;
    console.log(
      '[OpenAI response]',
      method,
      path,
      response.status,
      parsedResponse,
    );
    return parsedResponse;
  }

  private buildCacheKey({
    method = 'GET',
    path,
    body,
    query,
  }: OpenAiPlatformRequestOptions) {
    return this.stableStringify({
      method,
      path,
      body,
      query,
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
          .map(([key, nestedValue]) => [key, this.sortValue(nestedValue)]),
      );
    }

    return value;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (!query) {
      return url.toString();
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private buildHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.organization
        ? { 'OpenAI-Organization': this.organization }
        : {}),
      ...(this.project ? { 'OpenAI-Project': this.project } : {}),
    };
  }

  private assertConfigured() {
    if (this.isConfigured()) {
      return;
    }

    throw new Error('OpenAI credentials are missing. Set OPENAI_API_KEY.');
  }

  private withDisabledReasoning(
    payload: OpenAiResponseCreateInput,
  ): OpenAiResponseCreateInput {
    if (payload.reasoning) {
      return payload;
    }

    const reasoning = this.buildDisabledReasoning(payload.model);

    if (!reasoning) {
      return payload;
    }

    return {
      ...payload,
      reasoning,
    };
  }

  private buildRequestBody(payload: OpenAiResponseCreateInput) {
    const { promptType: _promptType, ...requestBody } = payload;

    return requestBody;
  }

  private buildDisabledReasoning(model: string) {
    const normalizedModel = model.trim().toLowerCase();

    if (
      normalizedModel.includes('-pro') ||
      normalizedModel.includes('-codex')
    ) {
      return null;
    }

    if (
      normalizedModel.startsWith('gpt-5.1') ||
      normalizedModel.startsWith('gpt-5.2') ||
      normalizedModel.startsWith('gpt-5.4') ||
      normalizedModel.startsWith('gpt-5.5')
    ) {
      return {
        effort: 'none' as const,
      };
    }

    return null;
  }

  private shouldUpdatePromptType(
    currentPromptType: OpenAiPromptType | string | null | undefined,
    nextPromptType: OpenAiPromptType | undefined,
  ) {
    if (!nextPromptType) {
      return false;
    }

    if (!currentPromptType) {
      return true;
    }

    return currentPromptType === 'OTHER';
  }

  private isPromptTypeValidationError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.includes('Invalid value for argument `promptType`')
    );
  }

  private normalizeOpenAiPromptType(
    value: OpenAiPromptType | string | null | undefined,
  ): OpenAiPromptType {
    if (!value) {
      return 'OTHER';
    }

    return OPENAI_PROMPT_TYPES.includes(value as OpenAiPromptType)
      ? (value as OpenAiPromptType)
      : 'OTHER';
  }
}
