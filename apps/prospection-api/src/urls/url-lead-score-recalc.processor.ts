import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bullmq';
import { URL_LEAD_SCORE_RECALC_QUEUE } from 'src/queues/queue.constants';
import { UrlsService } from './urls.service';

export type UrlLeadScoreRecalcJobData = {
  runId: number;
  urlId: number;
  position: number;
  total: number;
};

@Injectable()
@Processor(URL_LEAD_SCORE_RECALC_QUEUE, { concurrency: 1 })
export class UrlLeadScoreRecalcProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(UrlLeadScoreRecalcProcessor.name);

  constructor(private readonly urlsService: UrlsService) {
    super();
  }

  onApplicationBootstrap() {
    if (this.worker.isPaused()) {
      this.worker.resume();
      this.logger.log(`Worker "${URL_LEAD_SCORE_RECALC_QUEUE}" repris au demarrage.`);
    }
  }

  async process(job: Job<UrlLeadScoreRecalcJobData>) {
    await this.urlsService.markLeadScoreRecalcJobStarted(job.data.runId, job.data.urlId);

    try {
      await this.urlsService.recalculateLeadScoreFromUrlId(job.data.urlId);
      await this.urlsService.markLeadScoreRecalcJobFinished(job.data.runId);

      return {
        urlId: job.data.urlId,
        processed: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';

      await this.urlsService.markLeadScoreRecalcJobFinished(job.data.runId, message);

      this.logger.error(
        `Échec du recalcul du score pour l'URL #${job.data.urlId} (run #${job.data.runId})`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        urlId: job.data.urlId,
        processed: false,
        reason: message,
      };
    }
  }
}
