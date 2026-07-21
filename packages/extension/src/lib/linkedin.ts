export function normalizeProfileUrl(href: string, base = location.href): string | null {
  try {
    const parsed = new URL(href, base);
    const match = parsed.pathname.match(/^\/in\/[^/]+/);
    if (!match) return null;
    return `https://www.linkedin.com${match[0]}/`;
  } catch {
    return null;
  }
}
