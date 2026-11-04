/**
 * Internationalization of the interface, on top of i18next. All the translations
 * go into the bundle (a single JS file, see vite.config.ts) and are loaded
 * synchronously: `t` works from the first line of code, with no setup, and
 * the page needs no extra request to change language.
 *
 * The language is chosen when this module is loaded: the one saved by the user,
 * else the browser's, else the default one from settings.json (resolveUiLanguage).
 */
import i18next, { t } from 'i18next';
import { getSavedUiLanguage, saveUiLanguage } from './preference';
import { resolveUiLanguage } from './detect';
import { findUiLanguage, type UiLanguage, UI_LANGUAGES } from './languages';
import arb from './locales/arb.json';
import ben from './locales/ben.json';
import deu from './locales/deu.json';
import ell from './locales/ell.json';
import eng from './locales/eng.json';
import fra from './locales/fra.json';
import grc from './locales/grc.json';
import hin from './locales/hin.json';
import ind from './locales/ind.json';
import ita from './locales/ita.json';
import jpn from './locales/jpn.json';
import lat from './locales/lat.json';
import por from './locales/por.json';
import rus from './locales/rus.json';
import spa from './locales/spa.json';
import urd from './locales/urd.json';
import zho from './locales/zho.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        /** Portuguese is the reference: the other languages must have the same keys (tests/i18n). */
        resources: { translation: typeof por };
    }
}

/** Translations by ISO 639-3 code. */
export const TRANSLATIONS: Readonly<Record<string, Record<string, unknown>>> = {
    arb, ben, deu, ell, eng, fra, grc, hin, ind, ita, jpn, lat, por, rus, spa, urd, zho,
};

export { t };

type Listener = (language: UiLanguage) => void;
const listeners = new Set<Listener>();

let current: UiLanguage = resolveUiLanguage(
    getSavedUiLanguage(),
    typeof navigator === 'undefined' ? [] : navigator.languages,
    __DEFAULT_UI_LANGUAGE__,
);

void i18next.init({
    lng: current.tag,
    fallbackLng: 'en',
    resources: Object.fromEntries(
        UI_LANGUAGES.map((language) => [language.tag, { translation: TRANSLATIONS[language.code] ?? {} }]),
    ),
    // The translations are ours and static; data from the user is escaped where it is interpolated
    interpolation: { escapeValue: false },
    initAsync: false,
});

export const getUiLanguage = (): UiLanguage => current;

/** Calls the listener whenever the language changes (not on registration). */
export function onUiLanguageChange(listener: Listener): void {
    listeners.add(listener);
}

/** Translation of a key that is not known at compile time (the `data-i18n` attributes of index.html). */
const translateKey = (key: string): string => t(key as never);

/**
 * Translates the static elements of the page:
 * - `data-i18n`: text; `data-i18n-html`: HTML (only our own static texts);
 * - `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-content`: attributes.
 */
export function translateDocument(root: ParentNode = document): void {
    for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
        element.textContent = translateKey(element.dataset.i18n ?? '');
    }
    for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
        element.innerHTML = translateKey(element.dataset.i18nHtml ?? '');
    }
    for (const [attribute, dataKey] of [
        ['title', 'i18nTitle'],
        ['placeholder', 'i18nPlaceholder'],
        ['aria-label', 'i18nAriaLabel'],
        ['content', 'i18nContent'],
    ] as const) {
        for (const element of root.querySelectorAll<HTMLElement>(`[data-i18n-${attribute}]`)) {
            element.setAttribute(attribute, translateKey(element.dataset[dataKey] ?? ''));
        }
    }
}

function applyToDocument(language: UiLanguage): void {
    // Unit tests of the pure logic run without a DOM
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language.tag;
    document.documentElement.dir = language.dir;
    translateDocument();
}

/** Applies the initial language to the page; call once the DOM is ready. */
export function initializeI18n(): void {
    applyToDocument(current);
}

/** Changes the interface language. `persist: false` does not save it as the user's choice. */
export function setUiLanguage(code: string, { persist = true } = {}): void {
    const language = findUiLanguage(code);
    if (!language) return;
    current = language;
    void i18next.changeLanguage(language.tag);
    if (persist) {
        saveUiLanguage(language.code);
    }
    applyToDocument(language);
    for (const listener of listeners) {
        listener(language);
    }
}
