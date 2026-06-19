import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  BlogArticleSuggestionGenerationService,
  type BlogArticleSuggestionGenerationJobData,
} from '../blog-article-suggestion-generation.service';
import {
  BLOG_ARTICLE_SUGGESTION_GENERATION_JOB,
  BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE,
} from '../blog-articles.constants';

@Processor(BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE)
export class BlogArticleSuggestionGenerationProcessor extends WorkerHost {
  constructor(
    private readonly blogArticleSuggestionGenerationService: BlogArticleSuggestionGenerationService,
  ) {
    super();
  }

  async process(job: Job<BlogArticleSuggestionGenerationJobData>) {
    if (job.name !== BLOG_ARTICLE_SUGGESTION_GENERATION_JOB) {
      return;
    }

    await this.blogArticleSuggestionGenerationService.generateAndPersist(
      job.data,
    );
  }
}
