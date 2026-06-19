import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AuthorsModule } from './modules/authors/authors.module';
import { BlogArticlesModule } from './modules/blog-articles/blog-articles.module';
import { BlogsModule } from './modules/blogs/blogs.module';
import { BullMqModule } from './modules/queues/bullmq.module';
import { CompetitorAgencySitesModule } from './modules/competitor-agency-sites/competitor-agency-sites.module';
import { CustomerProblemCategoriesModule } from './modules/customer-problems/customer-problem-categories.module';
import { CustomerProblemsModule } from './modules/customer-problems/customer-problems.module';
import { GlobalConfigModule } from './config/globale-config.module';
import { KeywordAnalysisModule } from './modules/keyword-analysis/keyword-analysis.module';
import { KeywordsModule } from './modules/keywords/keywords.module';
import { MaintenanceModule } from './modules/admin/maintenance/maintenance.module';
import { OpenAiPlatformModule } from './modules/openai-platform/openai-platform.module';
import { PagesModule } from './modules/pages/pages.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SearchModule } from './modules/search/search.module';
import { SeoClustersModule } from './modules/seo-clusters/seo-clusters.module';
import { SettingsModule } from './modules/admin/settings/settings.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { StatsModule } from './modules/stats/stats.module';
import { SupabaseAuthModule } from './modules/auth/supabase-auth/supabase-auth.module';

@Module({
  imports: [
    AuthorsModule,
    BlogArticlesModule,
    BlogsModule,
    BullMqModule,
    CompetitorAgencySitesModule,
    CustomerProblemCategoriesModule,
    CustomerProblemsModule,
    GlobalConfigModule,
    KeywordAnalysisModule,
    KeywordsModule,
    MaintenanceModule,
    OpenAiPlatformModule,
    PagesModule,
    PrismaModule,
    ProjectsModule,
    SearchModule,
    SeoClustersModule,
    SettingsModule,
    ShopifyModule,
    StatsModule,
    SupabaseAuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
