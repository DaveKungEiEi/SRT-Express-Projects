(() => {
  "use strict";

  const STORAGE_KEY = "srtx-theme";
  const VALID_MODES = new Set(["system", "light", "dark"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function readMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return VALID_MODES.has(stored) ? stored : "system";
    } catch (_) {
      return "system";
    }
  }

  function resolvedTheme(mode) {
    return mode === "system" ? (media.matches ? "dark" : "light") : mode;
  }

  let currentMode = readMode();

  function updateButtons() {
    document.querySelectorAll("[data-theme-option]").forEach((button) => {
      const active = button.dataset.themeOption === currentMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyTheme(mode, persist = false) {
    currentMode = VALID_MODES.has(mode) ? mode : "system";
    const theme = resolvedTheme(currentMode);
    document.documentElement.dataset.themeMode = currentMode;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#160d10" : "#741f2b";
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, currentMode);
      } catch (_) {
        // Private browsing can disable storage. The selected theme still applies to this page.
      }
    }
    updateButtons();
  }

  const icons = {
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"></path></svg>',
  };

  function button(mode, label) {
    return `<button class="footer-theme-button" type="button" data-theme-option="${mode}" aria-pressed="false">${icons[mode]}<span>${label}</span></button>`;
  }

  function mountSwitcher() {
    const footerBottom = document.querySelector(".footer-bottom");
    if (!footerBottom || footerBottom.querySelector(".footer-theme-switcher")) {
      updateButtons();
      return;
    }

    const switcher = document.createElement("div");
    switcher.className = "footer-theme-switcher";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "รูปแบบสีของเว็บไซต์");
    switcher.innerHTML = `
      <span class="footer-theme-label">รูปแบบสี</span>
      <div class="footer-theme-options">
        ${button("system", "ตามระบบ")}
        ${button("light", "สว่าง")}
        ${button("dark", "มืด")}
      </div>`;
    footerBottom.insertBefore(switcher, footerBottom.lastElementChild);
    switcher.addEventListener("click", (event) => {
      const selected = event.target.closest("[data-theme-option]");
      if (selected) applyTheme(selected.dataset.themeOption, true);
    });
    updateButtons();
  }

  applyTheme(currentMode);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSwitcher, { once: true });
  } else {
    mountSwitcher();
  }

  const onSystemThemeChange = () => {
    if (currentMode === "system") applyTheme("system");
  };
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onSystemThemeChange);
  } else {
    media.addListener(onSystemThemeChange);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(VALID_MODES.has(event.newValue) ? event.newValue : "system");
  });
})();
