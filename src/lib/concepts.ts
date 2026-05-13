export function normalizeConceptPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

export function sharedConceptKey(args: { domain: string; gloss: string }): string {
  const domain = normalizeConceptPart(args.domain) || "general";
  const gloss = normalizeConceptPart(args.gloss) || "concept";
  return `shared.${domain}.${gloss}`;
}
