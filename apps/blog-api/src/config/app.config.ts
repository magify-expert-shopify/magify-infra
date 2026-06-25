export const BODY_SIZE_LIMIT = '5mb';

export const ALLOWED_CORS_HOSTS = new Set([
  '192.168.1.129',
  '192.168.1.200',
  'localhost',
  'blog.dev.magify.local',
  'blog.magify.local',
]);

const POSTGRES_HOST = process.env.POSTGRES_HOST ?? '127.0.0.1';
const POSTGRES_PORT = process.env.POSTGRES_PORT ?? '5432';
const POSTGRES_USER = process.env.POSTGRES_USER ?? 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD ?? '';
const POSTGRES_DB = process.env.POSTGRES_DB ?? 'postgres';

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
