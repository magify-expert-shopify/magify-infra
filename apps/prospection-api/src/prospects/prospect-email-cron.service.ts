import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PROSPECT_EMAIL_SEND_QUEUE } from 'src/queues/queue.constants';
import { ProspectEmailScheduleService } from './prospect-email-schedule.service';

@Injectable()
export class ProspectEmailCronService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProspectEmailCronService.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastStatusSignature: string | null = null;

  constructor(
    private readonly prospectEmailScheduleService: ProspectEmailScheduleService,
    @InjectQueue(PROSPECT_EMAIL_SEND_QUEUE)
    private readonly prospectEmailQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.syncWindow();

    this.interval = setInterval(() => {
      void this.syncWindow();
    }, 60_000);
  }

  async onApplicationShutdown() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async syncWindow() {
    try {
      const status = await this.prospectEmailScheduleService.getStatus();
      const isQueuePaused = await this.prospectEmailQueue.isPaused();
      const queueCounts = await this.prospectEmailQueue.getJobCounts('waiting', 'active', 'delayed', 'paused');
      const statusSignature = JSON.stringify({
        canSendNow: status.canSendNow,
        isBusinessDay: status.isBusinessDay,
        isAfterScheduleHour: status.isAfterScheduleHour,
        isBeforeSendUntilHour: status.isBeforeSendUntilHour,
        todaySent: status.todaySent,
        todayReserved: status.todayReserved,
        dailyLimit: status.settings.dailyLimit,
        queuePaused: isQueuePaused,
        waiting: queueCounts.waiting,
        active: queueCounts.active,
        delayed: queueCounts.delayed,
      });
      const shouldLog = statusSignature !== this.lastStatusSignature;
      this.lastStatusSignature = statusSignature;

      if (!status.canSendNow) {
        if (!isQueuePaused) {
          await this.prospectEmailQueue.pause();
        }

        if (shouldLog) {
          this.logger.log(
            `Envoi des emails en attente. Jour ouvré: ${status.isBusinessDay ? 'oui' : 'non'}, heure de début atteinte: ${status.isAfterScheduleHour ? 'oui' : 'non'}, avant heure max: ${status.isBeforeSendUntilHour ? 'oui' : 'non'}, envoyés aujourd’hui: ${status.todaySent}/${status.settings.dailyLimit}, réservés: ${status.todayReserved}, file waiting/active/delayed: ${queueCounts.waiting}/${queueCounts.active}/${queueCounts.delayed}.`,
          );
        }
        return;
      }

      if (isQueuePaused) {
        await this.prospectEmailQueue.resume();
      }

      const promotableCount = Math.max(
        0,
        Math.min(
          status.remainingToday,
          queueCounts.delayed,
          status.remainingToday - queueCounts.waiting - queueCounts.active,
        ),
      );

      if (promotableCount > 0) {
        await this.prospectEmailQueue.promoteJobs({ count: promotableCount });
      }

      if (shouldLog || promotableCount > 0) {
        this.logger.log(
          `Envoi des emails activé pour aujourd’hui: ${status.todaySent}/${status.settings.dailyLimit} envoyés, réservés: ${status.todayReserved}, file waiting/active/delayed: ${queueCounts.waiting}/${queueCounts.active}/${queueCounts.delayed}, delayed réactivés: ${promotableCount}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Impossible de synchroniser le cron des emails.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
