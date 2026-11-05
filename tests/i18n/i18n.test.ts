// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUiLanguage, onUiLanguageChange, setUiLanguage, t, translateDocument } from '../../src/i18n';
import { getSavedUiLanguage } from '../../src/i18n/preference';

beforeEach(() => {
    localStorage.clear();
    setUiLanguage('por', { persist: false });
});

describe('setUiLanguage', () => {
    it('changes the language of the texts, of the document and the saved preference', () => {
        setUiLanguage('eng');
        expect(getUiLanguage().code).toBe('eng');
        expect(t('buttons.close')).toBe('Close');
        expect(document.documentElement.lang).toBe('en');
        expect(document.documentElement.dir).toBe('ltr');
        expect(localStorage.getItem('uiLanguage')).toBe('eng');
        expect(getSavedUiLanguage()).toBe('eng');
    });

    it('does not save the choice with persist: false', () => {
        setUiLanguage('deu', { persist: false });
        expect(t('buttons.close')).toBe('Schließen');
        expect(localStorage.getItem('uiLanguage')).toBeNull();
    });

    it('puts right-to-left languages in the right direction', () => {
        setUiLanguage('arb');
        expect(document.documentElement.dir).toBe('rtl');
        setUiLanguage('urd');
        expect(document.documentElement.dir).toBe('rtl');
        setUiLanguage('por');
        expect(document.documentElement.dir).toBe('ltr');
    });

    it('ignores unknown languages', () => {
        setUiLanguage('xxx');
        expect(getUiLanguage().code).toBe('por');
        expect(localStorage.getItem('uiLanguage')).toBeNull();
    });

    it('notifies the listeners', () => {
        const listener = vi.fn();
        onUiLanguageChange(listener);
        setUiLanguage('spa');
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ code: 'spa' }));
    });
});

describe('translations', () => {
    it('interpolates values', () => {
        setUiLanguage('eng');
        expect(t('errors.chapterNotFound', { chapter: 9, book: 'Mark' })).toBe('Chapter 9 not found in Mark.');
    });

    it('chooses the plural form of each language', () => {
        setUiLanguage('por');
        expect(t('modals.textSearch.results', { count: 1 })).toBe('1 resultado');
        expect(t('modals.textSearch.results', { count: 5 })).toBe('5 resultados');
        setUiLanguage('rus');
        expect(t('modals.textSearch.results', { count: 1 })).toBe('1 результат');
        expect(t('modals.textSearch.results', { count: 3 })).toBe('3 результата');
        expect(t('modals.textSearch.results', { count: 5 })).toBe('5 результатов');
        setUiLanguage('arb');
        expect(t('modals.textSearch.results', { count: 2 })).toBe('نتيجتان');
        expect(t('modals.textSearch.results', { count: 7 })).toBe('7 نتائج');
        setUiLanguage('lat');
        expect(t('modals.textSearch.results', { count: 3 })).toBe('3 eventus');
    });
});

describe('translateDocument', () => {
    it('translates texts and attributes marked in the page', () => {
        document.body.innerHTML = `
            <h3 data-i18n="reader.chooseTranslation">x</h3>
            <button data-i18n-title="buttons.copy" data-i18n-aria-label="buttons.share" title="x"></button>
            <input data-i18n-placeholder="reader.referencePlaceholder">
            <p data-i18n-html="help.intro"></p>`;
        setUiLanguage('fra');
        expect(document.querySelector('h3')?.textContent).toBe('Choisissez votre traduction :');
        const button = document.querySelector('button');
        expect(button?.title).toBe('Copier le texte');
        expect(button?.getAttribute('aria-label')).toBe('Partager');
        expect(document.querySelector('input')?.placeholder).toBe('Ex. : Mt 5,3-12.21-38');
        expect(document.querySelector('p')?.innerHTML).toBe('Saisissez le livre, le chapitre et, si vous le souhaitez, les versets :');
        translateDocument();
    });
});
