'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
/* WHAT THE TRADER ASKED FOR, as distinct from what is on screen. `system` means "follow the
 * device", and it is the state the blocking script below has ALWAYS treated an empty storage key
 * as - so adding it here names an existing behaviour rather than inventing one. The reference's
 * Display setting offers exactly these three (`/settings/display`, "Visual Appearance", read
 * 2026-09-08). */
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'theme';

type ThemeContextValue = {
  /** What is painted right now. Never `system`: the screen is always one or the other. */
  theme: Theme;
  /** What was chosen. `system` when nothing is stored. */
  preference: ThemePreference;
  toggleTheme: () => void;
  setPreference: (next: ThemePreference) => void;
};

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
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setPreferenceState(stored === 'light' || stored === 'dark' ? stored : 'system');
    } catch {
      // Storage unavailable: the blocking script fell back to the system theme, and so does this.
    }

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

  /* ONE WRITER. `toggleTheme` used to write storage and paint on its own; now both routes go
     through here so the menu's toggle and the Display setting cannot disagree about what "system"
     means or which key it lives under. Choosing `system` REMOVES the key rather than storing the
     word, because an absent key is what the blocking script and the media listener above already
     read as "follow the device" - storing 'system' would have needed both of them taught a third
     value for no gain. */
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: still paint it for this page view.
    }
    const painted: Theme = next === 'system' ? getSystemTheme() : next;
    setPreferenceState(next);
    setTheme(painted);
    applyTheme(painted);
  }, []);

  // The account menu's one-tap flip. Flipping from `system` lands on the opposite of what is
  // painted, which is what a person pressing "Dark mode" while looking at a light screen meant.
  const toggleTheme = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setPreference }}>
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
