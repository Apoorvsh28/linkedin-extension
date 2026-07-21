import type { ScrapedLeadCardDto } from "@lgx/shared";
import { api } from "../lib/apiRelay.js";
import { sleep } from "../lib/delay.js";
import { text, waitForSelector } from "../lib/dom.js";
import { randomScroll } from "../lib/humanSim.js";
import { normalizeProfileUrl } from "../lib/linkedin.js";
import type { ExecuteSearchResult, RuntimeMessage } from "../lib/messages.js";
import { classifyPersona } from "../lib/persona.js";
import {
  highlightElement,
  isSelectorTestModeEnabled,
  reportSelectorChecks,
  type SelectorCheck,
} from "../lib/selectorInspector.js";

const seenProfileUrls = new Set<string>();
let scanTimer: ReturnType<typeof setTimeout> | undefined;

/** Try several container strategies since LinkedIn has used both <li> and <div>-based result cards. */
function findCardContainer(anchor: HTMLAnchorElement): Element | null {
  return (
    anchor.closest("li") ??
    anchor.closest('[data-view-name="search-entity-result-universal-template"]') ??
    anchor.closest(".entity-result") ??
    anchor.closest(".reusable-search__result-container") ??
    null
  );
}

function extractCards(campaignId?: string): ScrapedLeadCardDto[] {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'));
  const cards: ScrapedLeadCardDto[] = [];
  let skippedNoName = 0;

  for (const anchor of anchors) {
    const url = normalizeProfileUrl(anchor.href);
    if (!url || seenProfileUrls.has(url)) continue;

    const nameEl = anchor.querySelector('span[aria-hidden="true"]') ?? anchor;
    const fullName = text(nameEl);
    if (!fullName) {
      skippedNoName++;
      continue;
    }

    // Headline/location are best-effort — a missing container still yields a usable lead (name + URL).
    const card = findCardContainer(anchor);
    const subtitleTexts = card
      ? Array.from(card.querySelectorAll('span[aria-hidden="true"]'))
          .map((el) => text(el))
          .filter((v): v is string => v !== null && v !== fullName)
      : [];

    const headline =
      text(card?.querySelector(".entity-result__primary-subtitle, .entity-result__secondary-subtitle")) ??
      subtitleTexts[0] ??
      null;
    const location = text(card?.querySelector(".entity-result__secondary-subtitle")) ?? subtitleTexts[1] ?? null;

    seenProfileUrls.add(url);
    cards.push({
      linkedinProfileUrl: url,
      fullName,
      headline,
      location,
      persona: classifyPersona(headline),
      ...(campaignId ? { campaignId } : {}),
    });
  }

  if (cards.length === 0 && anchors.length > 0) {
    console.warn(
      `[lgx] search-scraper: found ${anchors.length} profile link(s) on the page but extracted 0 leads ` +
        `(${skippedNoName} had no readable name via span[aria-hidden="true"]). ` +
        "LinkedIn's markup has likely changed — this selector needs updating.",
    );
  }

  return cards;
}

async function scan(campaignId?: string): Promise<number> {
  const cards = extractCards(campaignId);
  if (cards.length === 0) return 0;

  try {
    await api.upsertLeads(cards);
    console.log(`[lgx] search-scraper: upserted ${cards.length} lead(s)`);
    return cards.length;
  } catch (err) {
    console.error("[lgx] search-scraper: upsert failed", err);
    return 0;
  }
}

function scheduleScan(): void {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => void scan(), 1200);
}

/** Waits for results with retries — LinkedIn's SPA shell can be slow to hydrate under automation. */
async function waitForResultsWithRetry(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const found = await waitForSelector('ul.reusable-search__entity-result-list, a[href*="/in/"]', {
      timeoutMs: 10_000,
    });
    if (found) return true;
    console.warn(`[lgx] search-scraper: results not loaded yet (attempt ${attempt}/${maxAttempts}), retrying…`);
    await sleep(3000);
  }
  return false;
}

/** Scrolls to the bottom repeatedly (bounded) to trigger LinkedIn's infinite-scroll pagination. */
async function scrollAndCollect(campaignId: string | undefined, maxScrolls = 6): Promise<number> {
  let total = 0;
  let consecutiveEmptyScrolls = 0;

  total += await scan(campaignId);

  for (let i = 0; i < maxScrolls && consecutiveEmptyScrolls < 2; i++) {
    await randomScroll(1); // a small human-like scroll before the big pagination jump
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await sleep(2000 + Math.random() * 1500);

    const found = await scan(campaignId);
    total += found;
    consecutiveEmptyScrolls = found === 0 ? consecutiveEmptyScrolls + 1 : 0;
  }

  return total;
}

async function executeSearchTask(): Promise<ExecuteSearchResult> {
  const ok = await waitForResultsWithRetry();
  if (!ok) {
    return { status: "failed", errorMessage: "search results never loaded after retries" };
  }

  const url = new URL(location.href);
  const campaignId = url.searchParams.get("lgxCampaignId") ?? undefined;

  const leadsFound = await scrollAndCollect(campaignId);
  return { status: "success", leadsFound };
}

async function main(): Promise<void> {
  const resultsList = await waitForSelector('ul.reusable-search__entity-result-list, a[href*="/in/"]', {
    timeoutMs: 15_000,
  });
  if (!resultsList) {
    console.warn("[lgx] search-scraper: no results list found within 15s on", location.href);
    return;
  }

  void scan();
  void runSelectorDiagnostics();

  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Diagnostic-only pass — doesn't touch seenProfileUrls, just highlights what the real extraction would find. */
async function runSelectorDiagnostics(): Promise<void> {
  if (!(await isSelectorTestModeEnabled())) return;

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/in/"]'));
  let withName = 0;
  let withContainer = 0;

  for (const anchor of anchors.slice(0, 20)) {
    const nameEl = anchor.querySelector('span[aria-hidden="true"]') ?? anchor;
    const hasName = !!text(nameEl);
    const container = findCardContainer(anchor);
    if (hasName) withName++;
    if (container) withContainer++;
    highlightElement(container ?? anchor, hasName ? "#4ade80" : "#f87171");
  }

  const checks: SelectorCheck[] = [
    { label: "Profile links found", found: anchors.length > 0, detail: String(anchors.length) },
    { label: "...with a readable name", found: withName > 0, detail: `${withName}/${Math.min(anchors.length, 20)}` },
    { label: "...with a card container", found: withContainer > 0, detail: `${withContainer}/${Math.min(anchors.length, 20)}` },
  ];
  reportSelectorChecks("Search results", checks);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type !== "EXECUTE_SEARCH") return false;
  executeSearchTask()
    .then(sendResponse)
    .catch((err) => sendResponse({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) }));
  return true;
});

void main();
