import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BlogArticlesModule } from '../blog-articles/blog-articles.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [PrismaModule, BlogArticlesModule, ShopifyModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
