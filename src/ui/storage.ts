import type { SearchOrder } from '../core/search';
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from '../core/passage';

/** localStorage keys; kept identical to the previous version's to preserve preferences. */
const KEYS = {
    bible: 'selectedBible',
    inputReference: 'lastReference',
    theme: 'selectedTheme',
    displayOptions: 'bibleDisplayOptions',
    history: 'searchHistory',
    searchOrder: 'searchOrder',
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

/** Last input reference, as it was in the reference field. */
export const getSavedInputReference = (): string | null => localStorage.getItem(KEYS.inputReference);
export const saveInputReference = (inputReference: string): void => {
    localStorage.setItem(KEYS.inputReference, inputReference);
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

/** History of input references, as typed (see core/history). */
export function getSearchHistory(): string[] {
    const saved = readJson(KEYS.history);
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
}

export const saveSearchHistory = (history: readonly string[]): void => {
    localStorage.setItem(KEYS.history, JSON.stringify(history));
};

export function getSearchOrder(): SearchOrder {
    return localStorage.getItem(KEYS.searchOrder) === 'book' ? 'book' : 'relevance';
}

export const saveSearchOrder = (order: SearchOrder): void => {
    localStorage.setItem(KEYS.searchOrder, order);
};
