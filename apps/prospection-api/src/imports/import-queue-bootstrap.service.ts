import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { IMPORT_ANALYSIS_QUEUE } from 'src/queues/queue.constants';
import type { ImportAnalysisJobData } from './imports.processor';

@Injectable()
export class ImportQueueBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ImportQueueBootstrapService.name);

  constructor(
    @InjectQueue(IMPORT_ANALYSIS_QUEUE)
    private readonly importAnalysisQueue: Queue<ImportAnalysisJobData>,
  ) {}

  async onApplicationBootstrap() {
    const counts = await this.importAnalysisQueue.getJobCounts(
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

    if (await this.importAnalysisQueue.isPaused()) {
      await this.importAnalysisQueue.resume();
      this.logger.log(`Queue "${IMPORT_ANALYSIS_QUEUE}" reprise au demarrage.`);
    }

    if (pendingJobs > 0) {
      this.logger.log(
        `Queue "${IMPORT_ANALYSIS_QUEUE}" prete: ${pendingJobs} job(s) en attente, ${counts.active || 0} actif(s).`,
      );
    }
  }
}
