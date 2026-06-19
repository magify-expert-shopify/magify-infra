import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCAN_LAUNCH_QUEUE } from 'src/queues/queue.constants';
import { ScanningService, type ScanLaunchJobData } from './scanning.service';

@Injectable()
@Processor(SCAN_LAUNCH_QUEUE, { concurrency: 1 })
export class ScanLaunchProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScanLaunchProcessor.name);

  constructor(private readonly scanningService: ScanningService) {
    super();
  }

  onApplicationBootstrap() {
    if (this.worker.isPaused()) {
      this.worker.resume();
      this.logger.log(`Worker "${SCAN_LAUNCH_QUEUE}" repris au demarrage.`);
    }
  }

  async process(job: Job<ScanLaunchJobData>) {
    try {
      return await this.scanningService.executeLaunchScansJob(job.data);
    } catch (error) {
      this.logger.error(
        `Erreur pendant le lancement du scan #${job.data.launchId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
