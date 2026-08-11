'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

type ThemeContextValue = { theme: Theme; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

// Stringified and injected as a raw <script> below — runs before hydration so the
// right class is already on <html> at first paint. No flash, no next-themes dependency
// (it's unmaintained with open React 19/Next 16 bugs — verified 2026-07-16).
// Keep this function self-contained: it can't reference anything outside its own body.
function blockingScript(storageKey: string) {
  try {
    const stored = localStorage.getItem(storageKey);
    const theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch {
    // localStorage/matchMedia unavailable — leave the server-rendered (light) default
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Placeholder until mount; the blocking script already painted the correct class,
  // this just syncs React state to what's actually on <html>.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const next = getSystemTheme();
        setTheme(next);
        applyTheme(next);
      }
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `(${blockingScript.toString()})(${JSON.stringify(STORAGE_KEY)})`,
        }}
      />
      {children}
    </ThemeContext.Provider>
  );
}
