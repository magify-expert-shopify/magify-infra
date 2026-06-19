import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ProspectsModule } from 'src/prospects/prospects.module';
import { URL_LEAD_SCORE_RECALC_QUEUE } from 'src/queues/queue.constants';
import { ScanningModule } from 'src/scanning/scanning.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import { UrlLeadScoreRecalcEventsService } from './url-lead-score-recalc-events.service';
import { UrlLeadScoreRecalcBootstrapService } from './url-lead-score-recalc-bootstrap.service';
import { UrlLeadScoreRecalcProcessor } from './url-lead-score-recalc.processor';
import { UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ScanningModule),
    forwardRef(() => ProspectsModule),
    SiteSettingsModule,
    BullModule.registerQueue({
      name: URL_LEAD_SCORE_RECALC_QUEUE,
    }),
  ],
  controllers: [UrlsController],
  providers: [
    UrlsService,
    UrlLeadScoreRecalcEventsService,
    UrlLeadScoreRecalcProcessor,
    UrlLeadScoreRecalcBootstrapService,
  ],
  exports: [UrlsService],
})
export class UrlsModule {}
