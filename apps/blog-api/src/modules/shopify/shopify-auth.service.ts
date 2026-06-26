import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { URLSearchParams } from 'node:url';
import { SHOPIFY_DEFAULT_API_VERSION } from './shopify.constants';
import {
  buildShopifyStoreDomain,
  normalizeShopifyStoreHandle,
} from '../../common/utils/normalize.utils';

@Injectable()
export class ShopifyAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiVersion: string;
  private readonly credentialAccessTokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('SHOPIFY_CLIENT_ID') ?? '';
    this.clientSecret =
      this.configService.get<string>('SHOPIFY_CLIENT_SECRET') ?? '';
    this.apiVersion =
      this.configService.get<string>('SHOPIFY_API_VERSION') ??
      SHOPIFY_DEFAULT_API_VERSION;
  }

  isConfigured() {
    return this.hasAuthenticationCredentials();
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      storeDomain: null,
      apiVersion: this.apiVersion,
    };
  }

  buildGraphqlUrl(storeDomain: string) {
    this.assertConfigured();
    const normalizedStoreDomain = this.normalizeStoreDomain(storeDomain);

    return `https://${buildShopifyStoreDomain(normalizedStoreDomain)}/admin/api/${this.apiVersion}/graphql.json`;
  }

  async buildHeaders(storeDomain: string) {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': await this.getAccessToken(storeDomain),
    };
  }

  async getAccessToken(storeDomain: string) {
    this.assertConfigured();
    const normalizedStoreDomain = this.normalizeStoreDomain(storeDomain);

    const cachedToken = this.credentialAccessTokens.get(normalizedStoreDomain);

    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
      return cachedToken.token;
    }

    const oauthUrl = this.buildOauthTokenUrl(normalizedStoreDomain);
    let response: Response;

    try {
      response = await fetch(oauthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
    } catch (error) { 
      throw new BadRequestException({
        message: `Shopify OAuth request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: 'SHOPIFY_TOKEN_REQUEST_FAILED',
        statusCode: null,
      });
    }

    const responseBodyText = await response.text().catch(() => '');
    const payload = this.safeParseJson(responseBodyText) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
      error_code?: string;
    } | null;

    if (!response.ok || !payload?.access_token) {
      const rawErrorCode =
        payload?.error?.trim() ||
        (typeof payload?.error_code === 'string'
          ? payload.error_code.trim()
          : '') ||
        '';
      const htmlErrorDetail =
        this.extractHtmlOAuthErrorDetail(responseBodyText);
      const errorDetail =
        payload?.error_description?.trim() ||
        htmlErrorDetail ||
        rawErrorCode ||
        responseBodyText.trim() ||
        'Unknown error';
      const errorType = this.mapShopifyTokenErrorType(
        response.status,
        rawErrorCode,
        errorDetail,
      );

      throw new BadRequestException({
        message: `Shopify token request failed with status ${response.status}: ${errorDetail}`,
        errorType,
        errorCode: rawErrorCode || null,
        errorDetail,
        statusCode: response.status,
      });
    }

    this.credentialAccessTokens.set(normalizedStoreDomain, {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    });

    return payload.access_token;
  }

  private buildOauthTokenUrl(storeDomain: string) {
    return `https://${buildShopifyStoreDomain(storeDomain)}/admin/oauth/access_token`;
  }

  private hasAuthenticationCredentials() {
    return !!this.clientId.trim() && !!this.clientSecret.trim();
  }

  private assertConfigured() {
    if (this.isConfigured()) {
      return;
    }

    throw new ServiceUnavailableException(
      'Shopify credentials are missing. Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.',
    );
  }

  private normalizeStoreDomain(storeDomain: string) {
    const normalizedStoreDomain = normalizeShopifyStoreHandle(storeDomain);

    if (!normalizedStoreDomain) {
      throw new ServiceUnavailableException(
        'Shopify store domain is missing for the current project.',
      );
    }

    return normalizedStoreDomain;
  }

  private safeParseJson(value: string) {
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

  private extractHtmlOAuthErrorDetail(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return '';
    }

    const oauthErrorMatch = trimmed.match(
      /Oauth error\s+([a-z0-9_-]+):\s*([\s\S]*?)(?:<\/div>|<\/p>|<\/body>|$)/i,
    );

    if (!oauthErrorMatch) {
      return '';
    }

    const errorCode = oauthErrorMatch[1]?.trim() || '';
    const errorMessage = this.stripHtmlTags(oauthErrorMatch[2] ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (errorCode && errorMessage) {
      return `${errorCode}: ${errorMessage}`;
    }

    return errorMessage || errorCode;
  }

  private stripHtmlTags(value: string) {
    return value.replace(/<[^>]+>/g, ' ');
  }

  private mapShopifyTokenErrorType(
    status: number,
    errorCode: string,
    errorDetail: string,
  ) {
    const normalizedErrorCode = errorCode.trim().toLowerCase();
    const normalizedErrorDetail = errorDetail.trim().toLowerCase();

    if (status === 400) {
      if (
        normalizedErrorCode.includes('app_not_installed') ||
        normalizedErrorDetail.includes('app_not_installed') ||
        normalizedErrorDetail.includes(
          'application is not installed on this shop',
        )
      ) {
        return 'SHOPIFY_APP_NOT_INSTALLED';
      }

      if (
        normalizedErrorCode.includes('invalid_client') ||
        normalizedErrorDetail.includes('invalid_client') ||
        normalizedErrorDetail.includes('client secret') ||
        normalizedErrorDetail.includes('client_id')
      ) {
        return 'SHOPIFY_TOKEN_INVALID_CLIENT';
      }

      if (
        normalizedErrorCode.includes('invalid_request') ||
        normalizedErrorDetail.includes('invalid_request') ||
        normalizedErrorDetail.includes('grant')
      ) {
        return 'SHOPIFY_TOKEN_INVALID_REQUEST';
      }

      return 'PROJECT_SHOPIFY_STORE_NOT_LINKED';
    }

    if (status === 401 || status === 403) {
      return 'SHOPIFY_TOKEN_UNAUTHORIZED';
    }

    return 'SHOPIFY_TOKEN_REQUEST_FAILED';
  }
}
