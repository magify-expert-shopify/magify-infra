import type {
  SupabaseAuthIdentity,
  SupabaseAuthUserResponse,
  SupabaseAuthenticatedUser,
} from './supabase-auth.types';

export type SupabaseAuthMeUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  aud: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  identities: SupabaseAuthIdentity[];
};

export function mapSupabaseAuthenticatedUserToMeUser(
  user: SupabaseAuthenticatedUser | null,
): SupabaseAuthMeUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    aud: user.aud,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    appMetadata: user.appMetadata ?? {},
    userMetadata: user.userMetadata ?? {},
    identities: user.identities ?? [],
  };
}

export function mapSupabaseAuthResponseToMeUser(
  response: SupabaseAuthUserResponse | null | undefined,
): SupabaseAuthMeUser | null {
  if (!response?.id) {
    return null;
  }

  return {
    id: response.id,
    email: response.email ?? null,
    phone: response.phone ?? null,
    role: response.role ?? null,
    aud: response.aud ?? null,
    createdAt: response.created_at ?? null,
    lastSignInAt: response.last_sign_in_at ?? null,
    appMetadata: response.app_metadata ?? {},
    userMetadata: response.user_metadata ?? {},
    identities:
      response.identities?.map((identity) => ({
        provider: identity.provider ?? null,
      })) ?? [],
  };
}
