import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  GOOGLE_OAUTH_ACCESS_TOKEN_SETTING_KEY,
  GOOGLE_OAUTH_EXPIRY_DATE_SETTING_KEY,
  GOOGLE_OAUTH_ID_TOKEN_SETTING_KEY,
  GOOGLE_OAUTH_REFRESH_TOKEN_SETTING_KEY,
  GOOGLE_OAUTH_SCOPE_SETTING_KEY,
} from './google-auth.constants';
import { PrismaService } from 'src/prisma/prisma.service';

export type GoogleOauthTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  id_token?: string | null;
  scope?: string | null;
  expiry_date?: number | null;
};

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private readonly defaultOauthScopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'openid',
    'email',
    'profile',
  ];

  createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
    return new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID') ?? '',
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') ?? '',
      this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URI') ?? '',
    );
  }

  getOauthClientId() {
    return this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID') ?? '';
  }

  getOauthRefreshToken() {
    return this.configService.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN') ?? '';
  }

  generateAuthUrl() {
    const oauth2Client = this.createOAuth2Client();

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.defaultOauthScopes,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleOauthTokens> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    return tokens as GoogleOauthTokens;
  }

  async storeOauthTokens(tokens: GoogleOauthTokens) {
    const currentStoredRefreshToken = await this.getStoredSetting(
      GOOGLE_OAUTH_REFRESH_TOKEN_SETTING_KEY,
    );
    const refreshToken =
      tokens.refresh_token?.trim() || currentStoredRefreshToken || '';

    await Promise.all([
      this.upsertSetting(
        GOOGLE_OAUTH_ACCESS_TOKEN_SETTING_KEY,
        tokens.access_token?.trim() || '',
      ),
      this.upsertSetting(GOOGLE_OAUTH_REFRESH_TOKEN_SETTING_KEY, refreshToken),
      this.upsertSetting(
        GOOGLE_OAUTH_ID_TOKEN_SETTING_KEY,
        tokens.id_token?.trim() || '',
      ),
      this.upsertSetting(
        GOOGLE_OAUTH_SCOPE_SETTING_KEY,
        tokens.scope?.trim() || '',
      ),
      this.upsertSetting(
        GOOGLE_OAUTH_EXPIRY_DATE_SETTING_KEY,
        tokens.expiry_date ? String(tokens.expiry_date) : '',
      ),
    ]);
  }

  async getStoredOauthRefreshToken() {
    return (
      (await this.getStoredSetting(GOOGLE_OAUTH_REFRESH_TOKEN_SETTING_KEY)) ||
      this.getOauthRefreshToken()
    );
  }

  getOauthRedirectUrl() {
    const baseUrl =
      this.configService.get<string>('NUXT_WEB_URL') ?? 'http://localhost:3000';

    return `${baseUrl.replace(/\/+$/, '')}/settings`;
  }

  getOauthAuthPageUrl() {
    return `${this.getPublicApiBaseUrl()}/google/auth-url`;
  }

  async getCurrentOauthAccount() {
    const refreshToken = await this.getStoredOauthRefreshToken();
    const oauth2Client = this.createOAuth2Client();

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const refreshResponse = await oauth2Client.refreshAccessToken();
    const accessToken = refreshResponse.credentials.access_token ?? '';
    const idToken = refreshResponse.credentials.id_token ?? null;

    if (!accessToken) {
      throw new Error('No Google access token could be generated.');
    }

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const tokenInfo = await oauth2Client.getTokenInfo(accessToken);
    const scopes = tokenInfo.scopes ?? [];
    const profile = await this.getGoogleProfileFromIdToken(idToken);

    return {
      accessToken,
      tokenInfo: {
        audience: tokenInfo.aud ?? null,
        scopes,
        expiryDate: tokenInfo.expiry_date ?? null,
      },
      profile,
      hasIdentityScopes:
        scopes.includes('openid') ||
        scopes.includes('email') ||
        scopes.includes('profile') ||
        scopes.includes('https://www.googleapis.com/auth/userinfo.email') ||
        scopes.includes('https://www.googleapis.com/auth/userinfo.profile'),
    };
  }

  private async upsertSetting(key: string, value: string) {
    await (this.prisma as any).appSetting.upsert({
      where: { key },
      update: { value },
      create: { id: randomUUID(), key, value },
    });
  }

  private async getStoredSetting(key: string) {
    const setting = await (this.prisma as any).appSetting.findUnique({
      where: { key },
    });

    return setting?.value?.trim() || '';
  }

  private getPublicApiBaseUrl() {
    const configuredBaseUrl =
      this.configService.get<string>('NUXT_API_URL') ??
      'http://localhost:4000/api';

    return configuredBaseUrl.replace(/\/+$/, '');
  }

  private async getGoogleProfileFromIdToken(idToken: string | null) {
    if (!idToken) {
      return null;
    }

    try {
      const ticket = await this.createOAuth2Client().verifyIdToken({
        idToken,
        audience: this.getOauthClientId(),
      });
      const payload = ticket.getPayload();

      if (!payload) {
        return null;
      }

      return {
        id: payload.sub ?? null,
        email: payload.email ?? null,
        name: payload.name ?? null,
        verifiedEmail: payload.email_verified ?? false,
        picture: payload.picture ?? null,
      };
    } catch {
      return null;
    }
  }
}
