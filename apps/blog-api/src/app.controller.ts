import { Controller, Get, Header } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';
import { BULLMQ_HOST, BULLMQ_PASSWORD, BULLMQ_PORT } from './config/env.config';

type HealthCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

type ApiInfoResponse = {
  appUrl: string;
  api: HealthCheck;
  database: HealthCheck;
  redis: HealthCheck;
  databaseUrl: string;
  bullBoardUrl: string | null;
  checkedAt: string;
};

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getApiInfo() {
    const status = await this.buildApiInfo();
    return this.renderStatusPage(status);
  }

  @Get('api-info')
  async getApiInfoJson(): Promise<ApiInfoResponse> {
    return this.buildApiInfo();
  }

  @Get('environment')
  getEnvironment() {
    return { ...process.env };
  }

  @Get('api/environment')
  getApiEnvironment() {
    return { ...process.env };
  }

  private async buildApiInfo(): Promise<ApiInfoResponse> {
    const appUrl = process.env.APP_URL?.trim() || 'http://localhost:4001';
    const bullBoardPath = process.env.BULL_BOARD_PATH || '/admin/queues';
    const bullBoardUrl = new URL(bullBoardPath, appUrl).toString();
    const databaseUrl = this.maskDatabaseUrl(process.env.DATABASE_URL);

    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const api = {
      label: 'API',
      ok: true,
      detail: 'Online',
    };

    return {
      appUrl,
      api,
      database,
      redis,
      databaseUrl,
      bullBoardUrl: redis.ok ? bullBoardUrl : null,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        label: 'Database',
        ok: true,
        detail: 'Connected to PostgreSQL',
      };
    } catch (error) {
      return {
        label: 'Database',
        ok: false,
        detail:
          error instanceof Error && error.message
            ? error.message
            : 'Connection failed',
      };
    }
  }

  private async checkRedis() {
    const client = new Redis({
      host: BULLMQ_HOST,
      port: BULLMQ_PORT,
      password: BULLMQ_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    try {
      await client.connect();
      const pong = await client.ping();

      return {
        label: 'Redis',
        ok: pong === 'PONG',
        detail: pong === 'PONG' ? 'Connected to Redis' : `Unexpected reply: ${pong}`,
      };
    } catch (error) {
      return {
        label: 'Redis',
        ok: false,
        detail:
          error instanceof Error && error.message
            ? error.message
            : 'Connection failed',
      };
    } finally {
      client.disconnect();
    }
  }

  private renderStatusPage(input: {
    appUrl: string;
    api: { label: string; ok: boolean; detail: string };
    database: { label: string; ok: boolean; detail: string };
    redis: { label: string; ok: boolean; detail: string };
    databaseUrl: string;
    bullBoardUrl: string | null;
  }) {
    const row = (label: string, ok: boolean, detail: string) => `
      <div class="row">
        <div class="row-left">
          <span class="dot ${ok ? 'ok' : 'bad'}"></span>
          <strong>${this.escapeHtml(label)}</strong>
        </div>
        <span class="detail ${ok ? 'ok' : 'bad'}">${this.escapeHtml(detail)}</span>
      </div>
    `;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blog Magify API Status</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --panel: rgba(11, 23, 42, 0.92);
        --panel-border: rgba(126, 231, 135, 0.18);
        --text: #e5eefc;
        --muted: #8ea2bf;
        --ok: #22c55e;
        --bad: #ef4444;
        --accent: #7dd3fc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(125, 211, 252, 0.10), transparent 24%),
          var(--bg);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: 32px;
      }
      .card {
        width: min(760px, 100%);
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        box-shadow: 0 24px 90px rgba(0, 0, 0, 0.35);
        padding: 28px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1;
      }
      .subtitle {
        color: var(--muted);
        margin: 0;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        color: var(--ok);
        font-weight: 700;
        white-space: nowrap;
      }
      .pill .dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: var(--ok);
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.14);
      }
      .section {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }
      .meta {
        color: var(--muted);
        font-size: 0.95rem;
        margin-bottom: 12px;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }
      .row:last-child { border-bottom: 0; }
      .row-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        flex: 0 0 auto;
      }
      .dot.ok { background: var(--ok); box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12); }
      .dot.bad { background: var(--bad); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.12); }
      .detail {
        color: var(--muted);
        text-align: right;
      }
      .detail.ok { color: #bbf7d0; }
      .detail.bad { color: #fecaca; }
      a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 700;
      }
      a:hover { text-decoration: underline; }
      .footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 0.9rem;
      }
      @media (max-width: 640px) {
        .top, .row {
          flex-direction: column;
          align-items: flex-start;
        }
        .detail {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="top">
        <div>
          <h1>Blog Magify API</h1>
          <p class="subtitle">Status page for ${this.escapeHtml(input.appUrl)}</p>
        </div>
        <div class="pill">
          <span class="dot"></span>
          Online
        </div>
      </div>

      <div class="section">
        <div class="meta">Core services</div>
        ${row(input.api.label, input.api.ok, input.api.detail)}
        ${row(input.database.label, input.database.ok, input.database.detail)}
        ${row(input.redis.label, input.redis.ok, input.redis.detail)}
      </div>

      <div class="section">
        <div class="meta">Database connection</div>
        <div class="row">
          <div class="row-left">
            <span class="dot ok"></span>
            <strong>DATABASE_URL</strong>
          </div>
          <span class="detail">${this.escapeHtml(input.databaseUrl)}</span>
        </div>
      </div>

      <div class="section">
        <div class="meta">Tools</div>
        ${
          input.bullBoardUrl
            ? `<div class="row">
                <div class="row-left">
                  <span class="dot ok"></span>
                  <strong>Bull Board</strong>
                </div>
                <a href="${this.escapeHtml(input.bullBoardUrl)}" target="_blank" rel="noreferrer">
                  Open Bull Board
                </a>
              </div>`
            : `<div class="row">
                <div class="row-left">
                  <span class="dot bad"></span>
                  <strong>Bull Board</strong>
                </div>
                <span class="detail bad">Unavailable until Redis is connected</span>
              </div>`
        }
      </div>

      <div class="footer">
        Environment: ${this.escapeHtml(process.env.NODE_ENV || 'unknown')} •
        Generated at ${this.escapeHtml(new Date().toISOString())}
      </div>
    </main>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private maskDatabaseUrl(databaseUrl?: string) {
    if (!databaseUrl?.trim()) {
      return 'undefined';
    }

    return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}
