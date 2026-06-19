import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseAuthController } from './supabase-auth.controller';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [ConfigModule],
  controllers: [SupabaseAuthController],
  providers: [SupabaseAuthService, SupabaseAuthGuard],
  exports: [SupabaseAuthService, SupabaseAuthGuard],
})
export class SupabaseAuthModule {}
