import type { MessageType, NextActionDto, ProfileSnapshotDto } from "@lgx/shared";
import { api } from "../lib/apiRelay.js";
import { randomIntBetween, sleep } from "../lib/delay.js";
import { simulateClick, simulateTyping, text, waitForSelector } from "../lib/dom.js";
import { randomScroll, readingDelayMs } from "../lib/humanSim.js";
import type { ExecuteActionResult, RuntimeMessage } from "../lib/messages.js";
import {
  highlightElement,
  isSelectorTestModeEnabled,
  reportSelectorChecks,
  type SelectorCheck,
} from "../lib/selectorInspector.js";

/**
 * LinkedIn's markup uses algorithmically-generated class names that change often —
 * these selectors are best-effort and will need periodic maintenance against the live site.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * LinkedIn typically renders a button's visible label inside a nested
 * `span[aria-hidden="true"]`, with a longer screen-reader-only description as a sibling
 * (e.g. "Connect" visible + "Invite Jane Doe to connect" hidden). Reading raw
 * `button.textContent` concatenates both and breaks exact-text matching — read the
 * aria-hidden span specifically instead.
 */
function buttonLabel(button: HTMLElement): string {
  const visible = button.querySelector('span[aria-hidden="true"]');
  return normalizeText(visible?.textContent ?? button.textContent);
}

function findButtonByText(pattern: RegExp, root: ParentNode = document): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll<HTMLElement>("button"));
  return (
    buttons.find((b) => pattern.test(buttonLabel(b)) || pattern.test(normalizeText(b.getAttribute("aria-label")))) ??
    null
  );
}

/** Best-effort diagnostic: when a target button can't be found, log what's actually on the page. */
function logAvailableButtons(context: string, root: ParentNode = document): void {
  const labels = Array.from(root.querySelectorAll<HTMLElement>("button"))
    .map((b) => buttonLabel(b) || normalizeText(b.getAttribute("aria-label")))
    .filter((label) => label.length > 0);
  console.warn(`[lgx] ${context} — visible buttons on page:`, labels);
}

function scrapeSnapshot(): ProfileSnapshotDto {
  const headline = text(document.querySelector(".text-body-medium.break-words"));
  const aboutSection = document.querySelector("#about")?.closest("section");
  const aboutText = text(aboutSection?.querySelector('span[aria-hidden="true"]'));
  const experienceSection = document.querySelector("#experience")?.closest("section");
  const firstRole = experienceSection?.querySelector("li");
  const currentPosition = text(firstRole?.querySelector('span[aria-hidden="true"]'));
  const roleSpans = firstRole
    ? Array.from(firstRole.querySelectorAll<HTMLElement>('span[aria-hidden="true"]'))
    : [];
  const company = text(roleSpans[1]);

  const activityTimestamps = Array.from(
    document.querySelectorAll('.update-components-actor__sub-description span[aria-hidden="true"]'),
  )
    .map((el) => text(el))
    .filter((v): v is string => v !== null);

  return {
    headline,
    aboutText,
    currentPosition,
    company,
    activitySignals: {
      recentPostTimestamps: activityTimestamps,
      postCountLast30Days: activityTimestamps.length,
    },
    rawExtract: { url: location.href, title: document.title },
  };
}

function findPostCards(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-view-name="profile-component-entity"] .feed-shared-update-v2, .profile-creator-shared-feed-update__container',
    ),
  );
}

function findPostUrl(postCard: HTMLElement): string | null {
  const link = postCard.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"]');
  return link ? (link.href.split("?")[0] ?? link.href) : null;
}

/** Picks the first post whose URL isn't in excludeUrls (used by Day3's "like another post"). */
function findFirstPostCard(excludeUrls: string[] = []): HTMLElement | null {
  const cards = findPostCards();
  return cards.find((card) => {
    const url = findPostUrl(card);
    return !url || !excludeUrls.includes(url);
  }) ?? null;
}

