import { toIso6393 } from '../core/language';
import { findUiLanguage, type UiLanguage } from './languages';

/** ISO 639-3 macrolanguage codes that the browsers' tags (ISO 639-1) turn into -> the individual language used here. */
const MACROLANGUAGE_TO_INDIVIDUAL: Readonly<Record<string, string>> = {
    zho: 'cmn', // "zh" (Chinese) -> Mandarin
    ara: 'arb', // "ar" (Arabic) -> Modern Standard Arabic
};

/** UI language of a browser language tag ("pt-BR", "zh-CN", "en"); undefined if there is no translation for it. */
export function uiLanguageOfTag(tag: string): UiLanguage | undefined {
    const iso = toIso6393(tag);
    return findUiLanguage(MACROLANGUAGE_TO_INDIVIDUAL[iso] ?? iso);
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
