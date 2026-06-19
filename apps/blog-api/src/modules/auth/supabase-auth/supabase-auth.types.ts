import type { Request } from 'express';

export interface SupabaseAuthIdentity {
  provider?: string | null;
}

export interface SupabaseAuthUserResponse {
  id?: string | null;
  aud?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: SupabaseAuthIdentity[] | null;
}

export interface SupabaseAuthenticatedUser {
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
  raw: SupabaseAuthUserResponse;
}

export interface SupabaseAuthRequest extends Request {
  supabaseUser?: SupabaseAuthenticatedUser | null;
  supabaseAccessToken?: string | null;
}
