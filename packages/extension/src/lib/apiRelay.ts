import type { api as ApiShape } from "./api.js";
import type { ApiCallResponse } from "./messages.js";

type Api = typeof ApiShape;

function callApi<K extends keyof Api>(method: K, args: unknown[]): Promise<Awaited<ReturnType<Api[K]>>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "API_CALL", method, args }, (response: ApiCallResponse | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error ?? "API relay failed"));
        return;
      }
      resolve(response.result as Awaited<ReturnType<Api[K]>>);
    });
  });
}

/**
 * Drop-in replacement for lib/api.ts's `api` export, for use inside content scripts only —
 * relays every call through the background service worker instead of fetching directly,
 * since a content script's fetch() to http://localhost is blocked as mixed content on
 * https://www.linkedin.com. Same method names/signatures as lib/api.ts.
 */
export const api: Api = new Proxy({} as Api, {
  get(_target, prop: string) {
    return (...args: unknown[]) => callApi(prop as keyof Api, args);
  },
}) as Api;
