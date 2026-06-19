import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [PrismaModule, SiteSettingsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
