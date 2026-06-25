export const ENV_FILE_PATH =
  process.env.NODE_ENV === 'production' ? '../.env.prod' : '../.env.dev';

// export const PORT = process.env.PORT ?? 3000;
export const PORT = 4000;

// export const BULLMQ_HOST = '192.168.1.200';
// export const BULLMQ_PORT = 6379;
export const BULLMQ_HOST =
  process.env.BULLMQ_HOST ?? process.env.REDIS_HOST ?? '127.0.0.1';

export const BULLMQ_PORT = Number(
  process.env.BULLMQ_PORT ?? process.env.REDIS_PORT ?? 6379,
);
// export const BULLMQ_PASSWORD = process.env.BULLMQ_PASSWORD ;
export const BULLMQ_PASSWORD = undefined;
