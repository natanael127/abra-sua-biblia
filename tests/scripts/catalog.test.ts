import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBibleType, readCatalog, scanBibles, sha256, updateCatalog } from '../../scripts/catalog';

let dir: string;
let catalogFile: string;

/** Creates a minimal Bible; the file name is arbitrary, since the catalog only reads the content. */
function addBible(
    file: string,
    { name, slug, language = 'por', books = 1 }: { name?: string; slug?: string; language?: string; books?: number },
) {
    const book = { names: ['Livro'], chapters: [{ verses: ['texto'] }] };
    const bible = { name, slug, language, books: Array(books).fill(book) };
    writeFileSync(join(dir, file), JSON.stringify({ bible }));
}

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'catalog-'));
    mkdirSync(join(dir, 'bibles'));
    catalogFile = join(dir, 'catalog.json');
});

afterEach(() => {
    rmSync(dir, { recursive: true });
});

describe('getBibleType', () => {
    it('classifies by number of books', () => {
        expect(getBibleType(73)).toBe('catholic');
        expect(getBibleType(66)).toBe('protestant');
        expect(getBibleType(3)).toBe('other');
    });
});

describe('scanBibles', () => {
    it('lists the Bibles by file name, with name, language, slug, type, size and SHA-256', () => {
        addBible('b.ebf1.json', { name: 'CNBB', slug: 'cnbb', books: 73 });
        addBible('a.ebf1.json', { name: 'Almeida Corrigida', slug: 'acf', books: 66 });
        addBible('ignorado.json', { name: 'Not EBF1', slug: 'x' });
        const content = readFileSync(join(dir, 'a.ebf1.json'));
        expect(scanBibles(dir)).toEqual([
            {
                file: 'a.ebf1.json',
                name: 'Almeida Corrigida',
                language: 'por',
                slug: 'acf',
                type: 'protestant',
                size: content.length,
                sha256: sha256(content),
            },
            expect.objectContaining({ file: 'b.ebf1.json', name: 'CNBB', slug: 'cnbb', type: 'catholic' }) as unknown,
        ]);
    });

    it('takes language and slug from the content, not from the file name', () => {
        addBible('eng_kjv_1.ebf1.json', { name: 'Nova Versão', slug: 'nova-versao', language: 'por' });
        expect(scanBibles(dir)[0]).toMatchObject({ language: 'por', slug: 'nova-versao', name: 'Nova Versão' });
    });

    it.each(['name', 'slug', 'language'] as const)('fails without "bible.%s", naming the file', (field) => {
        addBible('por_x.ebf1.json', { name: 'X', slug: 'x', [field]: '' });
        expect(() => scanBibles(dir)).toThrow(`por_x.ebf1.json: missing "bible.${field}"`);
    });

    it('the same slug can exist in different languages', () => {
        addBible('a.ebf1.json', { name: 'CNBB', slug: 'cnbb' });
        addBible('b.ebf1.json', { name: 'Outra', slug: 'cnbb', language: 'eng' });
        expect(scanBibles(dir).map((entry) => `${entry.language}/${entry.slug}`)).toEqual(['por/cnbb', 'eng/cnbb']);
    });

    it('fails with a slug that is duplicated within the language', () => {
        addBible('a.ebf1.json', { name: 'A', slug: 'a-b' });
        addBible('b.ebf1.json', { name: 'B', slug: 'a-b' });
        expect(() => scanBibles(dir)).toThrow('invalid or duplicate slug "por/a-b"');
    });

    it('fails with a duplicate name', () => {
        addBible('a.ebf1.json', { name: 'Mesma', slug: 'a' });
        addBible('b.ebf1.json', { name: 'Mesma', slug: 'b' });
        expect(() => scanBibles(dir)).toThrow('duplicate name "Mesma"');
    });

    it('fails with invalid JSON, naming the file', () => {
        writeFileSync(join(dir, 'por_x.ebf1.json'), '{');
        expect(() => scanBibles(dir)).toThrow('por_x.ebf1.json: invalid JSON');
    });
});

describe('updateCatalog', () => {
    it('writes the catalog with 4 spaces and a trailing newline, reporting what was added', () => {
        addBible('a.ebf1.json', { name: 'A', slug: 'a' });
        const update = updateCatalog({ dir, catalogFile });
        expect(update).toMatchObject({ added: ['a.ebf1.json'], changed: [], removed: [] });
        const written = readFileSync(catalogFile, 'utf8');
        expect(written).toBe(`${JSON.stringify(readCatalog(catalogFile), null, 4)}\n`);
    });

    it('reports the Bibles whose content changed', () => {
        addBible('a.ebf1.json', { name: 'A', slug: 'a' });
        addBible('b.ebf1.json', { name: 'B', slug: 'b' });
        updateCatalog({ dir, catalogFile });
        addBible('b.ebf1.json', { name: 'B', slug: 'b', books: 2 });
        addBible('c.ebf1.json', { name: 'C', slug: 'c' });
        expect(updateCatalog({ dir, catalogFile })).toMatchObject({
            added: ['c.ebf1.json'],
            changed: ['b.ebf1.json'],
            removed: [],
        });
    });

    it('refuses to drop a Bible that is in the catalog but not in the folder, unless pruning', () => {
        addBible('a.ebf1.json', { name: 'A', slug: 'a' });
        addBible('b.ebf1.json', { name: 'B', slug: 'b' });
        updateCatalog({ dir, catalogFile });
        rmSync(join(dir, 'b.ebf1.json'));
        expect(() => updateCatalog({ dir, catalogFile })).toThrow('b.ebf1.json');
        expect(readCatalog(catalogFile)).toHaveLength(2);
        expect(updateCatalog({ dir, catalogFile, prune: true }).removed).toEqual(['b.ebf1.json']);
        expect(readCatalog(catalogFile).map((entry) => entry.file)).toEqual(['a.ebf1.json']);
    });
});
