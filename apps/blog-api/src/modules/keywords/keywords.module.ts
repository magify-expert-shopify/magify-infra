import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OpenAiPlatformModule } from '../openai-platform/openai-platform.module';
import { SupabaseAuthModule } from '../auth/supabase-auth/supabase-auth.module';
import { GoogleKeywordSuggestionsService } from './services/google-keyword-suggestions.service';
import { KeywordGroupService } from './services/keyword-group.service';
import { KeywordGroupingService } from './services/keyword-grouping.service';
import { KeywordSiteVisibilityService } from './services/keyword-site-visibility.service';
import { KeywordController } from './keyword.controller';
import { KeywordService } from './services/keyword.service';
import { SettingsModule } from '../admin/settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    OpenAiPlatformModule,
    forwardRef(() => SettingsModule),
    SupabaseAuthModule,
  ],
  controllers: [KeywordController],
  providers: [
    KeywordService,
    GoogleKeywordSuggestionsService,
    KeywordGroupService,
    KeywordGroupingService,
    KeywordSiteVisibilityService,
  ],
  exports: [KeywordService],
})
export class KeywordsModule {}
