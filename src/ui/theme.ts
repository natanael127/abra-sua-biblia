import { byId } from './dom';
import { getSavedTheme, saveTheme } from './storage';

export type Theme = 'light' | 'dark' | 'auto';

const THEME_ORDER: readonly Theme[] = ['auto', 'light', 'dark'];
const THEME_ICONS: Record<Theme, string> = { light: '☀️', dark: '🌙', auto: '🌓' };
const THEME_TITLES: Record<Theme, string> = {
    light: 'Tema: Claro',
    dark: 'Tema: Escuro',
    auto: 'Tema: Automático',
};

// O index.html aplica o tema salvo antes da renderização, para evitar o
// "flash" do tema errado; esta lógica precisa continuar equivalente àquela.
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
    byId('theme-button').title = THEME_TITLES[theme];
}

function cycleTheme(): void {
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length] ?? 'auto';
    saveTheme(nextTheme);
    applyTheme(nextTheme);
}

export function initializeTheme(): void {
    const saved = getSavedTheme();
    applyTheme(isTheme(saved) ? saved : 'auto');

    // Acompanha o tema do sistema no modo automático
    darkQuery().addEventListener('change', () => {
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    });

    byId('theme-button').addEventListener('click', cycleTheme);
}
