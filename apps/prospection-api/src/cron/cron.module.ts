import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DailyProspectCountTask } from './tasks/daily-prospect-count.task';
import { CronService } from './cron.service';

@Module({
  imports: [PrismaModule],
  providers: [CronService, DailyProspectCountTask],
})
export class CronModule {}
