export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "lgx-theme";

export function getStoredTheme(): ThemePreference {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(theme: ThemePreference): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }
}
