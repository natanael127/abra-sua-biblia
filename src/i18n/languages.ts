/**
 * Languages of the user interface. Free of imports on purpose: the build
 * (scripts/build-index.ts) also uses it to validate settings.json.
 */

export interface UiLanguage {
    /** ISO 639-3 code: what the user sees in the combobox, what is saved and what settings.json uses. */
    code: string;
    /** BCP 47 tag: the `lang` attribute, the i18next resources and the plural rules. */
    tag: string;
    /** Name of the language in itself. */
    nativeName: string;
    dir: 'ltr' | 'rtl';
}

/** In the order shown in the combobox: alphabetical by ISO 639-3 code. */
export const UI_LANGUAGES: readonly UiLanguage[] = [
    { code: 'arb', tag: 'ar', nativeName: 'العربية', dir: 'rtl' },
    { code: 'ben', tag: 'bn', nativeName: 'বাংলা', dir: 'ltr' },
    { code: 'deu', tag: 'de', nativeName: 'Deutsch', dir: 'ltr' },
    { code: 'ell', tag: 'el', nativeName: 'Ελληνικά', dir: 'ltr' },
    { code: 'eng', tag: 'en', nativeName: 'English', dir: 'ltr' },
    { code: 'fra', tag: 'fr', nativeName: 'Français', dir: 'ltr' },
    { code: 'grc', tag: 'grc', nativeName: 'Ἑλληνική', dir: 'ltr' },
    { code: 'heb', tag: 'he', nativeName: 'עברית', dir: 'rtl' },
    { code: 'hin', tag: 'hi', nativeName: 'हिन्दी', dir: 'ltr' },
    { code: 'ind', tag: 'id', nativeName: 'Bahasa Indonesia', dir: 'ltr' },
    { code: 'ita', tag: 'it', nativeName: 'Italiano', dir: 'ltr' },
    { code: 'jpn', tag: 'ja', nativeName: '日本語', dir: 'ltr' },
    { code: 'lat', tag: 'la', nativeName: 'Latina', dir: 'ltr' },
    { code: 'por', tag: 'pt-BR', nativeName: 'Português', dir: 'ltr' },
    { code: 'rus', tag: 'ru', nativeName: 'Русский', dir: 'ltr' },
    { code: 'spa', tag: 'es', nativeName: 'Español', dir: 'ltr' },
    { code: 'urd', tag: 'ur', nativeName: 'اردو', dir: 'rtl' },
    { code: 'zho', tag: 'zh-Hans', nativeName: '中文', dir: 'ltr' },
];

export const findUiLanguage = (code: string | null | undefined): UiLanguage | undefined =>
    UI_LANGUAGES.find((language) => language.code === code);
