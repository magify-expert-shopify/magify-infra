import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ContactsModule } from 'src/contacts/contacts.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProspectsModule } from 'src/prospects/prospects.module';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import {
  IMPORT_ANALYSIS_QUEUE,
  PROSPECT_EMAIL_SEND_QUEUE,
  PROSPECT_STATUS_RECALC_QUEUE,
  SCAN_LAUNCH_QUEUE,
  URL_LEAD_SCORE_RECALC_QUEUE,
} from 'src/queues/queue.constants';
import { ScanningModule } from 'src/scanning/scanning.module';
import { UrlsModule } from 'src/urls/urls.module';
import { BullBoardService } from './bull-board.service';
import { ImportEventsService } from './import-events.service';
import { ImportQueueBootstrapService } from './import-queue-bootstrap.service';
import { ImportsController } from './imports.controller';
import { ImportsProcessor } from './imports.processor';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => UrlsModule),
    forwardRef(() => ScanningModule),
    ContactsModule,
    ProspectsModule,
    SiteSettingsModule,
    BullModule.registerQueue({
      name: IMPORT_ANALYSIS_QUEUE,
    }),
    BullModule.registerQueue({
      name: PROSPECT_EMAIL_SEND_QUEUE,
    }),
    BullModule.registerQueue({
      name: PROSPECT_STATUS_RECALC_QUEUE,
    }),
    BullModule.registerQueue({
      name: URL_LEAD_SCORE_RECALC_QUEUE,
    }),
    BullModule.registerQueue({
      name: SCAN_LAUNCH_QUEUE,
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor, BullBoardService, ImportQueueBootstrapService, ImportEventsService],
  exports: [ImportsService, BullBoardService],
})
export class ImportsModule {}