async function performLike(action: NextActionDto): Promise<ExecuteActionResult> {
  const excludePostUrls = (action.details?.excludePostUrls as string[] | undefined) ?? [];
  const postCard = findFirstPostCard(excludePostUrls);
  if (!postCard) {
    return { status: "skipped", errorMessage: "no unliked post available" };
  }

  const likeBtn = findButtonByText(/^like$/i, postCard);
  if (!likeBtn) {
    logAvailableButtons("performLike", postCard);
    return { status: "skipped", errorMessage: "no visible post to like" };
  }
  await simulateClick(likeBtn);

  const likedPostUrl = findPostUrl(postCard);
  return { status: "success", details: likedPostUrl ? { likedPostUrl } : undefined };
}

async function performComment(leadId: string): Promise<ExecuteActionResult> {
  const postCard = findFirstPostCard();
  if (!postCard) return { status: "skipped", errorMessage: "no visible post to comment on" };

  const postSummary = text(postCard) ?? "";
  const commentBtn = findButtonByText(/^comment$/i, postCard);
  if (!commentBtn) {
    logAvailableButtons("performComment", postCard);
    return { status: "skipped", errorMessage: "comment button not found" };
  }

  await simulateClick(commentBtn);
  await sleep(700);

  const editor = await waitForSelector('div[role="textbox"]', { timeoutMs: 5000, root: postCard });
  if (!editor) return { status: "skipped", errorMessage: "comment editor not found" };

  const { content } = await api.nextComment(leadId, postSummary.slice(0, 500));
  await simulateTyping(editor as HTMLElement, content);
  await sleep(500);

  const submitBtn = findButtonByText(/^(comment|post)$/i, postCard);
  if (!submitBtn) return { status: "skipped", errorMessage: "comment submit button not found", details: { content } };
  await simulateClick(submitBtn);

  return { status: "success", details: { content } };
}

async function performConnect(action: NextActionDto): Promise<ExecuteActionResult> {
  let connectBtn = findButtonByText(/^connect$/i) ?? findButtonByText(/invite.*to connect/i);

  if (!connectBtn) {
    const moreBtn = findButtonByText(/^more$/i);
    if (moreBtn) {
      await simulateClick(moreBtn);
      await sleep(600);
      connectBtn = findButtonByText(/^connect$/i);
    }
  }

  if (!connectBtn) {
    logAvailableButtons("performConnect");
    return { status: "skipped", errorMessage: "connect button not found (already connected/pending?)" };
  }

  await simulateClick(connectBtn);
  await sleep(800);

  // The connection note was rendered from the campaign's template at approval time.
  const content = action.details?.content as string | undefined;
  if (content) {
    const addNoteBtn = findButtonByText(/add a note/i);
    if (addNoteBtn) {
      await simulateClick(addNoteBtn);
      await sleep(500);
      const noteBox = await waitForSelector("textarea", { timeoutMs: 4000 });
      if (noteBox) await simulateTyping(noteBox as HTMLElement, content);
    }
  }

  const sendBtn = findButtonByText(/^send$/i) ?? findButtonByText(/send without a note/i);
  if (!sendBtn) return { status: "skipped", errorMessage: "send button not found", details: content ? { content } : undefined };
  await simulateClick(sendBtn);

  return { status: "success", details: content ? { content } : undefined };
}

async function performSendMessage(action: NextActionDto): Promise<ExecuteActionResult> {
  const messageBtn = findButtonByText(/^message$/i);
  if (!messageBtn) {
    logAvailableButtons("performSendMessage");
    return { status: "skipped", errorMessage: "message button not found (not connected yet?)" };
  }

  await simulateClick(messageBtn);
  const editor = await waitForSelector('div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"]', {
    timeoutMs: 8000,
  });
  if (!editor) return { status: "skipped", errorMessage: "message compose box not found" };

  const messageType = ((action.details?.messageType as MessageType | undefined) ?? "welcome_message") satisfies MessageType;
  const preRendered = action.details?.content as string | undefined;
  const content = preRendered ?? (await api.nextMessage(action.leadId, messageType)).content;
  await simulateTyping(editor as HTMLElement, content);
  await sleep(500);

  const sendBtn = findButtonByText(/^send$/i);
  if (!sendBtn) return { status: "skipped", errorMessage: "send button not found", details: { content } };
  await simulateClick(sendBtn);

  await api
    .logMessage(action.leadId, {
      direction: "outbound",
      messageType,
      content,
      sentAt: new Date().toISOString(),
    })
    .catch((err) => console.warn("[lgx] failed to log sent message", err));

  return { status: "success", details: { content } };
}

