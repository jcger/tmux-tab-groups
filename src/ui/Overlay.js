export const overlayCSS = `.fuzzy-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background: rgba(0, 0, 0, 0.4) !important;
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  padding-top: 120px !important;
  z-index: 2147483647 !important;
}

.fuzzy-dialog {
  background: rgba(255, 255, 255, 0.95) !important;
  border-radius: 12px !important;
  width: 600px !important;
  box-shadow: 0 25px 100px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  overflow: hidden !important;
}

.fuzzy-search {
  background: transparent !important;
  border: none !important;
  padding: 20px 24px !important;
  color: #333 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 18px !important;
  outline: none !important;
  width: 100% !important;
  box-sizing: border-box !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
}

.fuzzy-search::placeholder {
  color: #999 !important;
}

.fuzzy-results {
  max-height: 320px !important;
  overflow-y: auto !important;
}

.group-item {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 12px 24px !important;
  cursor: pointer !important;
  transition: background-color 0.1s ease !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  color: #333 !important;
}

.group-item.selected {
  background: #007aff !important;
  color: white !important;
}

.group-item.hibernated {
  opacity: 0.75 !important;
}

.group-item.hibernated.selected {
  background: #6c7b7f !important;
  color: white !important;
}

.group-content {
  display: flex !important;
  align-items: center !important;
  flex: 1 !important;
}

.group-icon {
  font-size: 14px !important;
  margin-right: 12px !important;
  width: 16px !important;
  text-align: center !important;
}

.group-number {
  background: #007aff !important;
  color: white !important;
  width: 20px !important;
  height: 20px !important;
  border-radius: 4px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-weight: 600 !important;
  margin-right: 12px !important;
  font-size: 11px !important;
}

.group-item.selected .group-number {
  background: rgba(255, 255, 255, 0.3) !important;
}

.group-info {
  flex: 1 !important;
}

.group-title {
  font-weight: 500 !important;
  margin-bottom: 2px !important;
}

.group-subtitle {
  font-size: 12px !important;
  opacity: 0.7 !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.hibernated-badge {
  font-size: 10px !important;
  padding: 2px 4px !important;
  background: rgba(108, 123, 127, 0.3) !important;
  border-radius: 3px !important;
  color: #6c7b7f !important;
}

.group-item.selected .hibernated-badge {
  background: rgba(255, 255, 255, 0.3) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

.current-label {
  font-size: 11px !important;
  opacity: 0.7 !important;
  font-weight: 500 !important;
}

.group-item.selected .current-label {
  opacity: 0.8 !important;
}

.fuzzy-results::-webkit-scrollbar {
  width: 6px !important;
}

.fuzzy-results::-webkit-scrollbar-track {
  background: transparent !important;
}

.fuzzy-results::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 3px !important;
}

.fuzzy-results::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}`;

export class Overlay {
  static async injectCSS(tabId) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        css: overlayCSS,
      });
      return true;
    } catch (error) {
      console.error("Failed to inject CSS:", error);
      return false;
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
              <input
                type="text"
                class="fuzzy-search"
                placeholder="${placeholder}"
                value="${currentValue.replace(/"/g, "&quot;")}"
              />
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
