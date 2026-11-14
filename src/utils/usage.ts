// Privacy-safe usage counting. Sends only fixed keys (no layout content, names, files, sizes, URLs).
// Active only on the production host or the Vite dev server. Never throws, never blocks the UI.
// Test hook: window.__FL_USAGE_TEST__ = true forces sending (used by automated checks only).
const USAGE_URL = "https://stp-api.plugbits.app/c";
const sent = new Set<string>();

function enabled(): boolean {
  try {
    if ((window as unknown as { __FL_USAGE_TEST__?: boolean }).__FL_USAGE_TEST__ === true) return true;
    const l = window.location;
    return l.hostname === "factory-layout.plugbits.app" || l.origin === "http://localhost:5173";
  } catch {
    return false;
  }
}

function send(keys: string[]): void {
  try {
    if (!keys.length || !enabled()) return;
    const body = JSON.stringify({ e: keys });
    if (navigator.sendBeacon && navigator.sendBeacon(USAGE_URL, new Blob([body], { type: "text/plain" }))) return;
    fetch(USAGE_URL, { method: "POST", body, keepalive: true, mode: "cors", credentials: "omit", headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch {
    // never block the UI
  }
}

function refBucket(): string {
  try {
    const ref = document.referrer;
    if (!ref) return "fl_ref_direct";
    const host = new URL(ref).hostname.toLowerCase();
    if (!host || host === window.location.hostname) return "fl_ref_direct";
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return "fl_ref_google";
    if (/(^|\.)bing\.com$/.test(host)) return "fl_ref_bing";
    if (/(^|\.)yahoo\.[a-z.]+$/.test(host)) return "fl_ref_yahoo";
    if (/(^|\.)duckduckgo\.com$/.test(host)) return "fl_ref_ddg";
    if (host === "t.co" || /(^|\.)(x|twitter)\.com$/.test(host)) return "fl_ref_x";
    if (host === "plugbits.app" || host.endsWith(".plugbits.app")) return "fl_ref_plugbits";
    if (host === "github.com" || host.endsWith(".github.io")) return "fl_ref_github";
    if (host === "note.com" || host.endsWith(".note.com")) return "fl_ref_note";
    return "fl_ref_other";
  } catch {
    return "fl_ref_other";
  }
}

export function usageVisit(lang: string): void {
  try {
    if (sent.has("fl_visit")) return;
    sent.add("fl_visit");
    send(["fl_visit", refBucket(), `fl_lang_${lang}`]);
  } catch {
    // ignore
  }
}

export function usageOnce(key: string): void {
  try {
    if (sent.has(key)) return;
    sent.add(key);
    send([key]);
  } catch {
    // ignore
  }
}

// Equipment-count bucket, sent once per visit (call at first JSON save / PNG export).
export function usageItems(n: number): void {
  try {
    if (sent.has("fl_items")) return;
    sent.add("fl_items");
    const k = n <= 0 ? "fl_items_0" : n <= 5 ? "fl_items_5" : n <= 20 ? "fl_items_20" : n <= 50 ? "fl_items_50" : "fl_items_over";
    send([k]);
  } catch {
    // ignore
  }
}
