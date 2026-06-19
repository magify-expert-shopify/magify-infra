import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BLOG_ARTICLE_REFRESH_QUEUE } from '../blog-articles/blog-articles.constants';
import { BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE } from '../blog-articles/blog-articles.constants';
import { BLOG_ARTICLE_DISCOVERY_QUEUE } from '../blogs/blogs.constants';
import { BLOG_DISCOVERY_QUEUE } from '../competitor-agency-sites/competitor-agency-sites.constants';
import { QueueDashboardService } from './queue-dashboard.service';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: BLOG_DISCOVERY_QUEUE,
      },
      {
        name: BLOG_ARTICLE_DISCOVERY_QUEUE,
      },
      {
        name: BLOG_ARTICLE_REFRESH_QUEUE,
      },
      {
        name: BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE,
      },
    ),
  ],
  providers: [QueueDashboardService],
  exports: [QueueDashboardService, BullModule],
})
export class QueuesModule {}
