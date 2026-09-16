import { EXTENSION_BOOKMARK_FOLDER } from "../constants.js";
import { Overlay } from "./Overlay.js";
import {
  canInjectIntoTab,
  getCenteredPopupBounds,
} from "../utils/tabs.js";

const GROUP_COLORS = {
  grey: "#8E8E93",
  blue: "#0A84FF",
  red: "#FF453A",
  yellow: "#FFD60A",
  green: "#30D158",
  pink: "#FF375F",
  purple: "#BF5AF2",
  cyan: "#64D2FF",
  orange: "#FF9F0A",
};

export class FuzzyFinder {
  static async getData(windowId = chrome.windows.WINDOW_ID_CURRENT) {
    const activeGroups = await chrome.tabGroups.query({ windowId });
    const hibernatedGroups = await this.getHibernatedGroups();

    const [currentTab] = await chrome.tabs.query({
      active: true,
      windowId,
    });

    const activeGroupsWithInfo = await Promise.all(
      activeGroups.map(async (group) => {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        return {
          ...group,
          tabCount: tabs.length,
          title: group.title || `Group ${group.id}`,
          isHibernated: false,
          type: "active",
          color: group.color || "grey",
        };
      }),
    );

    return {
      groups: [...activeGroupsWithInfo, ...hibernatedGroups],
      currentGroupId: currentTab?.groupId ?? chrome.tabGroups.TAB_GROUP_ID_NONE,
      windowId,
      tabId: currentTab?.id,
    };
  }

  static async showInPopup(windowId) {
    const bounds = await getCenteredPopupBounds(680, 520, windowId);
    await chrome.windows.create({
      url: chrome.runtime.getURL(
        `finder.html?windowId=${encodeURIComponent(windowId)}`,
      ),
      type: "popup",
      focused: true,
      ...bounds,
    });
  }

