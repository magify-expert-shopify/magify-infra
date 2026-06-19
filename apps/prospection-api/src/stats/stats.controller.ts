import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboard(@Query('range') range?: 'week' | 'month' | 'quarter' | 'year' | 'all') {
    return this.statsService.getDashboard(range);
  }
}
