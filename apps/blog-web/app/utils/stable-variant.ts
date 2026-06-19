export function getStableVariantFromSeed<T>(seed: string, variants: T[]): T {
  if (!variants.length) {
    throw new Error("variants must contain at least one item");
  }

  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return variants[hash % variants.length]!;
}

