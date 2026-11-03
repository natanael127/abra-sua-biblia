/**
 * The interface language chosen by the user, in localStorage like the other
 * preferences (src/ui/storage.ts; separate from it because that one depends on
 * the renderer, which depends on this module). Tolerates a missing or blocked
 * localStorage.
 */
const KEY = 'uiLanguage';

/** ISO 639-3 code of the language the user chose, if any. */
export function getSavedUiLanguage(): string | null {
    try {
        return localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

export function saveUiLanguage(code: string): void {
    try {
        localStorage.setItem(KEY, code);
    } catch {
        // Without storage the choice only lasts until the page is closed
    }
}
