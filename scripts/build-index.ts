/**
 * Generates public/assets/data/index.json from the Bible catalog (bibles-catalog.json) and
 * settings.json. Run by Vite on startup (dev and build); the generated file is not versioned.
 * The Bibles themselves are not published by the site: the index points to them in the Blob store.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findUiLanguage } from '../src/i18n/languages.ts';
import { type BibleType, type CatalogEntry, readCatalog, ROOT_DIR } from './catalog.ts';

export { ROOT_DIR };
/** Data folder published by the site (holds index.json). */
export const DATA_DIR = join(ROOT_DIR, 'public/assets/data');
export const SETTINGS_FILE = join(ROOT_DIR, 'settings.json');

export interface IndexEntry {
    name: string;
    /** Bible language (ISO 639-3), e.g. "por". */
    language: string;
    /** Bible identifier within its language, e.g. "ave-maria". */
    slug: string;
    /** Absolute URL of the Bible in the Blob store, versioned by its hash. */
    url: string;
    type: BibleType;
    default?: true;
}

export interface Settings {
    /** Language and slug of the Bible opened on the first visit, e.g. "por/ave-maria". */
    defaultBible: string;
    /** ISO 639-3 code of the interface language used when the user has not chosen one and the browser's has no translation, e.g. "por". */
    defaultLanguage: string;
    /** URL of the Blob store that holds the Bibles, without the trailing slash. */
    biblesUrl: string;
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
    if (typeof settings.biblesUrl !== 'string' || !/^https:\/\/[^/?#]+(\/[^?#]*[^/?#])?$/.test(settings.biblesUrl)) {
        throw new Error(
            `${file}: "biblesUrl" must be the https URL of the Blob store that holds the Bibles, without the trailing slash`,
        );
    }
    return {
        defaultBible: settings.defaultBible,
        defaultLanguage: settings.defaultLanguage as string,
        biblesUrl: settings.biblesUrl,
    };
}

/** Number of hash characters in the version that makes the URL of a Bible change when the file changes. */
const VERSION_LENGTH = 12;

/** Builds the index; throws an error with the cause if anything prevents a valid index. */
export function buildIndex(
    catalog: readonly CatalogEntry[] = readCatalog(),
    settings: Pick<Settings, 'defaultBible' | 'biblesUrl'> = readSettings(),
): IndexEntry[] {
    const entries: IndexEntry[] = catalog.map((entry) => ({
        name: entry.name,
        language: entry.language,
        slug: entry.slug,
        // The query only makes the browser fetch again when the Bible changes (the store ignores it)
        url: `${settings.biblesUrl}/${entry.file}?v=${entry.sha256.slice(0, VERSION_LENGTH)}`,
        type: entry.type,
    }));

    const keys = entries.map((entry) => `${entry.language}/${entry.slug}`);
    const defaultEntry = entries.find((_, i) => keys[i] === settings.defaultBible);
    if (!defaultEntry) {
        throw new Error(
            `settings.json: the default Bible "${settings.defaultBible}" does not exist. Bibles: ${keys.join(', ')}`,
        );
    }
    defaultEntry.default = true;

    return entries;
}

/** Generates and writes index.json; returns the generated index. */
export function writeIndex(
    dataDir = DATA_DIR,
    catalog: readonly CatalogEntry[] = readCatalog(),
    settings: Pick<Settings, 'defaultBible' | 'biblesUrl'> = readSettings(),
): IndexEntry[] {
    const entries = buildIndex(catalog, settings);
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'index.json'), `${JSON.stringify(entries, null, 4)}\n`);
    return entries;
}
