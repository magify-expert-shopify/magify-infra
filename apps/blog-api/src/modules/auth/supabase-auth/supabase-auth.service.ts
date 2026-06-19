import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SUPABASE_AUTHORIZATION_HEADER_PREFIX,
  SUPABASE_SECRET_KEY_ENV_KEYS,
  SUPABASE_URL_ENV_KEYS,
} from './supabase-auth.constants';
import type {
  SupabaseAuthRequest,
  SupabaseAuthUserResponse,
  SupabaseAuthenticatedUser,
} from './supabase-auth.types';

@Injectable()
export class SupabaseAuthService {
  constructor(private readonly configService: ConfigService) {}

  extractBearerToken(authorizationHeader: string | null | undefined) {
    const authorization = authorizationHeader?.trim() ?? '';

    if (!authorization.startsWith(SUPABASE_AUTHORIZATION_HEADER_PREFIX)) {
      return null;
    }

    const token = authorization
      .slice(SUPABASE_AUTHORIZATION_HEADER_PREFIX.length)
      .trim();

    return token || null;
  }

  async getUserFromRequest(request: SupabaseAuthRequest) {
    return this.getUserFromBearerToken(
      this.extractBearerToken(request.headers.authorization ?? null),
    );
  }

  async getUserFromBearerToken(accessToken: string | null) {
    if (!accessToken?.trim()) {
      return null;
    }

    const supabaseUrl = this.getSupabaseUrl();
    const supabaseSecretKey = this.getSupabaseSecretKey();
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `${SUPABASE_AUTHORIZATION_HEADER_PREFIX}${accessToken.trim()}`,
        apikey: supabaseSecretKey,
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new BadGatewayException(
        `Supabase auth request failed with status ${response.status}${errorDetails ? `: ${errorDetails}` : ''}`,
      );
    }

    const payload = (await response.json()) as SupabaseAuthUserResponse;

    if (!payload?.id?.trim()) {
      return null;
    }

    return this.mapUser(payload);
  }

  private getSupabaseUrl() {
    const supabaseUrl = this.resolveEnvValue(SUPABASE_URL_ENV_KEYS);

    if (!supabaseUrl) {
      throw new InternalServerErrorException(
        `Missing environment variable ${SUPABASE_URL_ENV_KEYS[0]}`,
      );
    }

    return supabaseUrl.replace(/\/+$/, '');
  }

  private getSupabaseSecretKey() {
    const supabaseAnonKey = this.resolveEnvValue(SUPABASE_SECRET_KEY_ENV_KEYS);

    if (!supabaseAnonKey) {
      throw new InternalServerErrorException(
        `Missing environment variable ${SUPABASE_SECRET_KEY_ENV_KEYS[0]}`,
      );
    }

    return supabaseAnonKey;
  }

  private resolveEnvValue(envKeys: readonly string[]) {
    for (const envKey of envKeys) {
      const value = this.configService.get<string>(envKey)?.trim();

      if (value) {
        return value;
      }
    }

    return '';
  }

  private mapUser(payload: SupabaseAuthUserResponse): SupabaseAuthenticatedUser {
    return {
      id: payload.id?.trim() ?? '',
      email: payload.email?.trim() ?? null,
      phone: payload.phone?.trim() ?? null,
      role: payload.role?.trim() ?? null,
      aud: payload.aud?.trim() ?? null,
      createdAt: payload.created_at?.trim() ?? null,
      lastSignInAt: payload.last_sign_in_at?.trim() ?? null,
      appMetadata: payload.app_metadata ?? {},
      userMetadata: payload.user_metadata ?? {},
      identities:
        payload.identities?.map((identity) => ({
          provider: identity.provider ?? null,
        })) ?? [],
      raw: payload,
    };
  }
}
