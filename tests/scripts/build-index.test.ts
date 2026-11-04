import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndex, getBibleType, readSettings, SETTINGS_FILE, writeIndex } from '../../scripts/build-index';

let dataDir: string;

/** Creates a minimal Bible; the file name is arbitrary, since the index only reads the content. */
function addBible(
    file: string,
    { name, slug, language = 'por', books = 1 }: { name?: string; slug?: string; language?: string; books?: number },
) {
    const book = { names: ['Livro'], chapters: [{ verses: ['texto'] }] };
    const bible = { name, slug, language, books: Array(books).fill(book) };
    writeFileSync(join(dataDir, 'bibles', file), JSON.stringify({ bible }));
}

beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'build-index-'));
    mkdirSync(join(dataDir, 'bibles'));
});

afterEach(() => {
    rmSync(dataDir, { recursive: true });
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
        addBible('b.ebf1.json', { name: 'CNBB', slug: 'cnbb', books: 73 });
        addBible('a.ebf1.json', { name: 'Almeida Corrigida', slug: 'acf', books: 66 });
        addBible('ignorado.json', { name: 'Not EBF1', slug: 'x' });
        expect(buildIndex(dataDir, { defaultBible: 'por/cnbb' })).toEqual([
            {
                name: 'Almeida Corrigida',
                language: 'por',
                slug: 'acf',
                path: 'bibles/a.ebf1.json',
                type: 'protestant',
            },
            {
                name: 'CNBB',
                language: 'por',
                slug: 'cnbb',
                path: 'bibles/b.ebf1.json',
                type: 'catholic',
                default: true,
            },
        ]);
    });

    it('takes language and slug from the content, not from the file name', () => {
        addBible('eng_kjv_1.ebf1.json', { name: 'Nova Versão', slug: 'nova-versao', language: 'por' });
        const [entry] = buildIndex(dataDir, { defaultBible: 'por/nova-versao' });
        expect(entry).toMatchObject({ language: 'por', slug: 'nova-versao', name: 'Nova Versão' });
    });

    it.each(['name', 'slug', 'language'] as const)('fails without "bible.%s", naming the file', (field) => {
        addBible('por_x.ebf1.json', { name: 'X', slug: 'x', [field]: '' });
        expect(() => buildIndex(dataDir, { defaultBible: 'por/x' })).toThrow(
            `bibles/por_x.ebf1.json: missing "bible.${field}"`,
        );
    });

    it('the same slug can exist in different languages', () => {
        addBible('a.ebf1.json', { name: 'CNBB', slug: 'cnbb' });
        addBible('b.ebf1.json', { name: 'Outra', slug: 'cnbb', language: 'eng' });
        const entries = buildIndex(dataDir, { defaultBible: 'eng/cnbb' });
        expect(entries.map((entry) => [entry.language, entry.slug, entry.default])).toEqual([
            ['por', 'cnbb', undefined],
            ['eng', 'cnbb', true],
        ]);
    });

    it('fails if the default Bible does not exist, listing the Bibles', () => {
        addBible('a.ebf1.json', { name: 'CNBB', slug: 'cnbb' });
        expect(() => buildIndex(dataDir, { defaultBible: 'por/ave-maria' })).toThrow(
            'the default Bible "por/ave-maria" does not exist. Bibles: por/cnbb',
        );
        expect(() => buildIndex(dataDir, { defaultBible: 'cnbb' })).toThrow('the default Bible "cnbb" does not exist');
    });

    it('fails with a slug that is duplicated within the language', () => {
        addBible('a.ebf1.json', { name: 'A', slug: 'a-b' });
        addBible('b.ebf1.json', { name: 'B', slug: 'a-b' });
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a-b' })).toThrow('invalid or duplicate slug "por/a-b"');
    });

    it('fails with a duplicate name', () => {
        addBible('a.ebf1.json', { name: 'Mesma', slug: 'a' });
        addBible('b.ebf1.json', { name: 'Mesma', slug: 'b' });
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a' })).toThrow('duplicate name "Mesma"');
    });

    it('fails with invalid JSON, naming the file', () => {
        writeFileSync(join(dataDir, 'bibles/por_x.ebf1.json'), '{');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/x' })).toThrow('bibles/por_x.ebf1.json: invalid JSON');
    });
});

describe('writeIndex', () => {
    it('writes index.json with 4 spaces and a trailing newline', () => {
        addBible('por_cnbb.ebf1.json', { name: 'CNBB', slug: 'cnbb' });
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
