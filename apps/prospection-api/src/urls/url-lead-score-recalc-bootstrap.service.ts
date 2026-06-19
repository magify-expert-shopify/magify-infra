import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { URL_LEAD_SCORE_RECALC_QUEUE } from 'src/queues/queue.constants';
import type { UrlLeadScoreRecalcJobData } from './url-lead-score-recalc.processor';

@Injectable()
export class UrlLeadScoreRecalcBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UrlLeadScoreRecalcBootstrapService.name);

  constructor(
    @InjectQueue(URL_LEAD_SCORE_RECALC_QUEUE)
    private readonly urlLeadScoreRecalcQueue: Queue<UrlLeadScoreRecalcJobData>,
  ) {}

  async onApplicationBootstrap() {
    const counts = await this.urlLeadScoreRecalcQueue.getJobCounts(
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

    if (await this.urlLeadScoreRecalcQueue.isPaused()) {
      await this.urlLeadScoreRecalcQueue.resume();
      this.logger.log(`Queue "${URL_LEAD_SCORE_RECALC_QUEUE}" reprise au demarrage.`);
    }

    if (pendingJobs > 0) {
      this.logger.log(
        `Queue "${URL_LEAD_SCORE_RECALC_QUEUE}" prete: ${pendingJobs} job(s) en attente, ${counts.active || 0} actif(s).`,
      );
    }
  }
}
