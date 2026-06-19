import { normalizeUrl } from './url.util';

export type DiscoveredArticleCandidate = {
  url: string;
  title: string;
  slug: string | null;
};

export function extractCandidateBlogUrls(baseUrl: string, html: string) {
  const candidateUrls = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>(.*?)<\/a>/gim;
  const keywordPattern =
    /\b(blog|blogs|news|insights|articles|resources|journal|magazine)\b/i;
  const siteOrigin = new URL(baseUrl).origin;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const [, rawHref, rawLabel] = match;

    try {
      const resolvedUrl = new URL(rawHref, baseUrl);

      if (resolvedUrl.origin !== siteOrigin) {
        continue;
      }

      const normalizedResolvedUrl = normalizeUrl(resolvedUrl.toString());
      const searchableText =
        `${resolvedUrl.pathname} ${rawLabel}`.toLowerCase();

      if (keywordPattern.test(searchableText)) {
        candidateUrls.add(normalizedResolvedUrl);
      }
    } catch {
      continue;
    }
  }

  return [...candidateUrls];
}

export function extractCandidateArticleUrls(baseUrl: string, html: string) {
  const candidateUrls = new Map<string, DiscoveredArticleCandidate>();
  const linkPattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>(.*?)<\/a>/gim;
  const blogUrl = new URL(baseUrl);
  const siteOrigin = blogUrl.origin;
  const blogPathPrefix = blogUrl.pathname.replace(/\/$/, '');
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const [, rawHref, rawLabel] = match;

    try {
      const resolvedUrl = new URL(rawHref, baseUrl);

      if (resolvedUrl.origin !== siteOrigin) {
        continue;
      }

      const normalizedUrl = normalizeUrl(resolvedUrl.toString());
      const normalizedPath = resolvedUrl.pathname.replace(/\/$/, '');

      if (!normalizedPath || normalizedUrl === normalizeUrl(baseUrl)) {
        continue;
      }

      const isUnderBlogPath =
        blogPathPrefix && normalizedPath.startsWith(`${blogPathPrefix}/`);
      const looksLikeArticle =
        /\/\d{4}\//.test(normalizedPath) ||
        /\/\d{4}\/\d{2}\//.test(normalizedPath) ||
        /\/(post|article|blog)\//i.test(normalizedPath) ||
        normalizedPath.split('/').filter(Boolean).length >=
          blogPathPrefix.split('/').filter(Boolean).length + 1;

      const isFeedLike =
        /\/(feed|tag|tags|category|categories|author|authors)(\/|$)/i.test(
          normalizedPath,
        );

      if ((!isUnderBlogPath && !looksLikeArticle) || isFeedLike) {
        continue;
      }

      candidateUrls.set(normalizedUrl, {
        url: normalizedUrl,
        title: deriveArticleTitle(rawLabel, resolvedUrl.pathname),
        slug: deriveSlug(resolvedUrl.pathname),
      });
    } catch {
      continue;
    }
  }

  return [...candidateUrls.values()];
}

function deriveArticleTitle(label: string, pathname: string) {
  const cleanedLabel = label
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedLabel) {
    return cleanedLabel;
  }

  const lastSegment = pathname.split('/').filter(Boolean).at(-1) ?? 'article';

  return lastSegment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveSlug(pathname: string) {
  return pathname.split('/').filter(Boolean).at(-1) ?? null;
}
