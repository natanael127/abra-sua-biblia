import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CACHE_DIR, readCatalog } from '../scripts/catalog';
import type { EbfDocument } from '../src/core/ebf';

export const ROOT_DIR = resolve(import.meta.dirname, '..');
/** Local copy of the Bibles (from the Blob store), brought up to date by tests/global-setup.ts. */
export const BIBLES_DIR = CACHE_DIR;
export const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

export const listBibleFiles = (): string[] => readCatalog().map((entry) => entry.file);

const cache = new Map<string, EbfDocument>();

/** Loads a Bible of the catalog by id (file name without ".ebf1.json"). */
export function loadBible(id: string): EbfDocument {
    let bible = cache.get(id);
    if (!bible) {
        bible = JSON.parse(readFileSync(join(BIBLES_DIR, `${id}.ebf1.json`), 'utf8')) as EbfDocument;
        cache.set(id, bible);
    }
    return bible;
}

export const readFixture = (name: string): string => readFileSync(join(FIXTURES_DIR, name), 'utf8');
