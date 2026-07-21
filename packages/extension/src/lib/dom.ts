import { microActionDelayMs, randomIntBetween, sleep } from "./delay.js";

export async function waitForSelector(
  selector: string,
  { timeoutMs = 8000, root = document }: { timeoutMs?: number; root?: ParentNode } = {},
): Promise<Element | null> {
  const existing = root.querySelector(selector);
  if (existing) return existing;

  return new Promise((resolve) => {
    const observeRoot = root === document ? document.body : root;
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(observeRoot as Node, { childList: true, subtree: true });
  });
}

export function text(el: Element | null | undefined): string | null {
  const value = el?.textContent?.trim().replace(/\s+/g, " ");
  return value && value.length > 0 ? value : null;
}

/** Dispatches a realistic pointer/mouse event sequence rather than calling .click() directly. */
export async function simulateClick(el: Element): Promise<void> {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(microActionDelayMs());
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

/**
 * Types character-by-character using native property setters so React-controlled
 * inputs and contenteditable composers pick up the change via their input listeners.
 */
export async function simulateTyping(el: HTMLElement, value: string): Promise<void> {
  el.focus();
  await sleep(microActionDelayMs());

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    let current = "";
    for (const char of value) {
      current += char;
      setter?.call(el, current);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(randomIntBetween(20, 90));
    }
  } else {
    let current = "";
    for (const char of value) {
      current += char;
      el.textContent = current;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }));
      await sleep(randomIntBetween(20, 90));
    }
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
