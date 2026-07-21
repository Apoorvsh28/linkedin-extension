/**
 * LinkedIn's location filter (geoUrn) needs numeric IDs from LinkedIn's own geo taxonomy,
 * which isn't resolvable without a live LinkedIn API session — so location is folded into
 * the free-text keywords instead of a real geo filter. Less precise, but functional.
 */
export function buildPeopleSearchUrl(keyword: string, location?: string | null): string {
  const combined = location ? `${keyword} ${location}` : keyword;
  const params = new URLSearchParams({ keywords: combined });
  return `https://www.linkedin.com/search/results/people/?${params}`;
}
