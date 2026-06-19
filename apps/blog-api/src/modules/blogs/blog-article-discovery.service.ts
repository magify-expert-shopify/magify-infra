import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BlogArticleRefreshService } from '../blog-articles/blog-article-refresh.service';
import { BlogArticlesService } from '../blog-articles/blog-articles.service';
import {
  extractCandidateArticleUrls,
  type DiscoveredArticleCandidate,
} from '../../common/utils/discovery';
import { BlogsService } from './blogs.service';
import { QueueJobService } from '../queues/queue-job.service';
import {
  BLOG_ARTICLE_DISCOVERY_JOB,
  BLOG_ARTICLE_DISCOVERY_QUEUE,
} from './blogs.constants';

type BlogArticleDiscoveryJobData = {
  blogId: string;
};

@Injectable()
export class BlogArticleDiscoveryService extends QueueJobService {
  private readonly logger = new Logger(BlogArticleDiscoveryService.name);

  constructor(
    private readonly blogsService: BlogsService,
    private readonly blogArticlesService: BlogArticlesService,
    private readonly blogArticleRefreshService: BlogArticleRefreshService,
    @InjectQueue(BLOG_ARTICLE_DISCOVERY_QUEUE)
    private readonly articleDiscoveryQueue: Queue<BlogArticleDiscoveryJobData>,
  ) {
    super();
  }

  async enqueueDiscovery(blogId: string) {
    const jobId = `blog-${blogId}`;
    return this.enqueueUniqueJob(
      this.articleDiscoveryQueue,
      BLOG_ARTICLE_DISCOVERY_JOB,
      { blogId },
      jobId,
    );
  }

  async enqueueDiscoveryMany(blogIds: string[]) {
    return Promise.all(blogIds.map((id) => this.enqueueDiscovery(id)));
  }

  async discoverAndPersist(blogId: string) {
    const blog = await this.blogsService.findOne(blogId);
    const discoveredArticles = await this.discoverArticles(blog.baseUrl);
    const articles: Array<
      Awaited<ReturnType<BlogArticlesService['findOrCreateDiscoveredArticle']>>
    > = [];
    const cascadedArticleJobs: Array<
      Awaited<ReturnType<BlogArticleRefreshService['enqueueRefresh']>>
    > = [];

    for (const article of discoveredArticles) {
      const persistedArticle =
        await this.blogArticlesService.findOrCreateDiscoveredArticle({
          blogId: blog.id,
          url: article.url,
          title: article.title,
          slug: article.slug,
        });

      articles.push(persistedArticle);

      if (!persistedArticle.lastScannedAt) {
        const articleRefreshJob =
          await this.blogArticleRefreshService.enqueueRefresh(
            persistedArticle.id,
          );

        cascadedArticleJobs.push(articleRefreshJob);
      }
    }

    const scannedBlog = await this.blogsService.markAsScanned(blog.id);

    this.logger.log(
      `Discovered ${discoveredArticles.length} article candidate(s) for ${blog.baseUrl}`,
    );

    return {
      blog: scannedBlog,
      discoveredArticles,
      articles,
      cascadedArticleJobs,
      scannedAt: scannedBlog.lastScannedAt,
    };
  }

  async discoverAndPersistMany(blogIds: string[]) {
    return Promise.all(blogIds.map((id) => this.discoverAndPersist(id)));
  }

  private async discoverArticles(baseUrl: string) {
    try {
      const response = await fetch(baseUrl);

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      return extractCandidateArticleUrls(baseUrl, html);
    } catch (error) {
      this.logger.warn(
        `Failed to discover articles for ${baseUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }
}
