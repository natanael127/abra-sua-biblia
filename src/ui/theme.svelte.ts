import { getSavedTheme, saveTheme } from './storage';

export type Theme = 'light' | 'dark' | 'auto';

const THEME_ORDER: readonly Theme[] = ['auto', 'light', 'dark'];
export const THEME_ICONS: Record<Theme, string> = { light: '☀️', dark: '🌙', auto: '🌓' };

// index.html applies the saved theme before rendering, to avoid a "flash" of
// the wrong theme; this logic must stay equivalent to that one.
const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

const isTheme = (value: string | null): value is Theme => THEME_ORDER.includes(value as Theme);

let currentTheme = $state<Theme>('auto');

/** Theme chosen by the user ('auto' follows the system). */
export const getTheme = (): Theme => currentTheme;

function applyTheme(theme: Theme): void {
    currentTheme = theme;
    const effectiveTheme = theme === 'auto' ? (darkQuery().matches ? 'dark' : 'light') : theme;

    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

export function cycleTheme(): void {
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length] ?? 'auto';
    saveTheme(nextTheme);
    applyTheme(nextTheme);
}

export function initializeTheme(): void {
    const saved = getSavedTheme();
    applyTheme(isTheme(saved) ? saved : 'auto');

    // Follow the system theme in automatic mode
    darkQuery().addEventListener('change', () => {
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    });
}
