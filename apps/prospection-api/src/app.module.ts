import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UrlsModule } from './urls/urls.module';
import { ScanningModule } from './scanning/scanning.module';
import { ContactsModule } from './contacts/contacts.module';
import { ProspectsModule } from './prospects/prospects.module';
import { ImportsModule } from './imports/imports.module';
import { LighthouseModule } from './lighthouse/lighthouse.module';
import { GoogleModule } from './google/google.module';
import { SiteSettingsModule } from './site-settings/site-settings.module';
import { StatsModule } from './stats/stats.module';
import { createBullMqConnection } from './queues/redis-connection';
import { DiscordModule } from './discord/discord.module';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: createBullMqConnection(),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    PrismaModule,
    UrlsModule,
    ScanningModule,
    ContactsModule,
    ProspectsModule,
    ImportsModule,
    LighthouseModule,
    GoogleModule,
    SiteSettingsModule,
    StatsModule,
    DiscordModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