async function performCheckConnectionStatus(leadId: string): Promise<ExecuteActionResult> {
  const status = findButtonByText(/^message$/i) ? "accepted" : findButtonByText(/pending/i) ? "pending" : "none";

  if (status === "accepted") {
    await api
      .sendLeadEvent(leadId, "CONNECTION_ACCEPTED")
      .catch((err) => console.warn("[lgx] sendLeadEvent failed", err));
  }

  return { status: "success", details: { connectionStatus: status } };
}

async function handleAction(action: NextActionDto): Promise<ExecuteActionResult> {
  const nameEl = await waitForSelector("h1", { timeoutMs: 10_000 });
  if (!nameEl) return { status: "failed", errorMessage: "profile did not load (no h1 found)" };

  // Human session simulation: scroll a bit, then read for a duration calibrated to how much text is visible.
  await randomScroll(randomIntBetween(2, 4));
  await sleep(readingDelayMs(document.body.innerText.slice(0, 2000)));

  try {
    const snapshot = scrapeSnapshot();
    await api.postSnapshot(action.leadId, snapshot);
  } catch (err) {
    console.warn("[lgx] profile snapshot failed", err);
  }

  switch (action.actionType) {
    case "view_profile":
      return { status: "success" };
    case "like_post":
      return performLike(action);
    case "comment_post":
      return performComment(action.leadId);
    case "connect_request":
      return performConnect(action);
    case "send_message":
      return performSendMessage(action);
    case "check_connection_status":
      return performCheckConnectionStatus(action.leadId);
    default:
      return { status: "skipped", errorMessage: `profile.ts cannot handle ${action.actionType}` };
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type !== "EXECUTE_ACTION") return false;
  handleAction(message.action)
    .then(sendResponse)
    .catch((err) => sendResponse({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) }));
  return true;
});

async function runSelectorDiagnostics(): Promise<void> {
  if (!(await isSelectorTestModeEnabled())) return;

  const nameEl = await waitForSelector("h1", { timeoutMs: 8000 });
  await sleep(500);

  const checks: SelectorCheck[] = [];

  checks.push({ label: "Name (h1)", found: !!nameEl, detail: text(nameEl as Element | null) ?? undefined });
  highlightElement(nameEl as Element | null, "#60a5fa");

  const connectBtn = findButtonByText(/^connect$/i) ?? findButtonByText(/invite.*to connect/i);
  checks.push({ label: "Connect button", found: !!connectBtn });
  highlightElement(connectBtn, "#f87171");

  const messageBtn = findButtonByText(/^message$/i);
  checks.push({ label: "Message button", found: !!messageBtn });
  highlightElement(messageBtn, "#facc15");

  const postCard = findFirstPostCard();
  checks.push({ label: "First post card", found: !!postCard });
  highlightElement(postCard, "#a78bfa");

  if (postCard) {
    const likeBtn = findButtonByText(/^like$/i, postCard);
    checks.push({ label: "Like button (in post)", found: !!likeBtn });
    highlightElement(likeBtn, "#4ade80");

    const commentBtn = findButtonByText(/^comment$/i, postCard);
    checks.push({ label: "Comment button (in post)", found: !!commentBtn });
    highlightElement(commentBtn, "#4ade80");
  }

  reportSelectorChecks("Profile page", checks);
}

void runSelectorDiagnostics();
