export function serializeBigInts<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => walk(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entry]) => [key, walk(entry)],
  );

  return Object.fromEntries(entries);
}
