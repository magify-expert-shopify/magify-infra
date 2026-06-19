import { toDate } from './date';
import {
  extractJsonLdBlocks,
  extractMetaContent,
  normalizeText,
  stripHtml,
} from './html';

type ExtractedAuthorData = {
  name: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
};

type JsonLdContext = {
  byId: Map<string, Record<string, unknown>>;
};

export function extractArticleMetadata(html: string, url: string) {
  const jsonLdAuthor = extractAuthorFromJsonLd(html, url);
  const jsonLdPublishedAt = extractPublishedAtFromJsonLd(html);
  const relAuthor = extractRelAuthorData(html, url);
  const title =
    extractMetaContent(html, 'property', 'og:title') ??
    extractMetaContent(html, 'name', 'twitter:title') ??
    extractTagContent(html, 'title') ??
    deriveTitleFromUrl(url);

  const excerpt =
    extractMetaContent(html, 'name', 'description') ??
    extractMetaContent(html, 'property', 'og:description') ??
    null;

  const publishedAtRaw =
    jsonLdPublishedAt ??
    extractMetaContent(html, 'property', 'article:published_time') ??
    extractMetaContent(html, 'name', 'publish-date') ??
    extractTimeDateTime(html);

  const authorName =
    jsonLdAuthor.name ??
    extractMetaContent(html, 'name', 'author') ??
    extractMetaContent(html, 'property', 'article:author') ??
    relAuthor.name ??
    null;

  const articleText =
    extractTagContent(html, 'article') ??
    extractTagContent(html, 'main') ??
    extractTagContent(html, 'body') ??
    null;

  return {
    title: normalizeText(title),
    excerpt: normalizeText(excerpt),
    content: normalizeText(articleText),
    slug: deriveSlug(url),
    publishedAt: publishedAtRaw ? toDate(publishedAtRaw) : null,
    authorName: normalizeText(authorName),
    authorProfileUrl: jsonLdAuthor.profileUrl ?? relAuthor.profileUrl,
    authorAvatarUrl: jsonLdAuthor.avatarUrl ?? relAuthor.avatarUrl,
  };
}

function extractPublishedAtFromJsonLd(html: string) {
  for (const block of extractJsonLdBlocks(html)) {
    const publishedAt = findPublishedAtInJsonLdNode(block);

    if (publishedAt) {
      return publishedAt;
    }
  }

  return null;
}

function extractTagContent(html: string, tagName: string) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i',
  );
  const match = pattern.exec(html)?.[1] ?? null;

  return match ? stripHtml(match) : null;
}

function extractTimeDateTime(html: string) {
  const match = /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i.exec(html);

  return match?.[1] ?? null;
}

function extractAuthorFromJsonLd(html: string, articleUrl: string) {
  for (const block of extractJsonLdBlocks(html)) {
    const context = createJsonLdContext(block);
    const author = findAuthorInJsonLdNode(block, articleUrl, context);

    if (author.name || author.profileUrl || author.avatarUrl) {
      return author;
    }
  }

  return {
    name: null,
    profileUrl: null,
    avatarUrl: null,
  };
}

function findAuthorInJsonLdNode(
  node: unknown,
  articleUrl: string,
  context: JsonLdContext,
): ExtractedAuthorData {
  if (!node) {
    return { name: null, profileUrl: null, avatarUrl: null };
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const author = findAuthorInJsonLdNode(item, articleUrl, context);

      if (author.name || author.profileUrl || author.avatarUrl) {
        return author;
      }
    }

    return { name: null, profileUrl: null, avatarUrl: null };
  }

  if (typeof node !== 'object') {
    return { name: null, profileUrl: null, avatarUrl: null };
  }

  const record = node as Record<string, unknown>;
  const candidates = [
    record.author,
    record.creator,
    record.publisher,
    record['@graph'],
  ];

  for (const candidate of candidates) {
    const author = extractAuthorFromJsonLdCandidate(
      candidate,
      articleUrl,
      context,
    );

    if (author.name || author.profileUrl || author.avatarUrl) {
      return author;
    }
  }

  return { name: null, profileUrl: null, avatarUrl: null };
}

function findPublishedAtInJsonLdNode(node: unknown): string | null {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const publishedAt = findPublishedAtInJsonLdNode(item);

      if (publishedAt) {
        return publishedAt;
      }
    }

    return null;
  }

  if (typeof node !== 'object') {
    return null;
  }

  const record = node as Record<string, unknown>;
  const directValue =
    readString(record.datePublished) ?? readString(record.dateCreated);

  if (directValue) {
    return directValue;
  }

  for (const value of Object.values(record)) {
    const nestedValue = findPublishedAtInJsonLdNode(value);

    if (nestedValue) {
      return nestedValue;
    }
  }

  return null;
}

