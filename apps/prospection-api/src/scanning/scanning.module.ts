import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ContactsModule } from 'src/contacts/contacts.module';
import { LighthouseModule } from 'src/lighthouse/lighthouse.module';
import { SCAN_LAUNCH_QUEUE } from 'src/queues/queue.constants';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import { UrlsModule } from 'src/urls/urls.module';
import { ScanningController } from './scanning.controller';
import { ScanLaunchBootstrapService } from './scan-launch-bootstrap.service';
import { ScanLaunchProcessor } from './scan-launch.processor';
import { ScanningService } from './scanning.service';

@Module({
  imports: [
    forwardRef(() => UrlsModule),
    forwardRef(() => ContactsModule),
    LighthouseModule,
    SiteSettingsModule,
    BullModule.registerQueue({
      name: SCAN_LAUNCH_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  controllers: [ScanningController],
  providers: [ScanningService, ScanLaunchProcessor, ScanLaunchBootstrapService],
  exports: [ScanningService],
})
export class ScanningModule {}
