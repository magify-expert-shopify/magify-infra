import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job } from 'bullmq';
import { PROSPECT_STATUS_RECALC_QUEUE } from 'src/queues/queue.constants';
import { ProspectsService } from './prospects.service';

export type ProspectStatusRecalcJobData = {
  runId: number;
  prospectId: number;
  position: number;
  total: number;
};

@Injectable()
@Processor(PROSPECT_STATUS_RECALC_QUEUE, { concurrency: 1 })
export class ProspectStatusRecalcProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProspectStatusRecalcProcessor.name);

  constructor(private readonly prospectsService: ProspectsService) {
    super();
  }

  onApplicationBootstrap() {
    if (this.worker.isPaused()) {
      this.worker.resume();
      this.logger.log(`Worker "${PROSPECT_STATUS_RECALC_QUEUE}" repris au demarrage.`);
    }
  }

  async process(job: Job<ProspectStatusRecalcJobData>) {
    await this.prospectsService.markProspectStatusRecalcJobStarted(job.data.runId, job.data.prospectId);

    try {
      await this.prospectsService.recalculateProspectStatusFromProspectId(job.data.prospectId);
      await this.prospectsService.markProspectStatusRecalcJobFinished(job.data.runId);

      return {
        prospectId: job.data.prospectId,
        processed: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';

      await this.prospectsService.markProspectStatusRecalcJobFinished(job.data.runId, message);

      this.logger.error(
        `Échec du recalcul du statut pour le prospect #${job.data.prospectId} (run #${job.data.runId})`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        prospectId: job.data.prospectId,
        processed: false,
        reason: message,
      };
    }
  }
}
