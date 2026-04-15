"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "ops_theme_mode";

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const resolved = mode === "system" ? getSystemMode() : mode;
  root.classList.toggle("theme-dark", resolved === "dark");
  root.classList.toggle("theme-light", resolved === "light");
  root.setAttribute("data-theme", resolved);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialMode: ThemeMode =
      savedMode === "light" || savedMode === "dark" || savedMode === "system"
        ? savedMode
        : "system";
    setMode(initialMode);
  }, []);

  useEffect(() => {
    if (mode === null) {
      return;
    }
    applyTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode === null) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (): void => {
      if (mode === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [mode]);

  function onSelect(nextMode: ThemeMode): void {
    setMode(nextMode);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-fgMuted">Theme</span>
      <div className="app-theme-toggle">
        {(["light", "dark", "system"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onSelect(choice)}
            className={`app-theme-choice ${mode === choice ? "app-theme-choice-active" : ""}`}
          >
            {choice[0].toUpperCase() + choice.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
