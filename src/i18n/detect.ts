import { toIso6393 } from '../core/language';
import { findUiLanguage, type UiLanguage } from './languages';

/**
 * ISO 639-3 codes a browser tag can turn into that are not the code of the UI language -> the one that serves them.
 * "zh" becomes `zho` (Chinese), which is itself a UI language, so it needs no entry here.
 */
const UI_LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
    ara: 'arb', // "ar" (Arabic, a macrolanguage) -> Modern Standard Arabic
    cmn: 'zho', // "cmn" (Mandarin, an individual language) -> Chinese
};

/** UI language of a browser language tag ("pt-BR", "zh-CN", "en"); undefined if there is no translation for it. */
export function uiLanguageOfTag(tag: string): UiLanguage | undefined {
    const iso = toIso6393(tag);
    return findUiLanguage(UI_LANGUAGE_ALIASES[iso] ?? iso);
}

/**
 * Chooses the language of the interface:
 * 1. the one the user chose and saved;
 * 2. the first of the browser's languages that has a translation;
 * 3. the site's default language (settings.json).
 */
export function resolveUiLanguage(
    saved: string | null | undefined,
    browserLanguages: readonly string[],
    defaultCode: string,
): UiLanguage {
    const fallback = findUiLanguage(defaultCode);
    if (!fallback) {
        throw new Error(`Unknown default interface language: "${defaultCode}"`);
    }
    return (
        findUiLanguage(saved) ??
        browserLanguages.map(uiLanguageOfTag).find((language) => language !== undefined) ??
        fallback
    );
}
