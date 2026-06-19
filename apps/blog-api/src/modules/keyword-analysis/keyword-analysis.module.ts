import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { OpenAiPlatformModule } from '../openai-platform/openai-platform.module';
import { SettingsModule } from '../admin/settings/settings.module';
import { KeywordAnalysisController } from './keyword-analysis.controller';
import { KeywordAnalysisService } from './keyword-analysis.service';
import { DataForSeoService } from './dataforseo.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    KeywordsModule,
    OpenAiPlatformModule,
    SettingsModule,
  ],
  controllers: [KeywordAnalysisController],
  providers: [KeywordAnalysisService, DataForSeoService],
  exports: [KeywordAnalysisService, DataForSeoService],
})
export class KeywordAnalysisModule {}
