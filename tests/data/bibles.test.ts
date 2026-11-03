/**
 * The published Bibles are EBF1 files meant for free use outside this site.
 * These tests ensure they follow the format's official schema and stay
 * consistent with the index (generated at build time by scripts/build-index.ts).
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

describe('published Bibles', () => {
    const files = listBibleFiles();

    it('at least one Bible exists', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    describe.each(files)('%s', (file) => {
        const id = file.replace(/\.ebf1\.json$/, '');

        it('follows the official EBF1 schema', () => {
            validateSchema(loadBible(id));
            expect(validateSchema.errors ?? []).toEqual([]);
        });

        it('is accepted by the site reader', () => {
            expect(validateEbf(loadBible(id))).toEqual([]);
        });

        it('is listed in index.json with consistent name and type', () => {
            const bible = loadBible(id).bible;
            const entry = index.find((e) => e.path === `bibles/${file}`);
            expect(entry).toBeDefined();
            expect(entry?.name).toBe(bible.name);
            const expectedBooks = entry?.type ? BOOKS_BY_TYPE[entry.type] : undefined;
            if (expectedBooks !== undefined) {
                expect(bible.books).toHaveLength(expectedBooks);
            }
        });

        it('has unique abbreviations per book', () => {
            const abbreviations = loadBible(id).bible.books.map((b) => b.abbreviation?.toLowerCase());
            expect(new Set(abbreviations).size).toBe(abbreviations.length);
        });

        it('every book has a URL that resolves back to the same book', () => {
            const entry = index.find((e) => e.path === `bibles/${file}`)!;
            for (const book of loadBible(id).bible.books) {
                const abbreviation = getBookAbbreviation(book);
                const params = matchPath(READER_PATTERN, readerPath(`${entry.language}/${entry.slug}`, `${abbreviation} 1,2-3`));
                expect(parseReaderParams(params!), abbreviation).toEqual({
                    bibleKey: `${entry.language}/${entry.slug}`,
                    book: abbreviation.toLowerCase(),
                    chapterVerses: '1,2-3',
                });
            }
        });
    });
});

describe('index of the published Bibles', () => {
    it('points only to existing files', () => {
        for (const entry of index) {
            expect(existsSync(join(DATA_DIR, entry.path)), entry.path).toBe(true);
        }
    });

    it('has unique names', () => {
        const names = index.map((e) => e.name.toLowerCase());
        expect(new Set(names).size).toBe(names.length);
    });

    it('has language and slug that are URL-friendly and unique together', () => {
        const keys = index.map((e) => `${e.language}/${e.slug}`);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of index) {
            expect(entry.language).toMatch(/^[a-z]{3}$/);
            expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it('has each Bible language equal to the file', () => {
        for (const entry of index) {
            expect(loadBible(entry.path.replace(/^bibles\/|\.ebf1\.json$/g, '')).bible.language, entry.path).toBe(entry.language);
        }
    });
});
