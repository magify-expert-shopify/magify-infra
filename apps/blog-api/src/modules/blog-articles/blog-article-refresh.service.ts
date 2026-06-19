import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { extractArticleMetadata } from '../../common/utils/article-metadata';
import { AuthorsService } from '../authors/authors.service';
import { BlogArticlesService } from './blog-articles.service';
import { QueueJobService } from '../queues/queue-job.service';
import {
  BLOG_ARTICLE_REFRESH_JOB,
  BLOG_ARTICLE_REFRESH_QUEUE,
} from './blog-articles.constants';

type BlogArticleRefreshJobData = {
  blogArticleId: string;
};

@Injectable()
export class BlogArticleRefreshService extends QueueJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blogArticlesService: BlogArticlesService,
    private readonly authorsService: AuthorsService,
    @InjectQueue(BLOG_ARTICLE_REFRESH_QUEUE)
    private readonly blogArticleRefreshQueue: Queue<BlogArticleRefreshJobData>,
  ) {
    super();
  }

  async enqueueRefresh(id: string) {
    await this.blogArticlesService.findOne(id);
    const jobId = `blog-article-${id}`;
    return this.enqueueUniqueJob(
      this.blogArticleRefreshQueue,
      BLOG_ARTICLE_REFRESH_JOB,
      { blogArticleId: id },
      jobId,
    );
  }

  async enqueueRefreshMany(ids: string[]) {
    return Promise.all(ids.map((id) => this.enqueueRefresh(id)));
  }

  async refreshMany(ids: string[]) {
    return Promise.all(ids.map((id) => this.refresh(id)));
  }

  async refresh(id: string) {
    const article = await this.blogArticlesService.findOne(id);
    const scannedAt = new Date();

    if (!article.url) {
      return await this.persistRefresh(article.id, {
        lastScannedAt: scannedAt,
      });
    }

    try {
      const response = await fetch(article.url);

      if (!response.ok) {
        return await this.persistRefresh(article.id, {
          lastScannedAt: scannedAt,
        });
      }

      const html = await response.text();
      const metadata = extractArticleMetadata(html, article.url);
      const author = metadata.authorName
        ? await this.authorsService.findOrCreate({
            name: metadata.authorName,
            profileUrl: metadata.authorProfileUrl,
            avatarUrl: metadata.authorAvatarUrl,
          })
        : null;

      return await this.persistRefresh(article.id, {
        title: metadata.title || article.title,
        excerpt: metadata.excerpt,
        content: metadata.content,
        slug: metadata.slug || article.slug,
        publishedAt: metadata.publishedAt,
        authorId: author?.id ?? article.authorId ?? null,
        lastScannedAt: scannedAt,
      });
    } catch {
      return await this.persistRefresh(article.id, {
        lastScannedAt: scannedAt,
      });
    }
  }

  private async persistRefresh(
    id: string,
    data: {
      title?: string;
      excerpt?: string | null;
      content?: string | null;
      slug?: string | null;
      publishedAt?: Date | null;
      authorId?: string | null;
      lastScannedAt: Date;
    },
  ) {
    return (this.prisma as any).blogArticle.update({
      where: { id },
      data,
      include: {
        blog: true,
        author: true,
      },
    });
  }
}
