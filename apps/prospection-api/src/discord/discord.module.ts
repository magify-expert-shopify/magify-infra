import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { forwardRef } from '@nestjs/common';
import { ProspectsModule } from 'src/prospects/prospects.module';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import { ScanningModule } from 'src/scanning/scanning.module';
import { UrlsModule } from 'src/urls/urls.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [
    ConfigModule,
    SiteSettingsModule,
    forwardRef(() => UrlsModule),
    forwardRef(() => ProspectsModule),
    forwardRef(() => ScanningModule),
  ],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
