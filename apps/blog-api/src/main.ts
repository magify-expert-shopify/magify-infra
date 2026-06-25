import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { ALLOWED_CORS_HOSTS, BODY_SIZE_LIMIT } from './config/app.config';
import { PORT } from './config/env.config';
import { BullBoardService } from './modules/queues/bullboard.service';

async function bootstrap() {
  const bigIntPrototype = BigInt.prototype as BigInt & {
    toJSON?: () => string;
  };

  if (typeof bigIntPrototype.toJSON !== 'function') {
    Object.defineProperty(bigIntPrototype, 'toJSON', {
      value: function toJSON() {
        return this.toString();
      },
      configurable: true,
      writable: true,
    });
  }

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(json({ limit: BODY_SIZE_LIMIT }));

  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

  app.useGlobalInterceptors(new BigIntSerializerInterceptor());

  app.enableCors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const parsedOrigin = new URL(origin);

        if (
          ['http:', 'https:'].includes(parsedOrigin.protocol) &&
          ALLOWED_CORS_HOSTS.has(parsedOrigin.hostname)
        ) {
          callback(null, true);
          return;
        }
      } catch {}

      callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  });

  app.get(BullBoardService).mountBullBoard(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const appUrl = process.env.APP_URL?.trim() || (await app.getUrl());
  logger.log(`API available at ${appUrl} (port ${port})`);
}

bootstrap();