function extractAuthorFromJsonLdCandidate(
  candidate: unknown,
  articleUrl: string,
  context: JsonLdContext,
): ExtractedAuthorData {
  if (!candidate) {
    return { name: null, profileUrl: null, avatarUrl: null };
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const author = extractAuthorFromJsonLdCandidate(
        item,
        articleUrl,
        context,
      );

      if (author.name || author.profileUrl || author.avatarUrl) {
        return author;
      }
    }

    return { name: null, profileUrl: null, avatarUrl: null };
  }

  if (typeof candidate === 'string') {
    const resolvedFromId = context.byId.get(candidate);

    if (resolvedFromId) {
      return extractAuthorFromJsonLdCandidate(
        resolvedFromId,
        articleUrl,
        context,
      );
    }

    return {
      name: normalizeText(candidate),
      profileUrl: null,
      avatarUrl: null,
    };
  }

  if (typeof candidate !== 'object') {
    return { name: null, profileUrl: null, avatarUrl: null };
  }

  const record = resolveJsonLdRecord(
    candidate as Record<string, unknown>,
    context,
  );
  const sameAsUrls = readStringArray(record.sameAs);

  return {
    name: normalizeText(readString(record.name)),
    profileUrl: resolveUrl(
      readString(record.url) ?? sameAsUrls.at(0) ?? null,
      articleUrl,
    ),
    avatarUrl: resolveUrl(
      readImageUrl(record.image ?? record.logo, context),
      articleUrl,
    ),
  };
}

function extractRelAuthorData(html: string, articleUrl: string) {
  const match =
    /<a\b([^>]*)rel=["'][^"']*author[^"']*["']([^>]*)>([\s\S]*?)<\/a>/i.exec(
      html,
    );

  if (!match) {
    return {
      name: null,
      profileUrl: null,
      avatarUrl: null,
    };
  }

  const attributes = `${match[1] ?? ''} ${match[2] ?? ''}`;
  const href = /href=["']([^"']+)["']/i.exec(attributes)?.[1] ?? null;
  const imageSrc =
    /<img\b[^>]*src=["']([^"']+)["'][^>]*>/i.exec(match[3])?.[1] ?? null;

  return {
    name: normalizeText(match[3]),
    profileUrl: resolveUrl(href, articleUrl),
    avatarUrl: resolveUrl(imageSrc, articleUrl),
  };
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function readImageUrl(value: unknown, context: JsonLdContext): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const referencedImage = context.byId.get(value);

    if (referencedImage) {
      return readImageUrl(referencedImage, context);
    }

    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = readImageUrl(item, context);

      if (imageUrl) {
        return imageUrl;
      }
    }

    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const record = resolveJsonLdRecord(value as Record<string, unknown>, context);

  return readString(record.url) ?? readString(record.contentUrl);
}

function createJsonLdContext(node: unknown): JsonLdContext {
  const byId = new Map<string, Record<string, unknown>>();

  collectJsonLdRecords(node, byId);

  return { byId };
}

function collectJsonLdRecords(
  node: unknown,
  byId: Map<string, Record<string, unknown>>,
) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectJsonLdRecords(item, byId);
    }

    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;
  const recordId = readString(record['@id']);

  if (recordId) {
    const existingRecord = byId.get(recordId);
    byId.set(
      recordId,
      existingRecord ? { ...existingRecord, ...record } : record,
    );
  }

  for (const value of Object.values(record)) {
    collectJsonLdRecords(value, byId);
  }
}

function resolveJsonLdRecord(
  record: Record<string, unknown>,
  context: JsonLdContext,
) {
  const recordId = readString(record['@id']);

  if (!recordId) {
    return record;
  }

  const referencedRecord = context.byId.get(recordId);

  if (!referencedRecord || referencedRecord === record) {
    return record;
  }

  return {
    ...referencedRecord,
    ...record,
  };
}

function resolveUrl(value: string | null, articleUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, articleUrl).toString();
  } catch {
    return null;
  }
}

function deriveTitleFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split('/').filter(Boolean).at(-1) ?? 'article';

    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return 'Article';
  }
}

function deriveSlug(url: string) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? null;
  } catch {
    return null;
  }
}
