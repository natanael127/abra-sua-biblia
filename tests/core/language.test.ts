import { iso6393To1 } from 'iso-639-3/iso6393-to-1.js';
import { iso6393To2B } from 'iso-639-3/iso6393-to-2b.js';
import { describe, expect, it } from 'vitest';
import { toIso6393 } from '../../src/core/language';

describe('toIso6393', () => {
    it.each([
        ['pt', 'por'],
        ['PT', 'por'],
        ['pt-BR', 'por'],
        ['pt_BR', 'por'],
        ['por', 'por'],
        ['en', 'eng'],
        ['zh-Hans', 'zho'],
        ['ger', 'deu'],
        ['chi', 'zho'],
        ['grc', 'grc'],
        ['hbo', 'hbo'],
        ['zz', 'und'],
        ['', 'und'],
        [null, 'und'],
        [undefined, 'und'],
        ['portuguese', 'und'],
    ])('%j -> %s', (code, expected) => {
        expect(toIso6393(code)).toBe(expected);
    });
});

describe('tables from the iso-639-3 package', () => {
    it('converts all ISO 639-1 codes', () => {
        const entries = Object.entries(iso6393To1);
        // Same count as the previous table (iso-codes 4.9.0); only changes if the standard changes
        expect(entries).toHaveLength(184);
        for (const [iso3, iso1] of entries) {
            expect(toIso6393(iso1)).toBe(iso3);
            expect(toIso6393(`${iso1.toUpperCase()}-XX`)).toBe(iso3);
        }
    });

    it('converts the ISO 639-2 bibliographic codes (639-2/B)', () => {
        const bibliographic = Object.entries(iso6393To2B).filter(([iso3, iso2b]) => iso3 !== iso2b);
        expect(bibliographic).toHaveLength(20);
        for (const [iso3, iso2b] of bibliographic) {
            expect(toIso6393(iso2b)).toBe(iso3);
        }
    });
});
