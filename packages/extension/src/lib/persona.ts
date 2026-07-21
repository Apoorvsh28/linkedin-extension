import type { Persona } from "@lgx/shared";

/** Checked in order — founder/owner signals should win over a bare "radiologist" mention in the same headline. */
const RULES: Array<{ persona: Persona; patterns: RegExp[] }> = [
  {
    persona: "teleradiology_founder",
    patterns: [/teleradiology/i, /\bco-?founder\b/i, /\bfounder\b/i, /\bceo\b/i],
  },
  {
    persona: "diagnostic_centre_owner",
    patterns: [
      /diagnostic (centre|center)/i,
      /imaging (centre|center)/i,
      /\bowner\b/i,
      /\bproprietor\b/i,
      /\bdirector\b.*(diagnostic|imaging|scan)/i,
    ],
  },
  {
    persona: "radiologist",
    patterns: [/radiologist/i, /\bmd,?\s*radiology\b/i, /consultant radiologist/i],
  },
];

export function classifyPersona(headline: string | null | undefined): Persona {
  const value = headline ?? "";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(value))) return rule.persona;
  }
  return "radiologist";
}
