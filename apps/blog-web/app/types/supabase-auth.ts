export type SupabaseAuthIdentity = {
  provider?: string | null;
};

export type SupabaseAuthUser = {
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

export type SupabaseAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string | null;
  user: SupabaseAuthUser;
};

export type SupabaseAuthState = {
  session: SupabaseAuthSession | null;
  user: SupabaseAuthUser | null;
};
