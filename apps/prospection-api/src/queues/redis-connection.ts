export type BullMqRedisConnection = {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
};

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createBullMqConnection(): BullMqRedisConnection {
  const redisUrl = process.env.REDIS_URL?.trim();
  const fallbackHost = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  const fallbackPort = parsePort(process.env.REDIS_PORT, 6379);

  if (!redisUrl) {
    return {
      host: fallbackHost,
      port: fallbackPort,
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
      db: process.env.REDIS_DB ? parsePort(process.env.REDIS_DB, 0) : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || fallbackHost,
      port: parsePort(url.port, fallbackPort),
      password: url.password || process.env.REDIS_PASSWORD?.trim() || undefined,
      db: url.pathname && url.pathname !== '/' ? parsePort(url.pathname.replace('/', ''), 0) : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: fallbackHost,
      port: fallbackPort,
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
      db: process.env.REDIS_DB ? parsePort(process.env.REDIS_DB, 0) : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
