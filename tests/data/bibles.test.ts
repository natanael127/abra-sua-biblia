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
import { READER_PATTERN, readerPath, UPLOAD_SLUG } from '../../src/screens/reader/url';
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
                const params = matchPath(READER_PATTERN, readerPath(entry.slug, `${abbreviation} 1,2-3`));
                expect(params, abbreviation).toEqual({ bible: entry.slug, book: abbreviation.toLowerCase(), passage: '1,2-3' });
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

    it('tem slugs únicos, legíveis na URL e diferentes dos caminhos reservados', () => {
        const slugs = index.map((e) => e.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const slug of slugs) {
            expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
            expect(slug).not.toBe(UPLOAD_SLUG);
        }
    });
});
