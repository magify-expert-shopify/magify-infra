import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BLOG_ARTICLE_REFRESH_QUEUE } from '../blog-articles/blog-articles.constants';
import { BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE } from '../blog-articles/blog-articles.constants';
import { BLOG_ARTICLE_DISCOVERY_QUEUE } from '../blogs/blogs.constants';
import { BLOG_DISCOVERY_QUEUE } from '../competitor-agency-sites/competitor-agency-sites.constants';

@Injectable()
export class QueueDashboardService {
  constructor(
    @InjectQueue(BLOG_DISCOVERY_QUEUE)
    private readonly blogDiscoveryQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_DISCOVERY_QUEUE)
    private readonly blogArticleDiscoveryQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_REFRESH_QUEUE)
    private readonly blogArticleRefreshQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE)
    private readonly blogArticleSuggestionGenerationQueue: Queue,
  ) {}

  async getQueueDashboard() {
    const queues = await Promise.all([
      this.getQueueSnapshot(this.blogDiscoveryQueue, 'Blog Discovery'),
      this.getQueueSnapshot(
        this.blogArticleDiscoveryQueue,
        'Blog Article Discovery',
      ),
      this.getQueueSnapshot(
        this.blogArticleRefreshQueue,
        'Blog Article Refresh',
      ),
      this.getQueueSnapshot(
        this.blogArticleSuggestionGenerationQueue,
        'Blog Article Suggestion Generation',
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      queues,
    };
  }

  private async getQueueSnapshot(queue: Queue, label: string) {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    const jobs = await queue.getJobs(
      ['active', 'waiting', 'delayed'],
      0,
      20,
      true,
    );

    return {
      name: queue.name,
      label,
      counts,
      jobs: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        delay: job.delay,
      })),
    };
  }
}
