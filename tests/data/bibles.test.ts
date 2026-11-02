/**
 * As Bíblias publicadas são arquivos EBF1 para uso livre fora deste site.
 * Estes testes garantem que seguem o schema oficial do formato e continuam
 * coerentes com o índice (gerado no build por scripts/build-index.ts).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import ebf1Schema from 'easy-bible-format/ebf1-schema.json';
import { validateEbf } from '../../src/core/ebf';
import { getBookAbbreviation } from '../../src/core/ebf';
import { buildIndex } from '../../scripts/build-index';
import { matchPath } from '../../src/router/path';
import { parseReaderParams, READER_PATTERN, readerPath } from '../../src/screens/reader/url';
import { DATA_DIR, listBibleFiles, loadBible } from '../helpers';

const index = buildIndex();
const BOOKS_BY_TYPE: Record<string, number> = { catholic: 73, protestant: 66 };
const validateSchema = new Ajv({ allErrors: true }).compile(ebf1Schema);

describe('Bíblias publicadas', () => {
    const files = listBibleFiles();

    it('existe pelo menos uma Bíblia', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    describe.each(files)('%s', (file) => {
        const id = file.replace(/\.ebf1\.json$/, '');

        it('segue o schema oficial do EBF1', () => {
            validateSchema(loadBible(id));
            expect(validateSchema.errors ?? []).toEqual([]);
        });

        it('é aceita pelo leitor do site', () => {
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

        it('todo livro tem URL que volta ao mesmo livro', () => {
            const entry = index.find((e) => e.path === `bibles/${file}`)!;
            for (const book of loadBible(id).bible.books) {
                const abbreviation = getBookAbbreviation(book);
                const params = matchPath(READER_PATTERN, readerPath(`${entry.language}/${entry.slug}`, `${abbreviation} 1,2-3`));
                expect(parseReaderParams(params!), abbreviation).toEqual({
                    bibleKey: `${entry.language}/${entry.slug}`,
                    book: abbreviation.toLowerCase(),
                    passage: '1,2-3',
                });
            }
        });
    });
});

describe('índice das Bíblias publicadas', () => {
    it('aponta apenas para arquivos existentes', () => {
        for (const entry of index) {
            expect(existsSync(join(DATA_DIR, entry.path)), entry.path).toBe(true);
        }
    });

    it('tem nomes únicos', () => {
        const names = index.map((e) => e.name.toLowerCase());
        expect(new Set(names).size).toBe(names.length);
    });

    it('tem idioma e slug legíveis na URL, únicos juntos', () => {
        const keys = index.map((e) => `${e.language}/${e.slug}`);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of index) {
            expect(entry.language).toMatch(/^[a-z]{3}$/);
            expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it('tem o idioma de cada Bíblia igual ao do arquivo', () => {
        for (const entry of index) {
            expect(loadBible(entry.path.replace(/^bibles\/|\.ebf1\.json$/g, '')).bible.language, entry.path).toBe(entry.language);
        }
    });
});
