import { ZodType } from 'zod';

export function extractOpenAiText(response: {
  output_parsed?: unknown;
  output_text?: string;
  output?: unknown[];
}) {
  if (response.output_parsed !== undefined && response.output_parsed !== null) {
    if (typeof response.output_parsed === 'string') {
      const trimmed = response.output_parsed.trim();

      if (trimmed) {
        return trimmed;
      }
    } else {
      const stringified = JSON.stringify(response.output_parsed);

      if (stringified && stringified !== '{}') {
        return stringified;
      }
    }
  }

  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  const nestedText = extractStructuredJsonCandidate(response.output);

  if (nestedText) {
    return nestedText;
  }

  const looseText = extractLooseTextCandidate(response.output);

  if (looseText) {
    return looseText;
  }

  return '';
}

export function parseStructuredOpenAiResponse<T>(
  response: {
    output_parsed?: unknown;
    output_text?: string;
    output?: unknown[];
  },
  schema: ZodType<T>,
): T {
  if (response.output_parsed !== undefined && response.output_parsed !== null) {
    try {
      return schema.parse(response.output_parsed);
    } catch {
      // Fall through to the text-based extraction path if the structured
      // payload exists but is not schema-compatible.
    }
  }

  const outputText = extractOpenAiText(response);

  if (!outputText.trim()) {
    throw new Error('OpenAI structured response is empty.');
  }

  const normalizedValue = outputText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  const parsed = tryParseJsonLikePayload(normalizedValue);

  if (parsed === null) {
    throw new Error('OpenAI structured response is empty.');
  }

  return schema.parse(parsed);
}

function extractStructuredJsonCandidate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    return isLikelyJsonPayload(trimmed) ? trimmed : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractStructuredJsonCandidate(item);

      if (nested) {
        return nested;
      }
    }

    return '';
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;

  if (typeof record.type === 'string' && record.type === 'reasoning') {
    return '';
  }

  if ('parsed' in record && record.parsed !== undefined && record.parsed !== null) {
    if (typeof record.parsed === 'string') {
      const trimmed = record.parsed.trim();

      return trimmed && isLikelyJsonPayload(trimmed) ? trimmed : '';
    }

    const stringified = JSON.stringify(record.parsed);

    if (stringified && stringified !== '{}') {
      return stringified;
    }
  }

  if (Array.isArray(record.content)) {
    const nested = extractStructuredJsonCandidate(record.content);

    if (nested) {
      return nested;
    }
  }

  if (typeof record.content === 'string') {
    const trimmed = record.content.trim();

    if (trimmed && isLikelyJsonPayload(trimmed)) {
      return trimmed;
    }
  }

  for (const key of ['output_text', 'text', 'json']) {
    const candidate = record[key];

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();

      if (trimmed && isLikelyJsonPayload(trimmed)) {
        return trimmed;
      }
    }
  }

  for (const key of ['summary', 'value']) {
    const candidate = record[key];

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  for (const nestedValue of Object.values(record)) {
    if (nestedValue === record.content) {
      continue;
    }

    if (Array.isArray(nestedValue) || (nestedValue && typeof nestedValue === 'object')) {
      const nested = extractStructuredJsonCandidate(nestedValue);

      if (nested) {
        return nested;
      }
    }
  }

  return '';
}

function isLikelyJsonPayload(value: string) {
  return value.startsWith('{') || value.startsWith('[') || value.startsWith('"');
}

function tryParseJsonLikePayload(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    // keep trying
  }

  const objectCandidate = extractBalancedJsonSubstring(value, '{', '}');
  if (objectCandidate) {
    try {
      return JSON.parse(objectCandidate) as unknown;
    } catch {
      // keep trying
    }
  }

  const arrayCandidate = extractBalancedJsonSubstring(value, '[', ']');
  if (arrayCandidate) {
    try {
      return JSON.parse(arrayCandidate) as unknown;
    } catch {
      // keep trying
    }
  }

  return null;
}

function extractBalancedJsonSubstring(
  value: string,
  openingChar: '{' | '[',
  closingChar: '}' | ']',
) {
  const startIndex = value.indexOf(openingChar);

  if (startIndex < 0) {
    return '';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openingChar) {
      depth += 1;
    } else if (char === closingChar) {
      depth -= 1;

      if (depth === 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return '';
}

function extractLooseTextCandidate(value: unknown): string {
  const candidates = new Set<string>();
  const ignoredKeys = new Set([
    'id',
    'object',
    'type',
    'model',
    'role',
    'index',
    'status',
    'status_code',
    'status_message',
    'cacheKey',
    'endpoint',
    'path',
    'promptType',
  ]);

  function visit(node: unknown, key?: string) {
    if (typeof node === 'string') {
      const trimmed = node.trim();

      if (trimmed && (!key || !ignoredKeys.has(key))) {
        candidates.add(trimmed);
      }

      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, key);
      }

      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    for (const [nestedKey, nestedValue] of Object.entries(
      node as Record<string, unknown>,
    )) {
      visit(nestedValue, nestedKey);
    }
  }

  visit(value);

  const sortedCandidates = Array.from(candidates).sort(
    (left, right) => right.length - left.length,
  );

  return (
    sortedCandidates.find((candidate) => candidate.length >= 16) ??
    sortedCandidates[0] ??
    ''
  );
}
