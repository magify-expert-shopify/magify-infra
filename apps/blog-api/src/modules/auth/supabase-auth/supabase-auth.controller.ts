import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseUser } from './supabase-auth.decorator';
import type { SupabaseAuthenticatedUser } from './supabase-auth.types';
import { mapSupabaseAuthenticatedUserToMeUser } from './supabase-auth.mapper';

@Controller('supabase-auth')
export class SupabaseAuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  me(@SupabaseUser() user: SupabaseAuthenticatedUser | null) {
    return {
      user: mapSupabaseAuthenticatedUserToMeUser(user),
    };
  }
}
