import type { SupabaseAuthenticatedUser } from '../modules/supabase-auth/supabase-auth.types';

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseAuthenticatedUser | null;
      supabaseAccessToken?: string | null;
    }
  }
}

export {};
