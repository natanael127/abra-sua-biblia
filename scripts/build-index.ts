/**
 * Generates public/assets/data/index.json from the Bibles (*.ebf1.json) and
 * settings.json. Run by Vite on startup (dev and build); the generated file
 * is not versioned.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findUiLanguage } from '../src/i18n/languages.ts';

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
    /** ISO 639-3 code of the interface language used when the user has not chosen one and the browser's has no translation, e.g. "por". */
    defaultLanguage: string;
}

export function readSettings(file = SETTINGS_FILE): Settings {
    const settings = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>;
    if (typeof settings.defaultBible !== 'string' || !settings.defaultBible) {
        throw new Error(`${file}: "defaultBible" must be the language and slug of a Bible, e.g.: "por/ave-maria"`);
    }
    if (!findUiLanguage(settings.defaultLanguage)) {
        throw new Error(
            `${file}: "defaultLanguage" must be the ISO 639-3 code of an interface language, e.g.: "por"`,
        );
    }
    return { defaultBible: settings.defaultBible, defaultLanguage: settings.defaultLanguage as string };
}

export function getBibleType(numBooks: number): BibleType {
    for (const [type, books] of Object.entries(BIBLE_TYPE_BOOKS)) {
        if (numBooks === books) return type as BibleType;
    }
    return 'other';
}

interface BibleFile {
    bible?: { name?: unknown; slug?: unknown; language?: unknown; books?: unknown[] };
}

/** Required text field of the Bible (name, slug or language); throws if it is missing or empty. */
function requireText(path: string, field: string, value: unknown): string {
    if (typeof value !== 'string' || !value) throw new Error(`${path}: missing "bible.${field}"`);
    return value;
}

/** Builds the index; throws an error with the cause if anything prevents a valid index. */
export function buildIndex(dataDir = DATA_DIR, settings: Pick<Settings, 'defaultBible'> = readSettings()): IndexEntry[] {
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
            // Everything in the index comes from the content of the file, never from its name
            const name = requireText(path, 'name', data.bible?.name);
            const language = requireText(path, 'language', data.bible?.language);
            entries.push({
                name,
                language,
                slug: requireText(path, 'slug', data.bible?.slug),
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
export function writeIndex(dataDir = DATA_DIR, settings: Pick<Settings, 'defaultBible'> = readSettings()): IndexEntry[] {
    const entries = buildIndex(dataDir, settings);
    writeFileSync(join(dataDir, 'index.json'), `${JSON.stringify(entries, null, 4)}\n`);
    return entries;
}
