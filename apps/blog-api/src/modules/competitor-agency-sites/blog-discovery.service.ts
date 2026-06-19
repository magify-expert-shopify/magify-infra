import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BlogArticleDiscoveryService } from '../blogs/blog-article-discovery.service';
import { BlogsService } from '../blogs/blogs.service';
import { extractCandidateBlogUrls } from '../../common/utils/discovery';
import { CompetitorAgencySitesService } from './competitor-agency-sites.service';
import { QueueJobService } from '../queues/queue-job.service';
import {
  BLOG_DISCOVERY_JOB,
  BLOG_DISCOVERY_QUEUE,
} from './competitor-agency-sites.constants';

type BlogDiscoveryJobData = {
  competitorAgencySiteId: string;
};

type DiscoveredBlogCandidate = {
  baseUrl: string;
  name: string;
};

@Injectable()
export class BlogDiscoveryService extends QueueJobService {
  private readonly logger = new Logger(BlogDiscoveryService.name);

  constructor(
    private readonly competitorAgencySitesService: CompetitorAgencySitesService,
    private readonly blogsService: BlogsService,
    private readonly blogArticleDiscoveryService: BlogArticleDiscoveryService,
    @InjectQueue(BLOG_DISCOVERY_QUEUE)
    private readonly blogDiscoveryQueue: Queue<BlogDiscoveryJobData>,
  ) {
    super();
  }

  async enqueueDiscovery(competitorAgencySiteId: string) {
    const jobId = `competitor-agency-site-${competitorAgencySiteId}`;
    return this.enqueueUniqueJob(
      this.blogDiscoveryQueue,
      BLOG_DISCOVERY_JOB,
      { competitorAgencySiteId },
      jobId,
    );
  }

  async enqueueDiscoveryMany(competitorAgencySiteIds: string[]) {
    return Promise.all(
      competitorAgencySiteIds.map((id) => this.enqueueDiscovery(id)),
    );
  }

  async discoverAndPersist(competitorAgencySiteId: string) {
    const site = await this.competitorAgencySitesService.findOne(
      competitorAgencySiteId,
    );
    const discoveredBlogs = await this.discoverBlogs(site.baseUrl);
    const blogs: Array<
      Awaited<ReturnType<BlogsService['findOrCreateDiscoveredBlog']>>
    > = [];
    const cascadedBlogJobs: Array<
      Awaited<ReturnType<BlogArticleDiscoveryService['enqueueDiscovery']>>
    > = [];

    for (const blog of discoveredBlogs) {
      const persistedBlog = await this.blogsService.findOrCreateDiscoveredBlog({
        competitorAgencySiteId: site.id,
        baseUrl: blog.baseUrl,
        name: blog.name,
      });

      blogs.push(persistedBlog);

      if (!persistedBlog.lastScannedAt) {
        const articleDiscoveryJob =
          await this.blogArticleDiscoveryService.enqueueDiscovery(
            persistedBlog.id,
          );

        cascadedBlogJobs.push(articleDiscoveryJob);
      }
    }

    const scannedSite = await this.competitorAgencySitesService.markAsScanned(
      site.id,
    );

    this.logger.log(
      `Discovered ${discoveredBlogs.length} blog candidate(s) for ${site.baseUrl}`,
    );

    return {
      competitorAgencySite: scannedSite,
      discoveredBlogs,
      blogs,
      cascadedBlogJobs,
      scannedAt: scannedSite.lastScannedAt,
    };
  }

  async discoverAndPersistMany(competitorAgencySiteIds: string[]) {
    return Promise.all(
      competitorAgencySiteIds.map((id) => this.discoverAndPersist(id)),
    );
  }

  private async discoverBlogs(baseUrl: string) {
    try {
      const response = await fetch(baseUrl);

      if (!response.ok) {
        return [];
      }

      const html = await response.text();
      const blogUrls = extractCandidateBlogUrls(baseUrl, html);

      return blogUrls.map((url) => ({
        baseUrl: url,
        name: this.deriveBlogName(url),
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to discover blogs for ${baseUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }
  private deriveBlogName(url: string) {
    const { pathname } = new URL(url);
    const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? 'blog';

    return lastSegment
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
