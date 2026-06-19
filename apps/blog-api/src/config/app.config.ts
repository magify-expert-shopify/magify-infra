export const BODY_SIZE_LIMIT = '5mb';

export const ALLOWED_CORS_HOSTS = new Set([
  '192.168.1.129',
  '192.168.1.91',
  'localhost',
  'blog.dev.magify.local',
  'blog.magify.local',
]);

// const DATABASE_URL = process.env.DATABASE_URL;
export const DATABASE_URL =
  'postgresql://postgres:brunstad2020@192.168.1.91:5432/postgres';
