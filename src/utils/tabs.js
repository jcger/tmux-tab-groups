const RESTRICTED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "brave://",
  "edge://",
  "about:",
  "view-source:",
  "devtools://",
  "chrome-search://",
  "chrome-untrusted://",
];

export function isRestrictedUrl(url = "") {
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function canInjectIntoTab(tab) {
  if (!tab?.id || tab.id === chrome.tabs.TAB_ID_NONE) return false;
  // Empty / missing URL can happen while loading; treat as restricted to be safe.
  if (!tab.url) return false;
  return !isRestrictedUrl(tab.url);
}

export async function getCenteredPopupBounds(
  width,
  height,
  windowId = chrome.windows.WINDOW_ID_CURRENT,
) {
  try {
    const current = await chrome.windows.get(windowId);
    const left = Math.round(current.left + (current.width - width) / 2);
    const top = Math.round(current.top + (current.height - height) / 3);
    return {
      width,
      height,
      left: Math.max(0, left),
      top: Math.max(0, top),
    };
  } catch {
    return { width, height };
  }
}
