(() => {
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

  const params = new URLSearchParams(window.location.search);
  const windowIdParam = Number(params.get("windowId"));
  const windowId = Number.isFinite(windowIdParam)
    ? windowIdParam
    : undefined;

  const searchInput = document.querySelector(".fuzzy-search");
  const resultsContainer = document.querySelector(".fuzzy-results");

  let groups = [];
  let currentGroupId = chrome.tabGroups.TAB_GROUP_ID_NONE;
  let filteredGroups = [];
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
    return GROUP_COLORS[group.color] || GROUP_COLORS.grey;
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
    if (active.length > 0) sections.push({ label: "Active", items: active });
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
                    .map((b) => `<span class="group-badge">${b}</span>`)
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

    resultsContainer.querySelectorAll("[data-group-id]").forEach((el) => {
      el.onmouseenter = () => {
        const next = parseInt(el.dataset.index, 10);
        if (next !== selectedIndex) {
          selectedIndex = next;
          renderGroups();
        }
      };
      el.onclick = () => {
        selectedIndex = parseInt(el.dataset.index, 10);
        selectGroup(el.dataset.groupId, el.dataset.hibernated === "true");
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
        windowId,
      });
    } else {
      chrome.runtime.sendMessage({
        type: "switch-to-group",
        groupId: parseInt(groupId, 10),
        windowId,
      });
    }
    window.close();
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      window.close();
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
      if (filteredGroups.length > 0 && selectedIndex < filteredGroups.length) {
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
  }

  searchInput.addEventListener("input", (e) => filterGroups(e.target.value));
  document.addEventListener("keydown", handleKeydown);

  chrome.runtime.sendMessage(
    { type: "get-finder-data", windowId },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        resultsContainer.innerHTML = `<div class="fuzzy-empty">Failed to load groups</div>`;
        return;
      }
      groups = response.groups || [];
      currentGroupId = response.currentGroupId;
      filteredGroups = [...groups];
      renderGroups();
      searchInput.focus();
    },
  );
})();