  static async show(windowId = chrome.windows.WINDOW_ID_CURRENT) {
    const data = await this.getData(windowId);
    if (data.groups.length === 0) return;

    let currentTab = null;
    if (data.tabId) {
      try {
        currentTab = await chrome.tabs.get(data.tabId);
      } catch {
        currentTab = null;
      }
    }

    if (!currentTab || !canInjectIntoTab(currentTab)) {
      await this.showInPopup(windowId);
      return;
    }

    if (!(await Overlay.injectCSS(currentTab.id))) {
      await this.showInPopup(windowId);
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: (groups, currentGroupId, colorMap) => {
          const FOLDER_ICON = `
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.172a1.5 1.5 0 0 1 1.06.44L8.5 4.707A.5.5 0 0 0 8.854 4.854L9.56 4.146A1.5 1.5 0 0 1 10.621 3.707H13A1.5 1.5 0 0 1 14.5 5.207v6.586A1.5 1.5 0 0 1 13 13.293H3A1.5 1.5 0 0 1 1.5 11.793V4.5Z" fill="white" fill-opacity="0.95"/>
            </svg>
          `;
          const MOON_ICON = `
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.2 9.55A5.75 5.75 0 0 1 6.45 2.8a5.75 5.75 0 1 0 6.75 6.75Z" fill="white" fill-opacity="0.95"/>
            </svg>
          `;
          const SEARCH_ICON = `
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1.5L14.5 8L8 14.5L1.5 8L8 1.5Z" fill="white" fill-opacity="0.95"/>
            </svg>
          `;

          const existing = document.querySelector(".fuzzy-overlay");
          if (existing) existing.remove();

          const overlay = document.createElement("div");
          overlay.className = "fuzzy-overlay";
          overlay.innerHTML = `
            <div class="fuzzy-dialog">
              <div class="fuzzy-search-row">
                <div class="fuzzy-search-icon" aria-hidden="true">${SEARCH_ICON}</div>
                <input type="text" class="fuzzy-search" placeholder="Search groups..." autocomplete="off" spellcheck="false" />
              </div>
              <div class="fuzzy-results"></div>
              <div class="fuzzy-footer">
                <span>Switch group</span>
                <div class="fuzzy-footer-actions">
                  <div class="fuzzy-footer-action"><span>Navigate</span><kbd>↑</kbd><kbd>↓</kbd></div>
                  <div class="fuzzy-footer-action"><span>Open</span><kbd>↵</kbd></div>
                  <div class="fuzzy-footer-action"><span>Close</span><kbd>esc</kbd></div>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(overlay);

          const searchInput = overlay.querySelector(".fuzzy-search");
          const resultsContainer = overlay.querySelector(".fuzzy-results");
          let filteredGroups = [...groups];
          let selectedIndex = 0;

          function escapeHtml(text) {
            return String(text)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
          }

          function iconColor(group) {
            if (group.isHibernated) return "#636366";
            return colorMap[group.color] || colorMap.grey;
          }

          function renderGroups() {
            if (filteredGroups.length === 0) {
              resultsContainer.innerHTML = `<div class="fuzzy-empty">No groups found</div>`;
              return;
            }

            const active = [];
            const hibernated = [];
            filteredGroups.forEach((group, index) => {
              const entry = { group, index };
              if (group.isHibernated) hibernated.push(entry);
              else active.push(entry);
            });

            const sections = [];
            if (active.length > 0) {
              sections.push({ label: "Active", items: active });
            }
            if (hibernated.length > 0) {
              sections.push({ label: "Hibernated", items: hibernated });
            }

            resultsContainer.innerHTML = sections
              .map((section) => {
                const items = section.items
                  .map(({ group, index }) => {
                    const isCurrent =
                      !group.isHibernated && group.id === currentGroupId;
                    const isSelected = index === selectedIndex;
                    const tabLabel = `${group.tabCount} tab${
                      group.tabCount !== 1 ? "s" : ""
                    }`;
                    const badges = [];
                    if (isCurrent) badges.push("current");
                    if (group.isHibernated) badges.push("hibernated");

                    return `
                      <div class="group-item ${isSelected ? "selected" : ""}"
                           data-group-id="${group.id}"
                           data-index="${index}"
                           data-hibernated="${group.isHibernated}">
                        <div class="group-icon" style="background:${iconColor(group)}">
                          ${group.isHibernated ? MOON_ICON : FOLDER_ICON}
                        </div>
                        <div class="group-info">
                          <div class="group-title">${escapeHtml(group.title)}</div>
                          <div class="group-subtitle">${tabLabel}</div>
                        </div>
                        <div class="group-meta">
                          ${badges
                            .map(
                              (b) => `<span class="group-badge">${b}</span>`,
                            )
                            .join("")}
                          <kbd class="group-kbd">↵</kbd>
                        </div>
                      </div>
                    `;
                  })
                  .join("");

                return `
                  <div class="fuzzy-section-label">${section.label}</div>
                  ${items}
                `;
              })
              .join("");

            resultsContainer
              .querySelectorAll("[data-group-id]")
              .forEach((el) => {
                el.onmouseenter = () => {
                  const next = parseInt(el.dataset.index, 10);
                  if (next !== selectedIndex) {
                    selectedIndex = next;
                    renderGroups();
                  }
                };
                el.onclick = () => {
                  selectedIndex = parseInt(el.dataset.index, 10);
                  selectGroup(
                    el.dataset.groupId,
                    el.dataset.hibernated === "true",
                  );
                };
              });

            const selectedElement = resultsContainer.querySelector(
              ".group-item.selected",
            );
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
              chrome.runtime.sendMessage({
                type: "restore-hibernated-group",
                folderId: String(groupId).replace("hibernated_", ""),
              });
            } else {
              chrome.runtime.sendMessage({
                type: "switch-to-group",
                groupId: parseInt(groupId, 10),
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
            if (
              document.activeElement !== searchInput &&
              !e.ctrlKey &&
              !e.metaKey
            ) {
              searchInput.focus();
            }
          }

          overlay.onclick = (e) => {
            if (e.target === overlay) cleanup();
          };

          searchInput.oninput = (e) => filterGroups(e.target.value);
          renderGroups();
          searchInput.focus();
          document.addEventListener("keydown", handleKeydown);
        },
        args: [data.groups, data.currentGroupId, GROUP_COLORS],
      });
    } catch (error) {
      console.error("Failed to inject fuzzy finder:", error);
      await this.showInPopup(windowId);
    }
  }

  static async getHibernatedGroups() {
    try {
      const searchResults = await chrome.bookmarks.search({
        title: EXTENSION_BOOKMARK_FOLDER,
      });

      const rootFolder = searchResults.find((result) => !result.url);
      if (!rootFolder) return [];

      const groupFolders = await chrome.bookmarks.getChildren(rootFolder.id);

      return Promise.all(
        groupFolders.map(async (folder) => {
          const bookmarks = await chrome.bookmarks.getChildren(folder.id);
          return {
            id: `hibernated_${folder.id}`,
            title: folder.title,
            tabCount: bookmarks.length,
            bookmarkFolderId: folder.id,
            isHibernated: true,
            type: "hibernated",
            color: "grey",
          };
        }),
      );
    } catch (error) {
      console.error("Failed to get hibernated groups:", error);
      return [];
    }
  }
}
