'use client';

import { useEffect } from 'react';

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function SettingsApply() {
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const themeKey = data.theme === 'light' || data.theme === 'dark' || data.theme === 'system' ? data.theme : 'light';
        const resolved = resolveTheme(themeKey);
        const fontSize = data.fontSize === 'normal' || data.fontSize === 'large' ? data.fontSize : 'normal';
        const root = document.documentElement;
        root.dataset.theme = resolved;
        root.dataset.themePreference = themeKey;
        root.dataset.fontSize = fontSize;
      })
      .catch(() => {});
  }, []);

  return null;
}
