import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';
// import { DATABASE_URL } from 'src/config/app.config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '').trim();

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined');
    }

    console.log(`Prisma database host: ${new URL(databaseUrl).hostname}`);

    super({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    // await this.verifyDatabaseConnection();
    // await this.ensureBlogShopifyBlogIdColumn();
    // await this.ensureBlogArticleReviewColumns();
    // await this.ensureKeywordSiteVisibilityObservationTable();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }

  private async verifyDatabaseConnection() {
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Database connection test failed', stack);
      throw error;
    }
  }

  private async ensureBlogShopifyBlogIdColumn() {
    if (!(await this.tableExists('blog'))) {
      return;
    }

    const columns = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'blog'`,
    );

    const hasShopifyBlogId = columns.some(
      (column) => column.name === 'shopifyBlogId',
    );

    if (hasShopifyBlogId) {
      return;
    }

    await this.$executeRawUnsafe(
      'ALTER TABLE "blog" ADD COLUMN "shopifyBlogId" TEXT',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "blog_shopifyBlogId_idx" ON "blog"("shopifyBlogId")',
    );
  }

  private async ensureKeywordSiteVisibilityObservationTable() {
    const tables = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = 'keywordsitevisibilityobservation'`,
    );

    if (tables.length > 0) {
      return;
    }

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "keywordsitevisibilityobservation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT,
        "keywordId" TEXT,
        "keywordText" TEXT NOT NULL,
        "keywordVolume" INTEGER,
        "keywordDifficulty" INTEGER,
        "keywordIntent" TEXT,
        "pageId" TEXT,
        "pageUrl" TEXT NOT NULL,
        "siteBaseUrl" TEXT NOT NULL,
        "siteHostname" TEXT NOT NULL,
        "position" INTEGER NOT NULL,
        "serpResponseBody" TEXT NOT NULL,
        "sourceCacheKey" TEXT NOT NULL,
        "sourceCacheCreatedAt" TIMESTAMP NOT NULL,
        "observedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY ("keywordId") REFERENCES "keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY ("pageId") REFERENCES "page"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await this.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_sourceCacheKey_pageUrl_key" ON "keywordsitevisibilityobservation"("sourceCacheKey", "pageUrl")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_projectId_idx" ON "keywordsitevisibilityobservation"("projectId")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_keywordId_idx" ON "keywordsitevisibilityobservation"("keywordId")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_keywordText_idx" ON "keywordsitevisibilityobservation"("keywordText")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_pageId_idx" ON "keywordsitevisibilityobservation"("pageId")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_siteBaseUrl_idx" ON "keywordsitevisibilityobservation"("siteBaseUrl")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_siteHostname_idx" ON "keywordsitevisibilityobservation"("siteHostname")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_position_idx" ON "keywordsitevisibilityobservation"("position")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_observedAt_idx" ON "keywordsitevisibilityobservation"("observedAt")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "keywordsitevisibilityobservation_sourceCacheCreatedAt_idx" ON "keywordsitevisibilityobservation"("sourceCacheCreatedAt")',
    );
  }

  private async ensureBlogArticleReviewColumns() {
    if (!(await this.tableExists('blogarticle'))) {
      return;
    }

    const columns = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'blogarticle'`,
    );

    const hasColumn = (columnName: string) =>
      columns.some((column) => column.name === columnName);

    const addColumnIfMissing = async (
      columnName: string,
      columnSql: string,
    ) => {
      if (hasColumn(columnName)) {
        return;
      }

      await this.$executeRawUnsafe(
        `ALTER TABLE "blogarticle" ADD COLUMN "${columnName}" ${columnSql}`,
      );
    };

    await addColumnIfMissing('reviewSupabaseUserId', 'TEXT');
    await addColumnIfMissing('reviewAssignedAt', 'TIMESTAMP');
    await addColumnIfMissing('reviewDueAt', 'TIMESTAMP');
    await addColumnIfMissing('reviewCompletedAt', 'TIMESTAMP');
    await addColumnIfMissing('reviewOutcome', 'TEXT');
    await addColumnIfMissing('reviewComment', 'TEXT');

    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "blogarticle_reviewSupabaseUserId_idx" ON "blogarticle"("reviewSupabaseUserId")',
    );
    await this.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "blogarticle_reviewDueAt_idx" ON "blogarticle"("reviewDueAt")',
    );
  }

  private async tableExists(tableName: string) {
    const tables = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = '${tableName}'`,
    );

    return Boolean(tables[0]?.name);
  }
}
