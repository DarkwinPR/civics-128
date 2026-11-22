import type { ThemePreference } from '../domain/types';

const THEME_STORAGE_KEY = 'civics128:color-scheme';

function getColorSchemeMeta(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
}

export function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // Ignore storage access errors.
  }
  return 'system';
}

export function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyThemePreference(preference: ThemePreference): void {
  const meta = getColorSchemeMeta();
  const contentValue = preference === 'system' ? 'light dark' : preference;
  if (meta) {
    meta.content = contentValue;
  }

  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Still applied to <meta> even when persistence is unavailable.
  }
}

export function initThemeSync(onChange: () => void): () => void {
  // Sync override across browser tabs.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const meta = getColorSchemeMeta();
    if (meta) {
      meta.content =
        event.newValue === 'light' || event.newValue === 'dark'
          ? event.newValue
          : 'light dark';
    }
    onChange();
  };

  // Per modern-web-guidance: any JS reading matchMedia('(prefers-color-scheme: dark)')
  // MUST also handle its change event, without removing any stored override.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    onChange();
  };

  window.addEventListener('storage', handleStorage);
  mq.addEventListener('change', handleSystemChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    mq.removeEventListener('change', handleSystemChange);
  };
}
