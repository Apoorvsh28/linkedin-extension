/** Derived from headline/title text — LinkedIn doesn't expose a reliable structured seniority field. */
const SENIORITY_RULES: Array<{ level: string; patterns: RegExp[] }> = [
  { level: "executive", patterns: [/\b(ceo|cfo|coo|cto|cmo|founder|co-founder|president|chairman)\b/i] },
  { level: "director", patterns: [/\b(vp|vice president|head of|director)\b/i] },
  { level: "manager", patterns: [/\b(manager|team lead)\b/i] },
];

export function classifySeniority(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const rule of SENIORITY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.level;
  }
  return "individual_contributor";
}
