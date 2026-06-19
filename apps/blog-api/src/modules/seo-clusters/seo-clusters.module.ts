import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OpenAiPlatformModule } from '../openai-platform/openai-platform.module';
import { SeoClustersController } from './seo-clusters.controller';
import { SeoClustersService } from './seo-clusters.service';
import { SettingsModule } from '../admin/settings/settings.module';

@Module({
  imports: [PrismaModule, OpenAiPlatformModule, SettingsModule],
  controllers: [SeoClustersController],
  providers: [SeoClustersService],
  exports: [SeoClustersService],
})
export class SeoClustersModule {}
