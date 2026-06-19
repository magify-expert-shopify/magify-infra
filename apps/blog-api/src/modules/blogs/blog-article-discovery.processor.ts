import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BlogArticleDiscoveryService } from './blog-article-discovery.service';
import {
  BLOG_ARTICLE_DISCOVERY_JOB,
  BLOG_ARTICLE_DISCOVERY_QUEUE,
} from './blogs.constants';

type BlogArticleDiscoveryJobData = {
  blogId: string;
};

@Processor(BLOG_ARTICLE_DISCOVERY_QUEUE)
export class BlogArticleDiscoveryProcessor extends WorkerHost {
  constructor(
    private readonly blogArticleDiscoveryService: BlogArticleDiscoveryService,
  ) {
    super();
  }

  async process(job: Job<BlogArticleDiscoveryJobData>) {
    if (job.name !== BLOG_ARTICLE_DISCOVERY_JOB) {
      return;
    }

    await this.blogArticleDiscoveryService.discoverAndPersist(job.data.blogId);
  }
}
