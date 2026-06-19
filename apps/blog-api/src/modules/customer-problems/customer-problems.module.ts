import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { OpenAiPlatformModule } from '../openai-platform/openai-platform.module';
import { CustomerProblemsController } from './customer-problems.controller';
import { CustomerProblemsService } from './customer-problems.service';
import { SettingsModule } from '../admin/settings/settings.module';

@Module({
  imports: [PrismaModule, KeywordsModule, OpenAiPlatformModule, SettingsModule],
  controllers: [CustomerProblemsController],
  providers: [CustomerProblemsService],
  exports: [CustomerProblemsService],
})
export class CustomerProblemsModule {}
