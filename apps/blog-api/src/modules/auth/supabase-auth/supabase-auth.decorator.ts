import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SupabaseAuthRequest, SupabaseAuthenticatedUser } from './supabase-auth.types';

export const SupabaseUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SupabaseAuthenticatedUser | null => {
    const request = context.switchToHttp().getRequest<SupabaseAuthRequest>();

    return request.supabaseUser ?? null;
  },
);
