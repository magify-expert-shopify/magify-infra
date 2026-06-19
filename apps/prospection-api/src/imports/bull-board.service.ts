import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { NextFunction, Request, Response } from 'express';
import { Queue } from 'bullmq';
import {
  IMPORT_ANALYSIS_QUEUE,
  PROSPECT_EMAIL_SEND_QUEUE,
  PROSPECT_STATUS_RECALC_QUEUE,
  SCAN_LAUNCH_QUEUE,
  URL_LEAD_SCORE_RECALC_QUEUE,
} from 'src/queues/queue.constants';

function parseBoolean(value: string | undefined, fallback = false) {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

@Injectable()
export class BullBoardService {
  private readonly serverAdapter: ExpressAdapter;
  private readonly boardPath: string;
  private readonly enabled: boolean;
  private readonly basicAuthUser: string | null;
  private readonly basicAuthPassword: string | null;
  private readonly board: ReturnType<typeof createBullBoard>;
  private readonly boardRouter: ReturnType<ExpressAdapter['getRouter']>;

  constructor(
    @InjectQueue(IMPORT_ANALYSIS_QUEUE) importAnalysisQueue: Queue,
    @InjectQueue(PROSPECT_EMAIL_SEND_QUEUE) prospectEmailQueue: Queue,
    @InjectQueue(PROSPECT_STATUS_RECALC_QUEUE) prospectStatusRecalcQueue: Queue,
    @InjectQueue(URL_LEAD_SCORE_RECALC_QUEUE) urlLeadScoreRecalcQueue: Queue,
    @InjectQueue(SCAN_LAUNCH_QUEUE) scanLaunchQueue: Queue,
  ) {
    this.boardPath = process.env.BULL_BOARD_PATH?.trim() || '/admin/queues';
    this.enabled = parseBoolean(process.env.BULL_BOARD_ENABLED, process.env.NODE_ENV !== 'production');
    this.basicAuthUser = process.env.BULL_BOARD_USER?.trim() || null;
    this.basicAuthPassword = process.env.BULL_BOARD_PASSWORD?.trim() || null;

    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath(this.boardPath);

    this.board = createBullBoard({
      queues: [
        new BullMQAdapter(importAnalysisQueue),
        new BullMQAdapter(prospectEmailQueue),
        new BullMQAdapter(prospectStatusRecalcQueue),
        new BullMQAdapter(urlLeadScoreRecalcQueue),
        new BullMQAdapter(scanLaunchQueue),
      ],
      serverAdapter: this.serverAdapter,
    });

    this.boardRouter = this.serverAdapter.getRouter();
  }

  getPath() {
    return this.boardPath;
  }

  isEnabled() {
    return this.enabled;
  }

  getRouter() {
    return this.boardRouter;
  }

  getBoard() {
    return this.board;
  }

  hasBasicAuth() {
    return Boolean(this.basicAuthUser && this.basicAuthPassword);
  }

  createAuthMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.hasBasicAuth()) {
        next();
        return;
      }

      const header = String(req.headers.authorization || '');
      if (!header.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
        res.status(401).send('Authentication required');
        return;
      }

      const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : '';
      const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

      if (user !== this.basicAuthUser || password !== this.basicAuthPassword) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
        res.status(401).send('Authentication required');
        return;
      }

      next();
    };
  }
}
