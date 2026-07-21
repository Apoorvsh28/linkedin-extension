import type { Campaign, Lead } from "@prisma/client";

const ACTIVITY_RANK: Record<string, number> = { inactive: 0, unknown: 0, active: 1 };

/**
 * Permissive by design: a filter only rejects a lead on a *confirmed* mismatch. Missing data
 * (not yet scraped, or fields — industry/company size — that aren't reliably scrapeable from a
 * LinkedIn profile page at all) never blocks engagement; it just means that filter can't apply yet.
 */
export function leadMatchesCampaignFilters(lead: Lead, campaign: Campaign): boolean {
  const industries = campaign.industries ?? [];
  const seniorities = campaign.seniorities ?? [];
  const currentCompanies = campaign.currentCompanies ?? [];

  if (industries.length > 0 && lead.industry && !industries.includes(lead.industry)) {
    return false;
  }
  if (seniorities.length > 0 && lead.seniority && !seniorities.includes(lead.seniority)) {
    return false;
  }
  if (
    currentCompanies.length > 0 &&
    lead.company &&
    !currentCompanies.some((c) => lead.company!.toLowerCase().includes(c.toLowerCase()))
  ) {
    return false;
  }
  if (campaign.companySizeMin != null && lead.companySize != null && lead.companySize < campaign.companySizeMin) {
    return false;
  }
  if (campaign.companySizeMax != null && lead.companySize != null && lead.companySize > campaign.companySizeMax) {
    return false;
  }
  if (campaign.minActivityLevel && lead.activityLevel !== "unknown") {
    const leadRank = ACTIVITY_RANK[lead.activityLevel] ?? 0;
    const minRank = ACTIVITY_RANK[campaign.minActivityLevel] ?? 0;
    if (leadRank < minRank) return false;
  }
  return true;
}
