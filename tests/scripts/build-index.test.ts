import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildIndex, readSettings, SETTINGS_FILE, writeIndex } from '../../scripts/build-index';
import type { CatalogEntry } from '../../scripts/catalog';

const BASE = 'https://store.example.com';
let dataDir: string;

const entry = (file: string, fields: Partial<CatalogEntry> = {}): CatalogEntry => ({
    file,
    name: 'CNBB',
    language: 'por',
    slug: 'cnbb',
    type: 'catholic',
    size: 10,
    sha256: 'abcdef0123456789'.repeat(4),
    ...fields,
});

beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'build-index-'));
});

afterEach(() => {
    rmSync(dataDir, { recursive: true });
});

describe('buildIndex', () => {
    it('lists the Bibles of the catalog, with the URL in the Blob store and the default one', () => {
        const catalog = [
            entry('a.ebf1.json', { name: 'Almeida Corrigida', slug: 'acf', type: 'protestant' }),
            entry('b.ebf1.json'),
        ];
        expect(buildIndex(catalog, { defaultBible: 'por/cnbb', biblesUrl: BASE })).toEqual([
            {
                name: 'Almeida Corrigida',
                language: 'por',
                slug: 'acf',
                url: `${BASE}/a.ebf1.json?v=abcdef012345`,
                type: 'protestant',
            },
            {
                name: 'CNBB',
                language: 'por',
                slug: 'cnbb',
                url: `${BASE}/b.ebf1.json?v=abcdef012345`,
                type: 'catholic',
                default: true,
            },
        ]);
    });

    it('the URL changes when the file changes', () => {
        const settings = { defaultBible: 'por/cnbb', biblesUrl: BASE };
        const [before] = buildIndex([entry('a.ebf1.json')], settings);
        const [after] = buildIndex([entry('a.ebf1.json', { sha256: '0'.repeat(64) })], settings);
        expect(after?.url).not.toBe(before?.url);
    });

    it('fails if the default Bible does not exist, listing the Bibles', () => {
        const catalog = [entry('a.ebf1.json')];
        expect(() => buildIndex(catalog, { defaultBible: 'por/ave-maria', biblesUrl: BASE })).toThrow(
            'the default Bible "por/ave-maria" does not exist. Bibles: por/cnbb',
        );
        expect(() => buildIndex(catalog, { defaultBible: 'cnbb', biblesUrl: BASE })).toThrow(
            'the default Bible "cnbb" does not exist',
        );
    });
});

describe('writeIndex', () => {
    it('writes index.json with 4 spaces and a trailing newline, creating the folder', () => {
        const folder = join(dataDir, 'assets/data');
        writeIndex(folder, [entry('por_cnbb.ebf1.json')], { defaultBible: 'por/cnbb', biblesUrl: BASE });
        const written = readFileSync(join(folder, 'index.json'), 'utf8');
        expect(written).toBe(`${JSON.stringify(JSON.parse(written), null, 4)}\n`);
        expect(written).toContain('\n    {\n        "name": "CNBB",');
    });
});

describe('readSettings', () => {
    it('reads the project settings.json', () => {
        expect(readSettings(SETTINGS_FILE)).toMatchObject({
            defaultBible: 'por/ave-maria',
            defaultLanguage: 'por',
            biblesUrl: expect.stringMatching(/^https:\/\//) as string,
        });
    });

    it('requires the default Bible slug', () => {
        const file = join(dataDir, 'settings.json');
        writeFileSync(file, '{}');
        expect(() => readSettings(file)).toThrow('"defaultBible" must be the language and slug of a Bible');
    });

    it('requires the default interface language to be a supported one', () => {
        const file = join(dataDir, 'settings.json');
        const settings = (fields: object) => JSON.stringify({ defaultBible: 'por/ave-maria', biblesUrl: BASE, ...fields });
        writeFileSync(file, settings({}));
        expect(() => readSettings(file)).toThrow('"defaultLanguage" must be the ISO 639-3 code of an interface language');
        writeFileSync(file, settings({ defaultLanguage: 'xxx' }));
        expect(() => readSettings(file)).toThrow('"defaultLanguage" must be the ISO 639-3 code of an interface language');
        writeFileSync(file, settings({ defaultLanguage: 'eng' }));
        expect(readSettings(file).defaultLanguage).toBe('eng');
    });

    it('requires the https URL of the Blob store, without the trailing slash', () => {
        const file = join(dataDir, 'settings.json');
        const settings = (biblesUrl?: string) =>
            JSON.stringify({ defaultBible: 'por/ave-maria', defaultLanguage: 'por', ...(biblesUrl ? { biblesUrl } : {}) });
        for (const invalid of [undefined, 'http://store.example.com', 'store.example.com', `${BASE}/`, `${BASE}?x=1`]) {
            writeFileSync(file, settings(invalid));
            expect(() => readSettings(file), String(invalid)).toThrow('"biblesUrl" must be the https URL');
        }
        writeFileSync(file, settings(`${BASE}/bibles`));
        expect(readSettings(file).biblesUrl).toBe(`${BASE}/bibles`);
    });
});
