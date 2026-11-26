/** Theme management with localStorage persistence and OS preference detection. */

export type Theme = "light" | "dark";

const THEME_KEY = "theme-preference";

/** Get the current theme, checking localStorage, then OS preference, then defaulting to dark. */
export function getCurrentTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }

  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

/** Set the theme and persist to localStorage. */
export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage unavailable
  }
}

/** Initialize theme on page load, avoiding flash of wrong theme. */
export function initializeTheme(): void {
  if (typeof window === "undefined") return;

  const theme = getCurrentTheme();
  setTheme(theme);
}
