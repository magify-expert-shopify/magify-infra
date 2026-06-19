import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SCAN_LAUNCH_QUEUE } from 'src/queues/queue.constants';
import type { ScanLaunchJobData } from './scanning.service';

@Injectable()
export class ScanLaunchBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScanLaunchBootstrapService.name);

  constructor(
    @InjectQueue(SCAN_LAUNCH_QUEUE)
    private readonly scanLaunchQueue: Queue<ScanLaunchJobData>,
  ) {}

  async onApplicationBootstrap() {
    const counts = await this.scanLaunchQueue.getJobCounts(
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

    if (await this.scanLaunchQueue.isPaused()) {
      await this.scanLaunchQueue.resume();
      this.logger.log(`Queue "${SCAN_LAUNCH_QUEUE}" reprise au demarrage.`);
    }

    if (pendingJobs > 0) {
      this.logger.log(
        `Queue "${SCAN_LAUNCH_QUEUE}" prete: ${pendingJobs} job(s) en attente, ${counts.active || 0} actif(s).`,
      );
    }
  }
}
