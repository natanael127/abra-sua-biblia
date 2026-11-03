import { t } from '../i18n';
import { byId } from './dom';
import { getSavedTheme, saveTheme } from './storage';

export type Theme = 'light' | 'dark' | 'auto';

const THEME_ORDER: readonly Theme[] = ['auto', 'light', 'dark'];
const THEME_ICONS: Record<Theme, string> = { light: '☀️', dark: '🌙', auto: '🌓' };

// index.html applies the saved theme before rendering, to avoid a "flash" of
// the wrong theme; this logic must stay equivalent to that one.
const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

const isTheme = (value: string | null): value is Theme => THEME_ORDER.includes(value as Theme);

let currentTheme: Theme = 'auto';

function applyTheme(theme: Theme): void {
    currentTheme = theme;
    const effectiveTheme = theme === 'auto' ? (darkQuery().matches ? 'dark' : 'light') : theme;

    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    byId('theme-icon').textContent = THEME_ICONS[theme];
    byId('theme-button').title = t(`buttons.theme.${theme}`);
}

function cycleTheme(): void {
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length] ?? 'auto';
    saveTheme(nextTheme);
    applyTheme(nextTheme);
}

/** Re-translates the button's title, which depends on the current theme. */
export const refreshThemeTitle = (): void => {
    applyTheme(currentTheme);
};

export function initializeTheme(): void {
    const saved = getSavedTheme();
    applyTheme(isTheme(saved) ? saved : 'auto');

    // Follow the system theme in automatic mode
    darkQuery().addEventListener('change', () => {
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    });

    byId('theme-button').addEventListener('click', cycleTheme);
}
