// Tmux Tab Groups Help Window Script
document.addEventListener("DOMContentLoaded", function () {
  // Close window on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      window.close();
    }
  });

  // Add click handlers for shortcuts
  const shortcutItems = document.querySelectorAll(".shortcut-item");

  shortcutItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Provide visual feedback
      this.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
      setTimeout(() => {
        this.style.backgroundColor = "";
      }, 200);
    });
  });

  // Focus the window for keyboard navigation
  window.focus();
});
