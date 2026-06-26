import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DailyProspectCountTask } from './tasks/daily-prospect-count.task';

const DEFAULT_CRON_HOUR = 9;

@Injectable()
export class CronService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CronService.name);
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly dailyProspectCountTask: DailyProspectCountTask) {}

  async onApplicationBootstrap() {
    await this.scheduleNextRun();
  }

  async onApplicationShutdown() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private getNextRunAtNine(date = new Date()) {
    const next = new Date(date);
    next.setHours(DEFAULT_CRON_HOUR, 0, 0, 0);

    if (next.getTime() <= date.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private async scheduleNextRun() {
    const now = new Date();
    const nextRunAt = this.getNextRunAtNine(now);
    const delay = Math.max(1_000, nextRunAt.getTime() - now.getTime());

    this.logger.log(`Prochaine tâche CRON à ${nextRunAt.toISOString()} (${Math.round(delay / 1000)}s).`);

    this.timeout = setTimeout(async () => {
      try {
        await this.dailyProspectCountTask.run();
      } catch (error) {
        this.logger.error(
          'La tâche CRON quotidienne a échoué.',
          error instanceof Error ? error.stack : undefined,
        );
      } finally {
        void this.scheduleNextRun();
      }
    }, delay);
  }
}
