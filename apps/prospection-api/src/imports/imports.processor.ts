import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bullmq';
import { IMPORT_ANALYSIS_QUEUE } from 'src/queues/queue.constants';
import { ImportsService } from './imports.service';

export type ImportAnalysisJobData = {
  batchId: number;
  urlId: number;
  position: number;
  total: number;
  rescan?: boolean;
};

@Injectable()
@Processor(IMPORT_ANALYSIS_QUEUE, { concurrency: 1 })
export class ImportsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(private readonly importsService: ImportsService) {
    super();
  }

  onApplicationBootstrap() {
    if (this.worker.isPaused()) {
      this.worker.resume();
      this.logger.log(`Worker "${IMPORT_ANALYSIS_QUEUE}" repris au demarrage.`);
    }
  }

  async process(job: Job<ImportAnalysisJobData>) {
    try {
      if (job.data.rescan) {
        return await this.importsService.processRescanQueuedUrl(job.data);
      }

      return await this.importsService.processQueuedImportUrl(job.data);
    } catch (error) {
      this.logger.error(
        `Erreur pendant le traitement de l'import #${job.data.batchId} pour l'URL #${job.data.urlId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
