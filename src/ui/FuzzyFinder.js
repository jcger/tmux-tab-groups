import { EXTENSION_BOOKMARK_FOLDER } from "../background.js";
import { overlayCSS } from "./Overlay.js";

export class FuzzyFinder {
  static async show() {
    // Get active groups
    const activeGroups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });

    // Get hibernated groups
    const hibernatedGroups = await this.getHibernatedGroups();

    if (activeGroups.length === 0 && hibernatedGroups.length === 0) return;

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Inject CSS
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: currentTab.id },
        css: overlayCSS,
      });
    } catch (error) {
      console.error("Failed to inject CSS:", error);
      return;
    }
    // Prepare active groups with metadata
    const activeGroupsWithInfo = await Promise.all(
      activeGroups.map(async (group) => {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        return {
          ...group,
          tabCount: tabs.length,
          title: group.title || `Group ${group.id}`,
          isHibernated: false,
          type: "active",
        };
      }),
    );

    // Combine and sort groups (active first, then hibernated)
    const allGroups = [...activeGroupsWithInfo, ...hibernatedGroups];

    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: (groups, currentGroupId) => {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.className = "fuzzy-overlay";
        overlay.innerHTML = `
          <div class="fuzzy-dialog">
            <input type="text" class="fuzzy-search" placeholder="Search groups..." />
            <div class="fuzzy-results"></div>
          </div>
        `;
        document.body.appendChild(overlay);

        // Component logic
        const searchInput = overlay.querySelector(".fuzzy-search");
        const resultsContainer = overlay.querySelector(".fuzzy-results");
        let filteredGroups = [...groups];
        let selectedIndex = 0;

        function renderGroups() {
          resultsContainer.innerHTML = filteredGroups
            .map((group, index) => {
              const isCurrent =
                !group.isHibernated && group.id === currentGroupId;
              const isSelected = index === selectedIndex;
              const icon = group.isHibernated ? "💤" : "📁";
              const hibernatedClass = group.isHibernated ? "hibernated" : "";
              const hibernatedBadge = group.isHibernated
                ? '<span class="hibernated-badge">hibernated</span>'
                : "";

              return `
              <div class="group-item ${isSelected ? "selected" : ""} ${
                isCurrent ? "current" : ""
              } ${hibernatedClass}"
                   data-group-id="${
                     group.id
                   }" data-index="${index}" data-hibernated="${
                     group.isHibernated
                   }">
                <div class="group-content">
                  <div class="group-icon">${icon}</div>
                  <div class="group-info">
                    <div class="group-title">${group.title}</div>
                    <div class="group-subtitle">
                      ${group.tabCount} tab${group.tabCount !== 1 ? "s" : ""}
                      ${hibernatedBadge}
                    </div>
                  </div>
                </div>
                ${isCurrent ? '<span class="current-label">current</span>' : ""}
              </div>
            `;
            })
            .join("");

          // Add click handlers
          resultsContainer.querySelectorAll("[data-group-id]").forEach((el) => {
            el.onclick = () => {
              selectedIndex = parseInt(el.dataset.index);
              const isHibernated = el.dataset.hibernated === "true";
              selectGroup(el.dataset.groupId, isHibernated);
            };
          });

          // Scroll selected item into view
          const selectedElement = resultsContainer.children[selectedIndex];
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: "nearest" });
          }
        }

        function moveSelection(direction) {
          const newIndex = selectedIndex + direction;
          if (newIndex >= 0 && newIndex < filteredGroups.length) {
            selectedIndex = newIndex;
            renderGroups();
          }
        }

        function filterGroups(searchTerm) {
          if (!searchTerm.trim()) {
            filteredGroups = [...groups];
          } else {
            const term = searchTerm.toLowerCase();
            filteredGroups = groups.filter((group) =>
              group.title.toLowerCase().includes(term),
            );
          }
          selectedIndex = 0;
          renderGroups();
        }

        function selectGroup(groupId, isHibernated) {
          if (isHibernated) {
            const folderId = groupId.replace("hibernated_", "");
            chrome.runtime.sendMessage({
              type: "restore-hibernated-group",
              folderId,
            });
          } else {
            chrome.runtime.sendMessage({
              type: "switch-to-group",
              groupId: parseInt(groupId),
            });
          }
          cleanup();
        }

        function cleanup() {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          document.removeEventListener("keydown", handleKeydown);
        }

        function handleKeydown(e) {
          if (e.key === "Escape") {
            cleanup();
            return;
          }

          if (e.ctrlKey && e.key === "p") {
            e.preventDefault();
            moveSelection(-1);
            return;
          }
          if (e.ctrlKey && e.key === "n") {
            e.preventDefault();
            moveSelection(1);
            return;
          }

          if (e.key === "Enter") {
            e.preventDefault();
            if (
              filteredGroups.length > 0 &&
              selectedIndex < filteredGroups.length
            ) {
              const selectedGroup = filteredGroups[selectedIndex];
              selectGroup(selectedGroup.id, selectedGroup.isHibernated);
            }
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            moveSelection(-1);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            moveSelection(1);
            return;
          }

          const num = parseInt(e.key);
          if (num >= 1 && num <= filteredGroups.length) {
            selectedIndex = num - 1;
            const selectedGroup = filteredGroups[num - 1];
            selectGroup(selectedGroup.id, selectedGroup.isHibernated);
            return;
          }

          if (document.activeElement !== searchInput && !e.ctrlKey) {
            searchInput.focus();
          }
        }

        // Setup
        searchInput.oninput = (e) => filterGroups(e.target.value);
        renderGroups();
        searchInput.focus();
        document.addEventListener("keydown", handleKeydown);
      },
      args: [allGroups, currentTab.groupId],
    });
  }

  static async getHibernatedGroups() {
    try {
      // Find extension root folder
      const searchResults = await chrome.bookmarks.search({
        title: EXTENSION_BOOKMARK_FOLDER,
      });

      const rootFolder = searchResults.find((result) => !result.url);
      if (!rootFolder) return [];

      // Get all group folders
      const groupFolders = await chrome.bookmarks.getChildren(rootFolder.id);

      const hibernatedGroups = await Promise.all(
        groupFolders.map(async (folder) => {
          const bookmarks = await chrome.bookmarks.getChildren(folder.id);
          return {
            id: `hibernated_${folder.id}`,
            title: folder.title,
            tabCount: bookmarks.length,
            bookmarkFolderId: folder.id,
            isHibernated: true,
            type: "hibernated",
          };
        }),
      );

      return hibernatedGroups;
    } catch (error) {
      console.error("Failed to get hibernated groups:", error);
      return [];
    }
  }
}
