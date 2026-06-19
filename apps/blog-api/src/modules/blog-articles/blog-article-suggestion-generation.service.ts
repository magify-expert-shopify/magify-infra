import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BlogArticlesService } from './blog-articles.service';
import { QueueJobService } from '../queues/queue-job.service';
import {
  BLOG_ARTICLE_SUGGESTION_GENERATION_JOB,
  BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE,
} from './blog-articles.constants';

type BlogArticleSuggestionGenerationJobData = {
  pageId: string;
  pageUrl: string;
  projectId: string | null;
  clusterId: string | null;
  payload: Parameters<
    BlogArticlesService['generateBlogArticleDraftFromSuggestion']
  >[0];
};

export type { BlogArticleSuggestionGenerationJobData };

export type BlogArticleSuggestionGenerationJobSnapshot = {
  id: string | number | undefined;
  name: string;
  queueName: string;
  state: string;
  data: BlogArticleSuggestionGenerationJobData;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  delay: number;
};

@Injectable()
export class BlogArticleSuggestionGenerationService extends QueueJobService {
  private readonly logger = new Logger(
    BlogArticleSuggestionGenerationService.name,
  );

  constructor(
    private readonly blogArticlesService: BlogArticlesService,
    @InjectQueue(BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE)
    private readonly suggestionGenerationQueue: Queue<BlogArticleSuggestionGenerationJobData>,
  ) {
    super();
  }

  async enqueueGeneration(input: BlogArticleSuggestionGenerationJobData) {
    const jobId = `page-${input.pageId}`;

    return this.enqueueUniqueJob(
      this.suggestionGenerationQueue,
      BLOG_ARTICLE_SUGGESTION_GENERATION_JOB,
      input,
      jobId,
    );
  }

  async getJobSnapshotForPage(pageId: string) {
    const job = await this.suggestionGenerationQueue.getJob(`page-${pageId}`);

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      state: await job.getState(),
      data: job.data,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      delay: job.delay,
    } satisfies BlogArticleSuggestionGenerationJobSnapshot;
  }

  async generateAndPersist(input: BlogArticleSuggestionGenerationJobData) {
    const articleDraft =
      await this.blogArticlesService.generateBlogArticleDraftFromSuggestion(
        input.payload,
      );

    await this.blogArticlesService.createFromSuggestionDraft({
      pageId: input.pageId,
      pageUrl: input.pageUrl,
      projectId: input.projectId,
      clusterId: input.clusterId,
      draft: articleDraft,
    });

    this.logger.log(`Article generated for page ${input.pageId}`);
  }
}
