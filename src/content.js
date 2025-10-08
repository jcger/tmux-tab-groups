(function () {
  if (window.tabGroupsTmuxInjected) return;
  window.tabGroupsTmuxInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return true;
  });
})();
