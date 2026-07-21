/**
 * Selector testing mode — a visible on-page overlay so selectors can be verified against real
 * LinkedIn markup without console access. Toggled from the popup; persisted in chrome.storage.
 */

export async function isSelectorTestModeEnabled(): Promise<boolean> {
  const { selectorTestMode } = await chrome.storage.local.get("selectorTestMode");
  return selectorTestMode === true;
}

export async function setSelectorTestMode(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ selectorTestMode: enabled });
}

export interface SelectorCheck {
  label: string;
  found: boolean;
  detail?: string;
}

let panel: HTMLDivElement | null = null;

function ensurePanel(): HTMLDivElement {
  if (panel && document.body.contains(panel)) return panel;
  panel = document.createElement("div");
  panel.id = "lgx-selector-panel";
  panel.style.cssText = [
    "position:fixed",
    "top:8px",
    "right:8px",
    "z-index:2147483647",
    "background:rgba(20,20,20,0.92)",
    "color:#fff",
    "font:12px/1.4 -apple-system,sans-serif",
    "padding:10px 12px",
    "border-radius:8px",
    "max-width:320px",
    "max-height:70vh",
    "overflow-y:auto",
    "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
  ].join(";");
  document.body.appendChild(panel);
  return panel;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function reportSelectorChecks(pageType: string, checks: SelectorCheck[]): void {
  const p = ensurePanel();
  const rows = checks
    .map(
      (c) =>
        `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.1)">` +
        `<span style="color:${c.found ? "#4ade80" : "#f87171"}">${c.found ? "✓" : "✗"}</span> ` +
        `<strong>${escapeHtml(c.label)}</strong>${c.detail ? ` — ${escapeHtml(c.detail)}` : ""}` +
        `</div>`,
    )
    .join("");
  p.innerHTML =
    `<div style="font-weight:700;margin-bottom:6px">[lgx] ${escapeHtml(pageType)} selectors</div>${rows}` +
    `<div style="margin-top:8px;color:#999">Re-run: reload the page</div>`;
}

export function highlightElement(el: Element | null | undefined, color = "#f87171"): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "lgx-selector-highlight";
  box.style.cssText = [
    "position:fixed",
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    `border:2px solid ${color}`,
    "z-index:2147483646",
    "pointer-events:none",
    "border-radius:3px",
    "box-sizing:border-box",
  ].join(";");
  document.body.appendChild(box);
}
