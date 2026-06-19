import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { GoogleAuthModule } from '../auth/google-auth/google-auth.module';
import { GoogleBusinessKpisService } from './google-business-kpis.service';
import { GoogleSeoKpisService } from './google-seo-kpis.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ConfigModule, QueuesModule, PrismaModule, GoogleAuthModule],
  controllers: [StatsController],
  providers: [StatsService, GoogleSeoKpisService, GoogleBusinessKpisService],
  exports: [GoogleSeoKpisService],
})
export class StatsModule {}
