import { forwardRef, Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsPromptConfigsService } from './settings-prompt-configs.service';
import { SettingsService } from './settings.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ShopifyModule } from 'src/modules/shopify/shopify.module';
import { GoogleAuthModule } from 'src/modules/auth/google-auth/google-auth.module';
import { DiscordBotModule } from 'src/modules/discord-bot/discord-bot.module';
import { MailModule } from 'src/modules/mail/mail.module';
import { OpenAiPlatformModule } from 'src/modules/openai-platform/openai-platform.module';
import { KeywordsModule } from 'src/modules/keywords/keywords.module';
import { SupabaseAuthModule } from 'src/modules/auth/supabase-auth/supabase-auth.module';

@Module({
  imports: [
    PrismaModule,
    ShopifyModule,
    GoogleAuthModule,
    DiscordBotModule,
    MailModule,
    forwardRef(() => KeywordsModule),
    OpenAiPlatformModule,
    SupabaseAuthModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsPromptConfigsService],
  exports: [SettingsService, SettingsPromptConfigsService],
})
export class SettingsModule {}
