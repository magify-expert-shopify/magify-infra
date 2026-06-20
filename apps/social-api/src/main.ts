import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

function maskDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return 'undefined';
  }

  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function parseCorsOrigins(value?: string) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  logger.log(`DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  const allowedOrigins = parseCorsOrigins(
    process.env.CORS_ORIGINS || process.env.NUXT_PUBLIC_WEB_URL,
  );
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  });
  await app.listen(process.env.PORT ?? 3000);

  const appUrl = process.env.APP_URL?.trim() || (await app.getUrl());
  logger.log(`API available at ${appUrl}`);
}
bootstrap();
