export function varietyProblems(segments: { template: string }[]): string[] {
  const limit = Math.max(2, Math.floor(segments.length / 4));
  const counts = new Map<string, number>();
  for (const { template } of segments) counts.set(template, (counts.get(template) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > limit)
    .map(
      ([template, count]) =>
        `${template} is used for ${count} of ${segments.length} visuals; use it for at most ${limit} and pick templates that show what is said`,
    );
}
