import { api } from "../lib/apiRelay.js";
import { sleep } from "../lib/delay.js";
import { text, waitForSelector } from "../lib/dom.js";
import { hasLoggedMessage, markMessageLogged } from "../lib/storage.js";

/**
 * The compact inbox list doesn't expose profile URLs per conversation, so replies are
 * matched to leads by display name — a best-effort heuristic, not an exact match.
 */
async function scanInbox(): Promise<void> {
  const items = Array.from(
    document.querySelectorAll<HTMLElement>('li[class*="conversation-listitem"]'),
  );
  if (items.length === 0) return;

  const { leads } = await api.listLeads({ pageSize: "200" });
  const leadsByName = new Map(leads.map((lead) => [lead.fullName.toLowerCase().trim(), lead]));

  for (const item of items) {
    const isUnread = item.matches('[class*="unread"]') || item.querySelector('[class*="unread"]') !== null;
    if (!isUnread) continue;

    const name = text(item.querySelector('[class*="participant-names"]'));
    if (!name) continue;

    const lead = leadsByName.get(name.toLowerCase().trim());
    if (!lead) continue;

    const preview = text(item.querySelector('[class*="message-snippet"]')) ?? "";
    const dedupeKey = `${lead.id}::${preview}`;
    if (await hasLoggedMessage(dedupeKey)) continue;

    try {
      await api.logMessage(lead.id, {
        direction: "inbound",
        messageType: "manual",
        content: preview,
        sentAt: new Date().toISOString(),
      });
      await markMessageLogged(dedupeKey);
      console.log(`[lgx] messaging: logged inbound reply from ${name}`);
    } catch (err) {
      console.warn("[lgx] messaging: failed to log inbound message", err);
    }
  }
}

async function main(): Promise<void> {
  const root = await waitForSelector('li[class*="conversation-listitem"]', { timeoutMs: 15_000 });
  if (!root) return;

  await sleep(1500);
  void scanInbox();

  const observer = new MutationObserver(() => void scanInbox());
  observer.observe(document.body, { childList: true, subtree: true });
}

void main();
