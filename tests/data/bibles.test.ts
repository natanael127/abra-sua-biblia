/**
 * The Bibles are EBF1 files meant for free use outside this site, kept in the Blob store. These
 * tests ensure that the ones in the catalog (read from the local copy, which tests/global-setup.ts
 * brings up to date and checks against the catalog) follow the format's official schema and stay
 * consistent with the catalog and the index (generated at build time by scripts/build-index.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import ebf1Schema from 'easy-bible-format/ebf1-schema.json';
import { buildIndex, readSettings } from '../../scripts/build-index';
import { type CatalogEntry, readCatalog, sha256 } from '../../scripts/catalog';
import { findBookByUrlId, getBookUrlId, validateEbf } from '../../src/core/ebf';
import { matchPath } from '../../src/router/path';
import { parseReaderParams, READER_PATTERN, readerPath } from '../../src/screens/reader/url';
import { BIBLES_DIR, loadBible } from '../helpers';

const catalog = readCatalog();
const settings = readSettings();
const index = buildIndex(catalog, settings);
const BOOKS_BY_TYPE: Record<string, number> = { catholic: 73, protestant: 66 };
const validateSchema = new Ajv({ allErrors: true }).compile(ebf1Schema);

describe('Bibles of the catalog', () => {
    it('at least one Bible exists', () => {
        expect(catalog.length).toBeGreaterThan(0);
    });

    describe.each(catalog.map((entry) => [entry.file, entry] as [string, CatalogEntry]))('%s', (file, entry) => {
        const id = file.replace(/\.ebf1\.json$/, '');

        it('is the file registered in the catalog (size and SHA-256)', () => {
            const content = readFileSync(join(BIBLES_DIR, file));
            expect(content.length).toBe(entry.size);
            expect(sha256(content)).toBe(entry.sha256);
        });

        it('follows the official EBF1 schema', () => {
            validateSchema(loadBible(id));
            expect(validateSchema.errors ?? []).toEqual([]);
        });

        it('is accepted by the site reader', () => {
            expect(validateEbf(loadBible(id))).toEqual([]);
        });

        it('has the name, language, slug and type of the catalog', () => {
            const bible = loadBible(id).bible;
            expect(entry.name).toBe(bible.name);
            expect(entry.language).toBe(bible.language);
            expect(entry.slug).toBe((bible as { slug?: string }).slug);
            const expectedBooks = BOOKS_BY_TYPE[entry.type];
            if (expectedBooks !== undefined) {
                expect(bible.books).toHaveLength(expectedBooks);
            }
        });

        it('has unique abbreviations per book', () => {
            const abbreviations = loadBible(id).bible.books.map((b) => b.abbreviation?.toLowerCase());
            expect(new Set(abbreviations).size).toBe(abbreviations.length);
        });

        it('every book has a USFM id', () => {
            const missing = loadBible(id).bible.books.filter((b) => !b.usfm_id).map((b) => b.names[0]);
            expect(missing).toEqual([]);
        });

        it('every book has a URL that resolves back to the same book', () => {
            const bible = loadBible(id);
            for (const book of bible.bible.books) {
                const urlId = getBookUrlId(book);
                const params = matchPath(READER_PATTERN, readerPath(`${entry.language}/${entry.slug}`, `${urlId} 1,2-3`));
                const target = parseReaderParams(params!);
                expect(target, urlId).toEqual({
                    bibleKey: `${entry.language}/${entry.slug}`,
                    book: urlId.toLowerCase(),
                    chapterVerses: '1,2-3',
                });
                expect(findBookByUrlId(bible, target.book!), urlId).toBe(book);
            }
        });
    });
});

describe('index of the Bibles', () => {
    it('has one entry per Bible of the catalog, in the same order', () => {
        expect(index.map((entry) => entry.name)).toEqual(catalog.map((entry) => entry.name));
    });

    it('points every Bible to its file in the Blob store, versioned by the hash', () => {
        index.forEach((entry, i) => {
            const { file, sha256: hash } = catalog[i]!;
            expect(entry.url).toBe(`${settings.biblesUrl}/${file}?v=${hash.slice(0, 12)}`);
        });
    });

    it('has the default Bible of settings.json', () => {
        const defaults = index.filter((entry) => entry.default);
        expect(defaults.map((entry) => `${entry.language}/${entry.slug}`)).toEqual([settings.defaultBible]);
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
});
