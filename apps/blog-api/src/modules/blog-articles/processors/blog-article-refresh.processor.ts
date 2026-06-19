import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  BLOG_ARTICLE_REFRESH_JOB,
  BLOG_ARTICLE_REFRESH_QUEUE,
} from '../blog-articles.constants';
import { BlogArticleRefreshService } from '../blog-article-refresh.service';

type BlogArticleRefreshJobData = {
  blogArticleId: string;
};

@Processor(BLOG_ARTICLE_REFRESH_QUEUE)
export class BlogArticleRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(BlogArticleRefreshProcessor.name);

  constructor(
    private readonly blogArticleRefreshService: BlogArticleRefreshService,
  ) {
    super();
  }

  async process(job: Job<BlogArticleRefreshJobData>) {
    if (job.name !== BLOG_ARTICLE_REFRESH_JOB) {
      this.logger.warn(`Skipping unsupported job ${job.name}`);
      return null;
    }

    return this.blogArticleRefreshService.refresh(job.data.blogArticleId);
  }
}
