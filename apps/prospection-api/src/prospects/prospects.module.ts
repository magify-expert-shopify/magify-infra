import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { ContactsModule } from 'src/contacts/contacts.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { PROSPECT_EMAIL_SEND_QUEUE, PROSPECT_STATUS_RECALC_QUEUE } from 'src/queues/queue.constants';
import { SiteSettingsModule } from 'src/site-settings/site-settings.module';
import { UrlsModule } from 'src/urls/urls.module';
import { ProspectStatusRecalcBootstrapService } from './prospect-status-recalc-bootstrap.service';
import { ProspectStatusRecalcEventsService } from './prospect-status-recalc-events.service';
import { ProspectStatusRecalcProcessor } from './prospect-status-recalc.processor';
import { ProspectsController } from './prospects.controller';
import { ProspectEmailCronService } from './prospect-email-cron.service';
import { ProspectEmailProcessor } from './prospect-email.processor';
import { ProspectEmailScheduleService } from './prospect-email-schedule.service';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    SiteSettingsModule,
    forwardRef(() => ContactsModule),
    forwardRef(() => UrlsModule),
    BullModule.registerQueue({
      name: PROSPECT_EMAIL_SEND_QUEUE,
    }),
    BullModule.registerQueue({
      name: PROSPECT_STATUS_RECALC_QUEUE,
    }),
  ],
  controllers: [ProspectsController],
  providers: [
    ProspectsService,
    ProspectEmailProcessor,
    ProspectEmailCronService,
    ProspectEmailScheduleService,
    ProspectStatusRecalcProcessor,
    ProspectStatusRecalcEventsService,
    ProspectStatusRecalcBootstrapService,
  ],
  exports: [ProspectsService],
})
export class ProspectsModule {}
