'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'border-border bg-surface text-muted hover:text-text focus-visible:ring-accent/30 inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]',
        className
      )}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
