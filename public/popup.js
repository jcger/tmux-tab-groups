// Tmux Tab Groups Popup Script
document.addEventListener("DOMContentLoaded", function () {
  // Add any interactive functionality here if needed in the future

  // Example: Add click handlers for shortcuts to demonstrate them
  const shortcutItems = document.querySelectorAll(".shortcut-item");

  shortcutItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Optional: Could add functionality to close popup and trigger command
      // For now, just provide visual feedback
      this.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
      setTimeout(() => {
        this.style.backgroundColor = "";
      }, 200);
    });
  });

  // Optional: Add keyboard navigation within the popup
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      window.close();
    }
  });
});
