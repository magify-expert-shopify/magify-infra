import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';
import type { SupabaseAuthRequest } from './supabase-auth.types';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuthService: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SupabaseAuthRequest>();
    const supabaseUser =
      await this.supabaseAuthService.getUserFromRequest(request);

    if (!supabaseUser) {
      throw new UnauthorizedException('Supabase authentication required');
    }

    request.supabaseUser = supabaseUser;
    request.supabaseAccessToken =
      this.supabaseAuthService.extractBearerToken(
        request.headers.authorization ?? null,
      );

    return true;
  }
}
