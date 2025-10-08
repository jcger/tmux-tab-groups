import { FuzzyFinder } from "./ui/FuzzyFinder.js";

export const EXTENSION_BOOKMARK_FOLDER = "Tmux Tab Groups";

class TabGroupsManager {
  constructor() {
    this.commandMode = false;
    this.tabHistory = [];
    this.currentTabId = null;
    this.helpWindowId = null;
    this.init();
  }

  init() {
    chrome.commands.onCommand.addListener((command) => {
      if (command === "prefix-key") this.enterCommandMode();
      if (command === "quick-help") this.showHelp();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateTabHistory(activeInfo.tabId);
    });

    this.initializeCurrentTab();
  }

  async initializeCurrentTab() {
    try {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (currentTab) {
        this.currentTabId = currentTab.id;
        this.tabHistory = [currentTab.id];
      }
    } catch (error) {
      console.error("Failed to initialize current tab:", error);
    }
  }

  updateTabHistory(tabId) {
    this.tabHistory = this.tabHistory.filter((id) => id !== tabId);
    this.tabHistory.unshift(tabId);
    if (this.tabHistory.length > 20) {
      this.tabHistory = this.tabHistory.slice(0, 20);
    }
    this.currentTabId = tabId;
  }

  async enterCommandMode() {
    this.commandMode = true;
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const listener = (e) => {
          if (["shift", "control", "alt", "meta"].includes(e.key.toLowerCase()))
            return;

          e.preventDefault();
          chrome.runtime.sendMessage({
            type: "command",
            key: e.key.toLowerCase(),
          });
          document.removeEventListener("keydown", listener, true);
        };
        document.addEventListener("keydown", listener, true);
      },
    });

    setTimeout(() => (this.commandMode = false), 3000);
  }

  async toggleHelpWindow() {
    try {
      if (this.helpWindowId) {
        // Close existing help window
        await chrome.windows.remove(this.helpWindowId);
        this.helpWindowId = null;
      } else {
        const helpWindow = await chrome.windows.create({
          url: chrome.runtime.getURL("help.html"),
          type: "popup",
          width: 350,
          height: 430,
          focused: true,
        });
        this.helpWindowId = helpWindow.id;

        chrome.windows.onRemoved.addListener((windowId) => {
          if (windowId === this.helpWindowId) {
            this.helpWindowId = null;
          }
        });
      }
    } catch (error) {
      console.error("Error toggling help window:", error);
      this.helpWindowId = null;
    }
  }

  async showHelp() {
    try {
      if (this.helpWindowId) {
        try {
          await chrome.windows.remove(this.helpWindowId);
        } catch (e) {}
        this.helpWindowId = null;
      }

      const helpWindow = await chrome.windows.create({
        url: chrome.runtime.getURL("help.html"),
        type: "popup",
        width: 350,
        height: 430,
        focused: true,
      });
      this.helpWindowId = helpWindow.id;

      chrome.windows.onRemoved.addListener((windowId) => {
        if (windowId === this.helpWindowId) {
          this.helpWindowId = null;
        }
      });
    } catch (error) {
      console.error("Error showing help window:", error);
      this.helpWindowId = null;
    }
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case "command":
        await this.executeCommand(request.key);
        break;
      case "switch-to-group":
        await this.switchToGroup(request.groupId);
        break;
      case "restore-hibernated-group":
        await this.restoreHibernatedGroup(request.folderId);
        break;
      case "remove-css":
        break;
    }
  }

  async executeCommand(key) {
    try {
      switch (key) {
        case "n":
          await this.nextTab();
          break;
        case "p":
          await this.previousTab();
          break;
        case "l":
          await this.lastTab();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          await this.switchToTabInGroup(parseInt(key));
          break;
        case "0":
          await this.switchToTabInGroup(10);
          break;
        case "c":
          await this.createTabInGroup();
          break;
        case "g":
          await this.createNewGroup();
          break;
        case "a":
          await this.addLastTabToGroup();
          break;
        case "x":
          await this.hibernateCurrentGroup();
          break;
        case "f":
          await FuzzyFinder.show();
          break;
        case "?":
          await this.showHelp();
          break;
      }
    } catch (error) {
      console.error("Command error:", error);
    }
    this.commandMode = false;
  }

  async findOrCreateExtensionFolder() {
    try {
      const searchResults = await chrome.bookmarks.search({
        title: EXTENSION_BOOKMARK_FOLDER,
      });

      const existingFolder = searchResults.find((result) => !result.url);

      if (existingFolder) {
        return existingFolder;
      }

      // Create new root folder in bookmarks bar
      const bookmarksTree = await chrome.bookmarks.getTree();
      const bookmarksBar = bookmarksTree[0].children[0]; // Bookmarks bar

      return await chrome.bookmarks.create({
        parentId: bookmarksBar.id,
        title: EXTENSION_BOOKMARK_FOLDER,
      });
    } catch (error) {
      console.error("Error managing extension folder:", error);
      throw error;
    }
  }

  async getHibernatedGroups() {
    try {
      const rootFolder = await this.findOrCreateExtensionFolder();
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
        })
      );

      return hibernatedGroups;
    } catch (error) {
      console.error("Failed to get hibernated groups:", error);
      return [];
    }
  }

  async hibernateCurrentGroup() {
    try {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
        return;
      }

      const group = await chrome.tabGroups.get(currentTab.groupId);
      const tabs = await chrome.tabs.query({ groupId: currentTab.groupId });

      if (tabs.length === 0) {
        return;
      }

      const rootFolder = await this.findOrCreateExtensionFolder();

      let groupTitle = group.title || `Group ${currentTab.groupId}`;
      let finalTitle = groupTitle;
      let counter = 1;

      const existingFolders = await chrome.bookmarks.getChildren(rootFolder.id);
      while (existingFolders.some((folder) => folder.title === finalTitle)) {
        finalTitle = `${groupTitle} (${counter})`;
        counter++;
      }

      const groupFolder = await chrome.bookmarks.create({
        parentId: rootFolder.id,
        title: finalTitle,
      });

      for (const tab of tabs) {
        if (
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://")
        ) {
          await chrome.bookmarks.create({
            parentId: groupFolder.id,
            title: tab.title,
            url: tab.url,
          });
        }
      }

      await chrome.tabs.remove(tabs.map((tab) => tab.id));
    } catch (error) {
      console.error("Failed to hibernate group:", error);
    }
  }

  async restoreHibernatedGroup(folderId) {
    try {
      const folder = await chrome.bookmarks.get(folderId);
      if (!folder || !folder[0]) {
        console.error("Folder not found");
        return;
      }

      const folderInfo = folder[0];
      const bookmarks = await chrome.bookmarks.getChildren(folderId);

      if (bookmarks.length === 0) {
        await chrome.bookmarks.removeTree(folderId);
        return;
      }

      const existingGroups = await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });

      for (const group of existingGroups) {
        if (!group.collapsed) {
          await chrome.tabGroups.update(group.id, { collapsed: true });
        }
      }

      const tabIds = [];
      for (const bookmark of bookmarks) {
        try {
          const tab = await chrome.tabs.create({
            url: bookmark.url,
            active: false,
          });
          tabIds.push(tab.id);
        } catch (error) {
          console.warn(`Failed to restore tab: ${bookmark.title}`, error);
        }
      }

      if (tabIds.length === 0) {
        return;
      }

      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: folderInfo.title,
        collapsed: false,
      });

      if (tabIds.length > 0) {
        await chrome.tabs.update(tabIds[0], { active: true });
      }

      await chrome.bookmarks.removeTree(folderId);
    } catch (error) {
      console.error("Failed to restore hibernated group:", error);
    }
  }

  // Tmux-style navigation methods
  async nextTab() {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // If tab is not in a group, cycle through all tabs
    if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const currentIndex = tabs.findIndex((tab) => tab.id === currentTab.id);
      const nextIndex = (currentIndex + 1) % tabs.length;
      await chrome.tabs.update(tabs[nextIndex].id, { active: true });
      return;
    }

    // If tab is in a group, cycle within the group
    const groupTabs = await chrome.tabs.query({
      groupId: currentTab.groupId,
      currentWindow: true,
    });
    const currentIndex = groupTabs.findIndex((tab) => tab.id === currentTab.id);
    const nextIndex = (currentIndex + 1) % groupTabs.length;

    await chrome.tabs.update(groupTabs[nextIndex].id, { active: true });
  }

  async previousTab() {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // If tab is not in a group, cycle through all tabs
    if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const currentIndex = tabs.findIndex((tab) => tab.id === currentTab.id);
      const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      await chrome.tabs.update(tabs[previousIndex].id, { active: true });
      return;
    }

    // If tab is in a group, cycle within the group
    const groupTabs = await chrome.tabs.query({
      groupId: currentTab.groupId,
      currentWindow: true,
    });
    const currentIndex = groupTabs.findIndex((tab) => tab.id === currentTab.id);
    const previousIndex =
      (currentIndex - 1 + groupTabs.length) % groupTabs.length;

    await chrome.tabs.update(groupTabs[previousIndex].id, { active: true });
  }

  async lastTab() {
    if (this.tabHistory.length < 2) {
      return;
    }

    const lastTabId = this.tabHistory[1];

    try {
      const tab = await chrome.tabs.get(lastTabId);
      if (tab) {
        await chrome.tabs.update(lastTabId, { active: true });
      }
    } catch (error) {
      this.tabHistory = this.tabHistory.filter((id) => id !== lastTabId);

      // Try again with the next tab in history
      if (this.tabHistory.length >= 2) {
        await this.lastTab();
      }
    }
  }

  async addLastTabToGroup() {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      return;
    }

    if (this.tabHistory.length < 2) {
      return;
    }

    const lastTabId = this.tabHistory[1];

    try {
      const tab = await chrome.tabs.get(lastTabId);
      if (tab && tab.id !== currentTab.id) {
        if (tab.groupId === currentTab.groupId) {
          return;
        }

        await chrome.tabs.group({
          tabIds: [tab.id],
          groupId: currentTab.groupId,
        });
      }
    } catch (error) {
      this.tabHistory = this.tabHistory.filter((id) => id !== lastTabId);

      if (this.tabHistory.length >= 2) {
        await this.addLastTabToGroup();
      }
    }
  }

  async switchToGroup(groupId) {
    const allGroups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });

    for (const group of allGroups) {
      if (group.id === groupId) {
        await chrome.tabGroups.update(group.id, { collapsed: false });
      } else {
        await chrome.tabGroups.update(group.id, { collapsed: true });
      }
    }

    const groupTabs = await chrome.tabs.query({ groupId });
    if (groupTabs.length > 0) {
      await chrome.tabs.update(groupTabs[0].id, { active: true });
    }
  }

  async switchToTabInGroup(tabNumber) {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return;

    const groupTabs = await chrome.tabs.query({ groupId: currentTab.groupId });
    const targetTab = groupTabs[tabNumber - 1];
    if (targetTab) {
      await chrome.tabs.update(targetTab.id, { active: true });
    }
  }

  async createNewGroup() {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Hide all existing groups
    const allGroups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
    for (const group of allGroups) {
      await chrome.tabGroups.update(group.id, { collapsed: true });
    }

    // Create new group
    const group = await chrome.tabs.group({ tabIds: [currentTab.id] });
    await chrome.tabGroups.update(group, {
      title: `Group ${Date.now() % 1000}`,
      collapsed: false,
    });
  }

  async navigate(direction) {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return;

    const groupTabs = await chrome.tabs.query({ groupId: currentTab.groupId });
    const currentIndex = groupTabs.findIndex((tab) => tab.id === currentTab.id);
    const newIndex =
      (currentIndex + direction + groupTabs.length) % groupTabs.length;
    await chrome.tabs.update(groupTabs[newIndex].id, { active: true });
  }

  async createTabInGroup() {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const newTab = await chrome.tabs.create({
      url: "chrome://newtab",
      index: currentTab.index + 1,
    });

    if (currentTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await chrome.tabs.group({
        tabIds: [newTab.id],
        groupId: currentTab.groupId,
      });
    }
  }
}

new TabGroupsManager();
