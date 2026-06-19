import { Controller, Get, Query } from '@nestjs/common';
import { QueueDashboardService } from '../queues/queue-dashboard.service';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly queueDashboardService: QueueDashboardService,
    private readonly statsService: StatsService,
  ) {}

  @Get('queues')
  getQueueDashboard() {
    return this.queueDashboardService.getQueueDashboard();
  }

  @Get('counts')
  getCounts() {
    return this.statsService.getCounts();
  }

  @Get('seo-kpis')
  getSeoKpis(@Query('range') range?: string) {
    return this.statsService.getSeoKpis(range);
  }

  @Get('business-kpis')
  getBusinessKpis() {
    return this.statsService.getBusinessKpis();
  }

  @Get('current-goal')
  getCurrentGoalProgress() {
    return this.statsService.getCurrentGoalProgress();
  }

  @Get('openai-usage')
  getOpenAiUsage(@Query('range') range?: string) {
    return this.statsService.getOpenAiUsage(range);
  }
}
