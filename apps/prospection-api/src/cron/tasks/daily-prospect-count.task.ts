import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DailyProspectCountTask {
  private readonly logger = new Logger(DailyProspectCountTask.name);

  constructor(private readonly prisma: PrismaService) {}

  async run() {
    const totalProspects = await this.prisma.prospect.count({
      where: {
        trashedAt: null,
      },
    });

    this.logger.log(`Hello world CRON: ${totalProspects} prospect(s) actifs dans la BDD prospection.`);

    return {
      totalProspects,
    };
  }
}
