import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type INestApplication } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';
import { BLOG_DISCOVERY_QUEUE } from 'src/modules/competitor-agency-sites/competitor-agency-sites.constants';
import { BLOG_ARTICLE_DISCOVERY_QUEUE } from 'src/modules/blogs/blogs.constants';
import { BLOG_ARTICLE_REFRESH_QUEUE, BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE } from 'src/modules/blog-articles/blog-articles.constants';

@Injectable()
export class BullBoardService {
  constructor(
    @InjectQueue(BLOG_DISCOVERY_QUEUE)
    private readonly blogDiscoveryQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_DISCOVERY_QUEUE)
    private readonly blogArticleDiscoveryQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_REFRESH_QUEUE)
    private readonly blogArticleRefreshQueue: Queue,
    @InjectQueue(BLOG_ARTICLE_SUGGESTION_GENERATION_QUEUE)
    private readonly blogArticleSuggestionGenerationQueue: Queue,
  ) {}

  mountBullBoard(app: INestApplication) {
    const isEnabled = process.env.BULL_BOARD_ENABLED !== 'false';

    if (!isEnabled) {
      return;
    }

    const dashboardPath = process.env.BULL_BOARD_PATH || '/admin/queues';
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(dashboardPath);

    createBullBoard({
      queues: [
        new BullMQAdapter(this.blogDiscoveryQueue),
        new BullMQAdapter(this.blogArticleDiscoveryQueue),
        new BullMQAdapter(this.blogArticleRefreshQueue),
        new BullMQAdapter(this.blogArticleSuggestionGenerationQueue),
      ],
      serverAdapter,
    });

    const authUser = process.env.BULL_BOARD_USER;
    const authPassword = process.env.BULL_BOARD_PASSWORD;

    if (authUser && authPassword) {
      app.use(
        dashboardPath,
        (request: Request, response: Response, next: NextFunction) => {
          const authorization = request.headers.authorization;

          if (!authorization?.startsWith('Basic ')) {
            response.setHeader(
              'WWW-Authenticate',
              'Basic realm="Bull Dashboard"',
            );
            response.status(401).send('Authentication required');
            return;
          }

          const encodedCredentials = authorization.slice('Basic '.length);
          const [username, password] = Buffer.from(encodedCredentials, 'base64')
            .toString('utf8')
            .split(':');

          if (username !== authUser || password !== authPassword) {
            response.setHeader(
              'WWW-Authenticate',
              'Basic realm="Bull Dashboard"',
            );
            response.status(401).send('Invalid credentials');
            return;
          }

          next();
        },
        serverAdapter.getRouter(),
      );

      return;
    }

    app.use(dashboardPath, serverAdapter.getRouter());
  }
}
