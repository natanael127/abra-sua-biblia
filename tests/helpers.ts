import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EbfDocument } from '../src/core/ebf';

export const ROOT_DIR = resolve(import.meta.dirname, '..');
export const DATA_DIR = join(ROOT_DIR, 'public/assets/data');
export const BIBLES_DIR = join(DATA_DIR, 'bibles');
export const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

export const listBibleFiles = (): string[] => readdirSync(BIBLES_DIR).filter((f) => f.endsWith('.ebf1.json')).sort();

const cache = new Map<string, EbfDocument>();

/** Carrega uma Bíblia publicada pelo id (nome do arquivo sem ".ebf1.json"). */
export function loadBible(id: string): EbfDocument {
    let bible = cache.get(id);
    if (!bible) {
        bible = JSON.parse(readFileSync(join(BIBLES_DIR, `${id}.ebf1.json`), 'utf8')) as EbfDocument;
        cache.set(id, bible);
    }
    return bible;
}

export const readFixture = (name: string): string => readFileSync(join(FIXTURES_DIR, name), 'utf8');
