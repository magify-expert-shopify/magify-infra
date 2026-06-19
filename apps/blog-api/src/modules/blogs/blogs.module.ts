import { Module } from '@nestjs/common';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BlogArticlesModule } from '../blog-articles/blog-articles.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { BlogArticleDiscoveryService } from './blog-article-discovery.service';
import { BlogArticleDiscoveryProcessor } from './blog-article-discovery.processor';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [PrismaModule, BlogArticlesModule, ShopifyModule, QueuesModule],
  controllers: [BlogsController],
  providers: [
    BlogsService,
    BlogArticleDiscoveryService,
    BlogArticleDiscoveryProcessor,
  ],
  exports: [BlogsService, BlogArticleDiscoveryService],
})
export class BlogsModule {}
