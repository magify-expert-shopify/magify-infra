export function extractMetaContent(
  html: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
) {
  const pattern = new RegExp(
    `<meta[^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i',
  );

  return pattern.exec(html)?.[1] ?? null;
}

export function extractHtmlTag(html: string, tagName: string) {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
  );

  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

export function extractMetaDescription(html: string) {
  return (
    extractMetaContent(html, 'name', 'description')
      ?.replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function normalizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = stripHtml(value).replace(/\s+/g, ' ').trim();

  return normalized || null;
}

export function extractJsonLdBlocks(html: string) {
  const blocks: unknown[] = [];
  const pattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const content = match[1]?.trim();

    if (!content) {
      continue;
    }

    try {
      blocks.push(JSON.parse(content));
    } catch {
      continue;
    }
  }

  return blocks;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
