/**
 * The Bible catalog (bibles-catalog.json, versioned): one entry per Bible with what the site needs
 * to list it (name, language, slug, type) and to fetch it from the Blob store (file name, size and
 * SHA-256). The Bibles themselves are not in git: they live in the Blob store, and a local copy
 * (CACHE_DIR) is used by the tests.
 *
 * Everything in an entry comes from the content of the file, never from its name.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dirname, '..');
export const CATALOG_FILE = join(ROOT_DIR, 'bibles-catalog.json');
/** Local copy of the Bibles (not versioned), filled by scripts/fetch-bibles.ts. */
export const CACHE_DIR = join(ROOT_DIR, '.bibles-cache');
export const BIBLE_FILE_SUFFIX = '.ebf1.json';

/** Number of books per Bible type. */
const BIBLE_TYPE_BOOKS = {
    catholic: 73, // 46 OT + 27 NT (includes deuterocanonical books)
    protestant: 66, // 39 OT + 27 NT
} as const;

export type BibleType = keyof typeof BIBLE_TYPE_BOOKS | 'other';

export interface CatalogEntry {
    /** File name in the Blob store and in the local copy, e.g. "por_ave_maria.ebf1.json". */
    file: string;
    name: string;
    /** Bible language (ISO 639-3), e.g. "por". */
    language: string;
    /** Bible identifier within its language, e.g. "ave-maria". */
    slug: string;
    type: BibleType;
    /** Size of the file in bytes. */
    size: number;
    sha256: string;
}

export function getBibleType(numBooks: number): BibleType {
    for (const [type, books] of Object.entries(BIBLE_TYPE_BOOKS)) {
        if (numBooks === books) return type as BibleType;
    }
    return 'other';
}

export const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

export function readCatalog(file = CATALOG_FILE): CatalogEntry[] {
    return JSON.parse(readFileSync(file, 'utf8')) as CatalogEntry[];
}

export function writeCatalog(entries: readonly CatalogEntry[], file = CATALOG_FILE): void {
    writeFileSync(file, `${JSON.stringify(entries, null, 4)}\n`);
}

interface BibleFile {
    bible?: { name?: unknown; slug?: unknown; language?: unknown; books?: unknown[] };
}

/** Required text field of the Bible (name, slug or language); throws if it is missing or empty. */
function requireText(file: string, field: string, value: unknown): string {
    if (typeof value !== 'string' || !value) throw new Error(`${file}: missing "bible.${field}"`);
    return value;
}

/** Reads the Bibles (*.ebf1.json) of a folder, sorted by file name; throws an error with the cause if any is invalid. */
export function scanBibles(dir = CACHE_DIR): CatalogEntry[] {
    const entries: CatalogEntry[] = [];
    for (const file of readdirSync(dir).filter((name) => name.endsWith(BIBLE_FILE_SUFFIX)).sort()) {
        const content = readFileSync(join(dir, file));
        let data: BibleFile;
        try {
            data = JSON.parse(content.toString('utf8')) as BibleFile;
        } catch (error) {
            throw new Error(`${file}: invalid JSON`, { cause: error });
        }
        entries.push({
            file,
            name: requireText(file, 'name', data.bible?.name),
            language: requireText(file, 'language', data.bible?.language),
            slug: requireText(file, 'slug', data.bible?.slug),
            type: getBibleType(data.bible?.books?.length ?? 0),
            size: content.length,
            sha256: sha256(content),
        });
    }

    // The name appears in the translation list, and language/slug identify the Bible in the URL
    const names = new Set<string>();
    const keys = new Set<string>();
    for (const entry of entries) {
        const key = `${entry.language}/${entry.slug}`;
        if (names.has(entry.name)) throw new Error(`${entry.file}: duplicate name "${entry.name}"`);
        if (keys.has(key)) throw new Error(`${entry.file}: invalid or duplicate slug "${key}"`);
        names.add(entry.name);
        keys.add(key);
    }
    return entries;
}

export interface CatalogUpdate {
    entries: CatalogEntry[];
    added: string[];
    changed: string[];
    removed: string[];
}

/**
 * Regenerates the catalog from the Bibles in `dir`. A Bible that is in the current catalog but not
 * in the folder is an error (the folder is probably incomplete: run fetch-bibles first), unless
 * `prune` says it was removed on purpose.
 */
export function updateCatalog({
    dir = CACHE_DIR,
    catalogFile = CATALOG_FILE,
    prune = false,
}: { dir?: string; catalogFile?: string; prune?: boolean } = {}): CatalogUpdate {
    const entries = scanBibles(dir);
    const current = existsSync(catalogFile) ? readCatalog(catalogFile) : [];
    const currentByFile = new Map(current.map((entry) => [entry.file, entry]));
    const files = new Set(entries.map((entry) => entry.file));

    const removed = current.map((entry) => entry.file).filter((file) => !files.has(file));
    if (removed.length > 0 && !prune) {
        throw new Error(
            `Bibles in the catalog but not in ${dir}: ${removed.join(', ')}. ` +
                'Run "npm run bibles:fetch" first, or use --prune if they were removed on purpose.',
        );
    }

    const added = entries.filter((entry) => !currentByFile.has(entry.file)).map((entry) => entry.file);
    const changed = entries
        .filter((entry) => {
            const before = currentByFile.get(entry.file);
            return before !== undefined && JSON.stringify(before) !== JSON.stringify(entry);
        })
        .map((entry) => entry.file);
    writeCatalog(entries, catalogFile);
    return { entries, added, changed, removed };
}

// CLI: node scripts/catalog.ts [folder] [--prune]
if (process.argv[1] === import.meta.filename) {
    const args = process.argv.slice(2);
    const dir = args.find((arg) => !arg.startsWith('--'));
    const { entries, added, changed, removed } = updateCatalog({ ...(dir ? { dir: resolve(dir) } : {}), prune: args.includes('--prune') });
    console.log(
        `bibles-catalog.json: ${entries.length} Bibles (${added.length} added, ${changed.length} changed, ${removed.length} removed)`,
    );
    for (const [label, files] of [['added', added], ['changed', changed], ['removed', removed]] as const) {
        for (const file of files) console.log(`  ${label}: ${file}`);
    }
}
