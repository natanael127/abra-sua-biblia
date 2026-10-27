/**
 * As Bíblias publicadas são arquivos EBF1 para uso livre fora deste site.
 * Estes testes garantem que continuam válidas e coerentes com o índice.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEbf } from '../../src/core/ebf';
import type { BibleIndexEntry } from '../../src/data/bibles';
import { DATA_DIR, listBibleFiles, loadBible } from '../helpers';

const index = JSON.parse(readFileSync(join(DATA_DIR, 'index.json'), 'utf8')) as BibleIndexEntry[];
const BOOKS_BY_TYPE: Record<string, number> = { catholic: 73, protestant: 66 };

describe('Bíblias publicadas', () => {
    const files = listBibleFiles();

    it('existe pelo menos uma Bíblia', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    describe.each(files)('%s', (file) => {
        const id = file.replace(/\.ebf1\.json$/, '');

        it('segue o formato EBF1', () => {
            expect(validateEbf(loadBible(id))).toEqual([]);
        });

        it('consta no index.json com nome e tipo coerentes', () => {
            const bible = loadBible(id).bible;
            const entry = index.find((e) => e.path === `bibles/${file}`);
            expect(entry).toBeDefined();
            expect(entry?.name).toBe(bible.name);
            const expectedBooks = entry?.type ? BOOKS_BY_TYPE[entry.type] : undefined;
            if (expectedBooks !== undefined) {
                expect(bible.books).toHaveLength(expectedBooks);
            }
        });

        it('tem abreviações únicas por livro', () => {
            const abbreviations = loadBible(id).bible.books.map((b) => b.abbreviation?.toLowerCase());
            expect(new Set(abbreviations).size).toBe(abbreviations.length);
        });
    });
});

describe('index.json', () => {
    it('aponta apenas para arquivos existentes', () => {
        for (const entry of index) {
            expect(existsSync(join(DATA_DIR, entry.path)), entry.path).toBe(true);
        }
    });

    it('tem nomes únicos (usados como identificador nos links compartilhados)', () => {
        const names = index.map((e) => e.name.toLowerCase());
        expect(new Set(names).size).toBe(names.length);
    });
});
