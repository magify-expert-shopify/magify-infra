import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PROSPECT_STATUS_RECALC_QUEUE } from 'src/queues/queue.constants';
import type { ProspectStatusRecalcJobData } from './prospect-status-recalc.processor';

@Injectable()
export class ProspectStatusRecalcBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProspectStatusRecalcBootstrapService.name);

  constructor(
    @InjectQueue(PROSPECT_STATUS_RECALC_QUEUE)
    private readonly prospectStatusRecalcQueue: Queue<ProspectStatusRecalcJobData>,
  ) {}

  async onApplicationBootstrap() {
    const counts = await this.prospectStatusRecalcQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'paused',
      'failed',
    );
    const pendingJobs =
      (counts.waiting || 0)
      + (counts.delayed || 0)
      + (counts.paused || 0);

    if (await this.prospectStatusRecalcQueue.isPaused()) {
      await this.prospectStatusRecalcQueue.resume();
      this.logger.log(`Queue "${PROSPECT_STATUS_RECALC_QUEUE}" reprise au demarrage.`);
    }

    if (pendingJobs > 0) {
      this.logger.log(
        `Queue "${PROSPECT_STATUS_RECALC_QUEUE}" prete: ${pendingJobs} job(s) en attente, ${counts.active || 0} actif(s).`,
      );
    }
  }
}
