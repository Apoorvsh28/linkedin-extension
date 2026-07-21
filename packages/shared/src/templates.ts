import type { Lead } from "./types/lead.js";

export interface TemplateVariables {
  name: string;
  company: string;
  headline: string;
  location: string;
}

export function leadTemplateVariables(lead: Pick<Lead, "fullName" | "company" | "headline" | "location">): TemplateVariables {
  return {
    name: lead.fullName,
    company: lead.company ?? "",
    headline: lead.headline ?? "",
    location: lead.location ?? "",
  };
}

/** Replaces {{name}}, {{company}}, {{headline}}, {{location}} (case/whitespace-insensitive). Unknown vars are left as-is. */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  const lookup: Record<string, string> = { ...variables };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = lookup[key.toLowerCase()];
    return value !== undefined ? value : match;
  });
}
