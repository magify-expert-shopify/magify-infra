import { Module } from '@nestjs/common';
import { BlogArticlesController } from './blog-articles.controller';
import { BlogArticlesService } from './blog-articles.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthorsModule } from '../authors/authors.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { QueuesModule } from '../queues/queues.module';
import { BlogArticleRefreshProcessor } from './processors/blog-article-refresh.processor';
import { BlogArticleRefreshService } from './blog-article-refresh.service';
import { BlogArticleSuggestionGenerationProcessor } from './processors/blog-article-suggestion-generation.processor';
import { BlogArticleSuggestionGenerationService } from './blog-article-suggestion-generation.service';
import { OpenAiPlatformModule } from '../openai-platform/openai-platform.module';
import { SeoClustersModule } from '../seo-clusters/seo-clusters.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { MailModule } from '../mail/mail.module';
import { SettingsModule } from '../admin/settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    AuthorsModule,
    KeywordsModule,
    QueuesModule,
    OpenAiPlatformModule,
    SeoClustersModule,
    ShopifyModule,
    SettingsModule,
    MailModule,
  ],
  controllers: [BlogArticlesController],
  providers: [
    BlogArticlesService,
    BlogArticleRefreshService,
    BlogArticleRefreshProcessor,
    BlogArticleSuggestionGenerationService,
    BlogArticleSuggestionGenerationProcessor,
  ],
  exports: [
    BlogArticlesService,
    BlogArticleRefreshService,
    BlogArticleSuggestionGenerationService,
  ],
})
export class BlogArticlesModule {}
