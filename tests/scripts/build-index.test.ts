import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildIndex,
    getBibleLanguage,
    getBibleSlug,
    getBibleType,
    readSettings,
    SETTINGS_FILE,
    writeIndex,
} from '../../scripts/build-index';

let dataDir: string;

/** Creates a minimal Bible with the given name and number of books. */
function addBible(file: string, name: string | undefined, books = 1) {
    const book = { names: ['Livro'], chapters: [{ verses: ['texto'] }] };
    writeFileSync(join(dataDir, 'bibles', file), JSON.stringify({ bible: { name, books: Array(books).fill(book) } }));
}

beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'build-index-'));
    mkdirSync(join(dataDir, 'bibles'));
});

afterEach(() => {
    rmSync(dataDir, { recursive: true });
});

describe('getBibleSlug', () => {
    it.each([
        ['por_ave_maria', 'ave-maria'],
        ['por_pe_matos_soares', 'pe-matos-soares'],
        ['por_aa', 'aa'],
        ['eng_KJV_1611', 'kjv-1611'],
        ['minha biblia', 'minha-biblia'],
        ['_x_', 'x'],
    ])('%s -> %s', (id, slug) => {
        expect(getBibleSlug(id)).toBe(slug);
    });
});

describe('getBibleLanguage', () => {
    it('reads the ISO 639-3 prefix from the file name', () => {
        expect(getBibleLanguage('por_ave_maria')).toBe('por');
        expect(getBibleLanguage('ENG_KJV')).toBe('eng');
        expect(getBibleLanguage('minha_biblia')).toBeUndefined();
        expect(getBibleLanguage('portugues_x')).toBeUndefined();
    });
});

describe('getBibleType', () => {
    it('classifies by number of books', () => {
        expect(getBibleType(73)).toBe('catholic');
        expect(getBibleType(66)).toBe('protestant');
        expect(getBibleType(3)).toBe('other');
    });
});

describe('buildIndex', () => {
    it('lists the Bibles in file order, with name, language, slug, type and the default one', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB', 73);
        addBible('por_acf.ebf1.json', 'Almeida Corrigida', 66);
        addBible('ignorado.json', 'Not EBF1');
        expect(buildIndex(dataDir, { defaultBible: 'por/cnbb' })).toEqual([
            {
                name: 'Almeida Corrigida',
                language: 'por',
                slug: 'acf',
                path: 'bibles/por_acf.ebf1.json',
                type: 'protestant',
            },
            {
                name: 'CNBB',
                language: 'por',
                slug: 'cnbb',
                path: 'bibles/por_cnbb.ebf1.json',
                type: 'catholic',
                default: true,
            },
        ]);
    });

    it('without a name in the Bible, uses the file name', () => {
        addBible('por_teste.ebf1.json', undefined);
        expect(buildIndex(dataDir, { defaultBible: 'por/teste' })[0]?.name).toBe('por_teste');
    });

    it('the same slug can exist in different languages', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        addBible('eng_cnbb.ebf1.json', 'Outra');
        const entries = buildIndex(dataDir, { defaultBible: 'eng/cnbb' });
        expect(entries.map((entry) => [entry.language, entry.slug, entry.default])).toEqual([
            ['eng', 'cnbb', true],
            ['por', 'cnbb', undefined],
        ]);
    });

    it('fails if the default Bible does not exist, listing the Bibles', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/ave-maria' })).toThrow(
            'the default Bible "por/ave-maria" does not exist. Bibles: por/cnbb',
        );
        expect(() => buildIndex(dataDir, { defaultBible: 'cnbb' })).toThrow('the default Bible "cnbb" does not exist');
    });

    it('fails with a slug that is duplicated within the language or empty', () => {
        addBible('por_a_b.ebf1.json', 'A');
        addBible('por_a-b.ebf1.json', 'B');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a-b' })).toThrow('invalid or duplicate slug "por/a-b"');

        rmSync(join(dataDir, 'bibles/por_a-b.ebf1.json'));
        addBible('por_.ebf1.json', 'Vazio');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a-b' })).toThrow('invalid or duplicate slug "por/"');
    });

    it('fails if the file name does not start with the language', () => {
        addBible('cnbb.ebf1.json', 'CNBB');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/cnbb' })).toThrow(
            'bibles/cnbb.ebf1.json: the file name must start with the ISO 639-3 language',
        );
    });

    it('fails with a duplicate name', () => {
        addBible('por_a.ebf1.json', 'Mesma');
        addBible('por_b.ebf1.json', 'Mesma');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a' })).toThrow('duplicate name "Mesma"');
    });

    it('fails with invalid JSON, naming the file', () => {
        writeFileSync(join(dataDir, 'bibles/por_x.ebf1.json'), '{');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/x' })).toThrow('bibles/por_x.ebf1.json: invalid JSON');
    });
});

describe('writeIndex', () => {
    it('writes index.json with 4 spaces and a trailing newline', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        writeIndex(dataDir, { defaultBible: 'por/cnbb' });
        const written = readFileSync(join(dataDir, 'index.json'), 'utf8');
        expect(written).toBe(`${JSON.stringify(JSON.parse(written), null, 4)}\n`);
        expect(written).toContain('\n    {\n        "name": "CNBB",');
    });
});

describe('readSettings', () => {
    it('reads the project settings.json', () => {
        expect(readSettings(SETTINGS_FILE)).toEqual({ defaultBible: 'por/ave-maria', defaultLanguage: 'por' });
    });

    it('requires the default Bible slug', () => {
        const file = join(dataDir, 'settings.json');
        writeFileSync(file, '{}');
        expect(() => readSettings(file)).toThrow('"defaultBible" must be the language and slug of a Bible');
    });

    it('requires the default interface language to be a supported one', () => {
        const file = join(dataDir, 'settings.json');
        writeFileSync(file, '{"defaultBible": "por/ave-maria"}');
        expect(() => readSettings(file)).toThrow('"defaultLanguage" must be the ISO 639-3 code of an interface language');
        writeFileSync(file, '{"defaultBible": "por/ave-maria", "defaultLanguage": "xxx"}');
        expect(() => readSettings(file)).toThrow('"defaultLanguage" must be the ISO 639-3 code of an interface language');
        writeFileSync(file, '{"defaultBible": "por/ave-maria", "defaultLanguage": "eng"}');
        expect(readSettings(file).defaultLanguage).toBe('eng');
    });
});
