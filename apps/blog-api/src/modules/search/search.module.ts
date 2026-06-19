import { Module } from '@nestjs/common';
import { CompetitorAgencySitesModule } from '../competitor-agency-sites/competitor-agency-sites.module';
import { SearchService } from './search.service';
import { BlogsModule } from '../blogs/blogs.module';
import { BlogArticlesModule } from '../blog-articles/blog-articles.module';
import { SeoClustersModule } from '../seo-clusters/seo-clusters.module';
import { AuthorsModule } from '../authors/authors.module';
import { SearchController } from './search.controller';

@Module({
  imports: [
    CompetitorAgencySitesModule,
    BlogsModule,
    BlogArticlesModule,
    AuthorsModule,
    SeoClustersModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
