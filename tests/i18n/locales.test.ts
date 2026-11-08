import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLAG_URLS } from '../../src/i18n/flags';
import { TRANSLATIONS } from '../../src/i18n';
import { UI_LANGUAGES } from '../../src/i18n/languages';

type Tree = { [key: string]: string | Tree };

const reference = TRANSLATIONS.por as Tree;

/** "a.b.c" -> text, for every leaf of the tree. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
    const leaves = new Map<string, string>();
    for (const [key, value] of Object.entries(tree)) {
        if (typeof value === 'string') {
            leaves.set(`${prefix}${key}`, value);
        } else {
            for (const [path, text] of flatten(value, `${prefix}${key}.`)) leaves.set(path, text);
        }
    }
    return leaves;
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const baseKey = (key: string) => key.replace(PLURAL_SUFFIX, '');
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

const referenceTexts = flatten(reference);
/** Keys without the plural suffix, with their placeholders (the plural ones all share them). */
const referenceKeys = new Map([...referenceTexts].map(([key, text]) => [baseKey(key), placeholders(text)]));

describe.each(UI_LANGUAGES.map((language) => [language.code, language] as const))('language %s', (code, language) => {
    const texts = flatten((TRANSLATIONS[code] ?? {}) as Tree);

    it('has a translation file and a flag', () => {
        expect(TRANSLATIONS[code]).toBeDefined();
        expect(FLAG_URLS[code]).toBeTruthy();
    });

    it('has exactly the keys of the reference language', () => {
        expect(new Set([...texts.keys()].map(baseKey))).toEqual(new Set(referenceKeys.keys()));
    });

    it('has no empty text', () => {
        for (const [key, text] of texts) expect(text.trim(), key).not.toBe('');
    });

    it('uses the same placeholders as the reference language', () => {
        for (const [key, text] of texts) {
            const expected = referenceKeys.get(baseKey(key));
            // Plural forms of numbers ("one", "zero"...) may omit {{count}}: they are about a fixed quantity
            const actual = placeholders(text);
            expect(
                actual.every((name) => expected?.includes(name)),
                key,
            ).toBe(true);
            if (!/_(zero|one|two)$/.test(key)) expect(actual, key).toEqual(expected);
        }
    });

    it('has a form for each plural category of the language', () => {
        const categories = new Intl.PluralRules(language.tag).resolvedOptions().pluralCategories;
        // "many" is for numbers of millions in the Romance languages: "other" covers it
        const required = categories.filter((category) => category !== 'many' || ['ru', 'ar'].includes(language.tag));
        for (const category of required) {
            expect(texts.has(`modals.textSearch.results_${category}`), category).toBe(true);
        }
        expect(texts.has('modals.textSearch.results_other')).toBe(true);
    });
});

describe('index.html', () => {
    const html = readFileSync('index.html', 'utf8');

    // The page title and the <meta> tags; the components call `t`, whose keys the typecheck validates
    it('only uses translation keys that exist', () => {
        const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1] ?? '');
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) expect(referenceKeys.has(key), key).toBe(true);
    });
});

describe('UI_LANGUAGES', () => {
    it('has the 18 required languages, alphabetical by code, with unique codes and tags', () => {
        const codes = UI_LANGUAGES.map((language) => language.code);
        expect(codes).toEqual([
            'arb', 'ben', 'deu', 'ell', 'eng', 'fra', 'grc', 'heb', 'hin', 'ind', 'ita', 'jpn', 'lat', 'por', 'rus', 'spa', 'urd', 'zho',
        ]);
        expect(codes).toEqual([...codes].sort());
        expect(new Set(UI_LANGUAGES.map((language) => language.tag)).size).toBe(UI_LANGUAGES.length);
    });

    it('marks Arabic, Hebrew and Urdu as right to left', () => {
        expect(UI_LANGUAGES.filter((language) => language.dir === 'rtl').map((language) => language.code)).toEqual([
            'arb',
            'heb',
            'urd',
        ]);
    });
});
