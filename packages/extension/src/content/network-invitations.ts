import { api } from "../lib/apiRelay.js";
import { sleep } from "../lib/delay.js";
import { waitForSelector } from "../lib/dom.js";
import { normalizeProfileUrl } from "../lib/linkedin.js";

/**
 * Sent invitations disappear from this page once accepted or withdrawn, so we treat any
 * previously-pending lead whose profile no longer appears here as accepted.
 */
function scrapeStillPendingUrls(): Set<string> {
  const urls = new Set<string>();
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]')) {
    const url = normalizeProfileUrl(anchor.href);
    if (url) urls.add(url);
  }
  return urls;
}

async function main(): Promise<void> {
  const root = await waitForSelector('a[href*="/in/"]', { timeoutMs: 15_000 });
  if (!root) return;

  await sleep(1500); // let the full list render

  const stillPending = scrapeStillPendingUrls();
  const { leads } = await api.listLeads({ status: "CONNECT_PENDING", pageSize: "200" });

  for (const lead of leads) {
    if (stillPending.has(lead.linkedinProfileUrl)) continue;
    try {
      await api.sendLeadEvent(lead.id, "CONNECTION_ACCEPTED");
      // Queued for human approval (Messages tab) — never sent automatically.
      await api.enqueueAction({
        leadId: lead.id,
        actionType: "send_message",
        details: { messageType: "welcome_message" },
      });
      console.log(`[lgx] network-invitations: ${lead.fullName} accepted — welcome message queued for approval`);
    } catch (err) {
      console.warn("[lgx] network-invitations: failed to process acceptance for", lead.id, err);
    }
  }
}

void main();
