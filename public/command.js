(() => {
  const params = new URLSearchParams(window.location.search);
  const windowId = Number(params.get("windowId"));
  let sent = false;

  function sendCommand(key) {
    if (sent) return;
    sent = true;
    chrome.runtime.sendMessage({
      type: "command",
      key,
      windowId: Number.isFinite(windowId) ? windowId : undefined,
    });
    window.close();
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        window.close();
        return;
      }

      sendCommand(e.key.toLowerCase());
    },
    true,
  );

  window.focus();
})();
