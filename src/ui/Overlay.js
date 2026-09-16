let cachedOverlayCSS = null;

export async function getOverlayCSS() {
  if (cachedOverlayCSS) return cachedOverlayCSS;
  const response = await fetch(chrome.runtime.getURL("overlay.css"));
  cachedOverlayCSS = await response.text();
  return cachedOverlayCSS;
}

export class Overlay {
  static async injectCSS(tabId) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["overlay.css"],
      });
      return true;
    } catch (error) {
      // Fallback for environments where files injection fails
      try {
        const css = await getOverlayCSS();
        await chrome.scripting.insertCSS({
          target: { tabId },
          css,
        });
        return true;
      } catch (fallbackError) {
        console.error("Failed to inject CSS:", fallbackError);
        return false;
      }
    }
  }

  static async showPrompt(tabId, title, placeholder, currentValue = "") {
    if (!(await this.injectCSS(tabId))) return null;

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (title, placeholder, currentValue) => {
        return new Promise((resolve) => {
          const overlay = document.createElement("div");
          overlay.className = "fuzzy-overlay";
          overlay.innerHTML = `
            <div class="fuzzy-dialog">
              <div class="fuzzy-search-row">
                <div class="fuzzy-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1.5L14.5 8L8 14.5L1.5 8L8 1.5Z" fill="white" fill-opacity="0.95"/>
                  </svg>
                </div>
                <input
                  type="text"
                  class="fuzzy-search"
                  placeholder="${placeholder}"
                  value="${currentValue.replace(/"/g, "&quot;")}"
                  aria-label="${title}"
                />
              </div>
            </div>
          `;
          document.body.appendChild(overlay);

          const input = overlay.querySelector(".fuzzy-search");

          function cleanup() {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
            document.removeEventListener("keydown", handleKeydown);
          }

          function submit() {
            const value = input.value.trim();
            cleanup();
            resolve(value || null);
          }

          function cancel() {
            cleanup();
            resolve(null);
          }

          function handleKeydown(e) {
            if (e.key === "Escape") {
              cancel();
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }

          overlay.onclick = (e) => {
            if (e.target === overlay) cancel();
          };

          input.select();
          input.focus();
          document.addEventListener("keydown", handleKeydown);
        });
      },
      args: [title, placeholder, currentValue],
    });

    return result?.[0]?.result || null;
  }
}
