export function normalizeProducers(value: string): string[] {
  return value
    .split(/\s*(?:,|\band\b)\s*/iu)
    .map((producer) => producer.trim())
    .filter((producer) => producer.length > 0);
}
