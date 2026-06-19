import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BlogDiscoveryService } from './blog-discovery.service';
import {
  BLOG_DISCOVERY_JOB,
  BLOG_DISCOVERY_QUEUE,
} from './competitor-agency-sites.constants';

type BlogDiscoveryJobData = {
  competitorAgencySiteId: string;
};

@Processor(BLOG_DISCOVERY_QUEUE)
export class BlogDiscoveryProcessor extends WorkerHost {
  constructor(private readonly blogDiscoveryService: BlogDiscoveryService) {
    super();
  }

  async process(job: Job<BlogDiscoveryJobData>) {
    if (job.name !== BLOG_DISCOVERY_JOB) {
      return;
    }

    await this.blogDiscoveryService.discoverAndPersist(
      job.data.competitorAgencySiteId,
    );
  }
}
