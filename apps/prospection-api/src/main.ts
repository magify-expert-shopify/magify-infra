import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { BullBoardService } from './imports/bull-board.service';

function maskDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return 'undefined';
  }

  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  logger.log(`DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  app.enableCors();

  const bullBoardService = app.get(BullBoardService);
  if (bullBoardService.isEnabled()) {
    const authMiddleware = bullBoardService.createAuthMiddleware();
    app.use(
      bullBoardService.getPath(),
      authMiddleware,
      bullBoardService.getRouter(),
    );
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const appUrl = process.env.APP_URL?.trim() || (await app.getUrl());
  logger.log(`API available at ${appUrl} (port ${port})`);
}
bootstrap();
