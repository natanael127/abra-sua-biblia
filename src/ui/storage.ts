import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from '../core/render';

/** Chaves do localStorage; mantidas iguais às da versão anterior para preservar as preferências. */
const KEYS = {
    bible: 'selectedBible',
    reference: 'lastReference',
    theme: 'selectedTheme',
    displayOptions: 'bibleDisplayOptions',
    history: 'searchHistory',
} as const;

function readJson(key: string): unknown {
    try {
        return JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
        return null;
    }
}

export const getSavedBible = (): string | null => localStorage.getItem(KEYS.bible);
export const saveBible = (bibleId: string): void => {
    localStorage.setItem(KEYS.bible, bibleId);
};

export const getSavedReference = (): string | null => localStorage.getItem(KEYS.reference);
export const saveReference = (reference: string): void => {
    localStorage.setItem(KEYS.reference, reference);
};

export const getSavedTheme = (): string | null => localStorage.getItem(KEYS.theme);
export const saveTheme = (theme: string): void => {
    localStorage.setItem(KEYS.theme, theme);
};

export function getSavedDisplayOptions(): DisplayOptions {
    const saved = readJson(KEYS.displayOptions);
    const options = { ...DEFAULT_DISPLAY_OPTIONS };
    if (typeof saved === 'object' && saved !== null) {
        for (const key of Object.keys(options) as (keyof DisplayOptions)[]) {
            const value = (saved as Record<string, unknown>)[key];
            if (typeof value === 'boolean') {
                options[key] = value;
            }
        }
    }
    return options;
}

export const saveDisplayOptions = (options: DisplayOptions): void => {
    localStorage.setItem(KEYS.displayOptions, JSON.stringify(options));
};

export function getSearchHistory(): string[] {
    const saved = readJson(KEYS.history);
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
}

export const saveSearchHistory = (history: readonly string[]): void => {
    localStorage.setItem(KEYS.history, JSON.stringify(history));
};
