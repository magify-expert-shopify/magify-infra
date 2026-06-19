import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined');
    }

    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.verifyDatabaseConnection();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async verifyDatabaseConnection() {
    const attempts = 10;
    const delayMs = 3000;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$queryRawUnsafe('SELECT 1');
        return;
      } catch (error) {
        const stack = error instanceof Error ? error.stack : undefined;

        if (attempt === attempts) {
          this.logger.error(
            `Database connection test failed after ${attempts} attempts`,
            stack,
          );
          throw error;
        }

        this.logger.warn(
          `Database connection test failed (attempt ${attempt}/${attempts}), retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
