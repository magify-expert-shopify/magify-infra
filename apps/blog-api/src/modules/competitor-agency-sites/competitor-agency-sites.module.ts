import { Module } from '@nestjs/common';
import { CompetitorAgencySitesController } from './competitor-agency-sites.controller';
import { BlogDiscoveryService } from './blog-discovery.service';
import { CompetitorAgencySitesService } from './competitor-agency-sites.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BlogsModule } from '../blogs/blogs.module';
import { BlogDiscoveryProcessor } from './blog-discovery.processor';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [PrismaModule, BlogsModule, QueuesModule],
  controllers: [CompetitorAgencySitesController],
  providers: [
    CompetitorAgencySitesService,
    BlogDiscoveryService,
    BlogDiscoveryProcessor,
  ],
  exports: [CompetitorAgencySitesService, BlogDiscoveryService],
})
export class CompetitorAgencySitesModule {}
