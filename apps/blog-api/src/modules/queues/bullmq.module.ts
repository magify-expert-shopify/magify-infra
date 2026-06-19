import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import {
  BULLMQ_HOST,
  BULLMQ_PASSWORD,
  BULLMQ_PORT,
} from 'src/config/env.config';
import { QueuesModule } from 'src/modules/queues/queues.module';
import { BullBoardService } from './bullboard.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: BULLMQ_HOST,
        port: BULLMQ_PORT,
        password: BULLMQ_PASSWORD,
      },
    }),
    QueuesModule,
  ],
  providers: [BullBoardService],

  exports: [BullModule, BullBoardService],
})
export class BullMqModule {}
