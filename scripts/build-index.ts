/**
 * Generates public/assets/data/index.json from the Bibles (*.ebf1.json) and
 * settings.json. Run by Vite on startup (dev and build); the generated file
 * is not versioned.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dirname, '..');
/** Data folder published by the site (holds index.json and the Bibles). */
export const DATA_DIR = join(ROOT_DIR, 'public/assets/data');
export const SETTINGS_FILE = join(ROOT_DIR, 'settings.json');

/** Folders, relative to DATA_DIR, that hold the Bibles. */
const BIBLE_DIRECTORIES = ['bibles'];
const BIBLE_FILE_SUFFIX = '.ebf1.json';

/** Number of books per Bible type. */
const BIBLE_TYPE_BOOKS = {
    catholic: 73, // 46 OT + 27 NT (includes deuterocanonical books)
    protestant: 66, // 39 OT + 27 NT
} as const;

export type BibleType = keyof typeof BIBLE_TYPE_BOOKS | 'other';

export interface IndexEntry {
    name: string;
    /** Bible language (ISO 639-3), e.g. "por". */
    language: string;
    /** Bible identifier within its language, e.g. "ave-maria". */
    slug: string;
    /** Path relative to DATA_DIR, e.g. "bibles/por_ave_maria.ebf1.json". */
    path: string;
    type: BibleType;
    default?: true;
}

export interface Settings {
    /** Language and slug of the Bible opened on the first visit, e.g. "por/ave-maria". */
    defaultBible: string;
}

export function readSettings(file = SETTINGS_FILE): Settings {
    const settings = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>;
    if (typeof settings.defaultBible !== 'string' || !settings.defaultBible) {
        throw new Error(`${file}: "defaultBible" must be the language and slug of a Bible, e.g.: "por/ave-maria"`);
    }
    return { defaultBible: settings.defaultBible };
}

export function getBibleType(numBooks: number): BibleType {
    for (const [type, books] of Object.entries(BIBLE_TYPE_BOOKS)) {
        if (numBooks === books) return type as BibleType;
    }
    return 'other';
}

/** ISO 639-3 language at the start of the file name: "por_ave_maria" -> "por"; undefined without the prefix. */
export function getBibleLanguage(bibleId: string): string | undefined {
    return /^([a-z]{3})_/i.exec(bibleId)?.[1]?.toLowerCase();
}

/**
 * Bible identifier in the URL, after the language (e.g. /por/ave-maria/jo/3,16),
 * derived from the file name without the ISO 639-3 language prefix:
 * "por_ave_maria" -> "ave-maria".
 */
export function getBibleSlug(bibleId: string): string {
    return bibleId
        .toLowerCase()
        .replace(/^[a-z]{3}_/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

interface BibleFile {
    bible?: { name?: unknown; books?: unknown[] };
}

/** Builds the index; throws an error with the cause if anything prevents a valid index. */
export function buildIndex(dataDir = DATA_DIR, settings: Settings = readSettings()): IndexEntry[] {
    const entries: IndexEntry[] = [];

    for (const directory of BIBLE_DIRECTORIES) {
        const files = readdirSync(join(dataDir, directory))
            .filter((file) => file.endsWith(BIBLE_FILE_SUFFIX))
            .sort();
        for (const file of files) {
            const path = `${directory}/${file}`;
            let data: BibleFile;
            try {
                data = JSON.parse(readFileSync(join(dataDir, path), 'utf8')) as BibleFile;
            } catch (error) {
                throw new Error(`${path}: invalid JSON`, { cause: error });
            }
            const bibleId = file.slice(0, -BIBLE_FILE_SUFFIX.length);
            const language = getBibleLanguage(bibleId);
            if (!language) {
                throw new Error(`${path}: the file name must start with the ISO 639-3 language, e.g.: "por_${bibleId}"`);
            }
            const name = typeof data.bible?.name === 'string' && data.bible.name ? data.bible.name : bibleId;
            entries.push({
                name,
                language,
                slug: getBibleSlug(bibleId),
                path,
                type: getBibleType(data.bible?.books?.length ?? 0),
            });
        }
    }

    // The name appears in the translation list, and language/slug identify the Bible in the URL
    const names = new Set<string>();
    const keys = new Set<string>();
    for (const entry of entries) {
        const key = `${entry.language}/${entry.slug}`;
        if (names.has(entry.name)) throw new Error(`${entry.path}: duplicate name "${entry.name}"`);
        if (!entry.slug || keys.has(key)) {
            throw new Error(`${entry.path}: invalid or duplicate slug "${key}"`);
        }
        names.add(entry.name);
        keys.add(key);
    }

    const defaultEntry = entries.find((entry) => `${entry.language}/${entry.slug}` === settings.defaultBible);
    if (!defaultEntry) {
        throw new Error(
            `settings.json: the default Bible "${settings.defaultBible}" does not exist. Bibles: ${[...keys].join(', ')}`,
        );
    }
    defaultEntry.default = true;

    return entries;
}

/** Generates and writes index.json; returns the generated index. */
export function writeIndex(dataDir = DATA_DIR, settings: Settings = readSettings()): IndexEntry[] {
    const entries = buildIndex(dataDir, settings);
    writeFileSync(join(dataDir, 'index.json'), `${JSON.stringify(entries, null, 4)}\n`);
    return entries;
}
