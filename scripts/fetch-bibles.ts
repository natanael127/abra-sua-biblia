/**
 * Downloads the Bibles of the catalog from the Blob store into the local copy (CACHE_DIR), checking
 * the size and SHA-256 of every file against the catalog. Files that are already there and match
 * are not downloaded again. The tests (unit and E2E) read the Bibles from this copy; the build of
 * the site does not need it.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, type CatalogEntry, readCatalog, sha256 } from './catalog.ts';
import { readSettings } from './build-index.ts';

export interface FetchOptions {
    catalog?: readonly CatalogEntry[];
    /** URL of the Blob store, without the trailing slash. */
    baseUrl?: string;
    cacheDir?: string;
    fetchFn?: typeof fetch;
    concurrency?: number;
    log?: (message: string) => void;
}

/** Whether the local copy of the Bible is there and identical to the catalog. */
function isUpToDate(path: string, entry: CatalogEntry): boolean {
    try {
        return statSync(path).size === entry.size && sha256(readFileSync(path)) === entry.sha256;
    } catch {
        return false;
    }
}

async function download(entry: CatalogEntry, baseUrl: string, path: string, fetchFn: typeof fetch): Promise<void> {
    const response = await fetchFn(`${baseUrl}/${entry.file}`);
    if (!response.ok) {
        throw new Error(`${entry.file}: download failed (${response.status} ${response.statusText})`);
    }
    const content = Buffer.from(await response.arrayBuffer());
    if (content.length !== entry.size || sha256(content) !== entry.sha256) {
        throw new Error(`${entry.file}: the file in the Blob store does not match bibles-catalog.json (size or SHA-256)`);
    }
    const temporary = `${path}.part`;
    writeFileSync(temporary, content);
    renameSync(temporary, path);
}

/** Brings the local copy up to date; returns the names of the downloaded files. */
export async function fetchBibles({
    catalog = readCatalog(),
    baseUrl = readSettings().biblesUrl,
    cacheDir = CACHE_DIR,
    fetchFn = fetch,
    concurrency = 6,
    log = () => undefined,
}: FetchOptions = {}): Promise<string[]> {
    mkdirSync(cacheDir, { recursive: true });
    const pending = catalog.filter((entry) => !isUpToDate(join(cacheDir, entry.file), entry));
    const downloaded: string[] = [];
    if (pending.length > 0) log(`Downloading ${pending.length} of ${catalog.length} Bibles from ${baseUrl}`);

    const queue = [...pending];
    const errors: Error[] = [];
    const worker = async () => {
        for (let entry = queue.shift(); entry; entry = queue.shift()) {
            const path = join(cacheDir, entry.file);
            try {
                await download(entry, baseUrl, path, fetchFn);
                downloaded.push(entry.file);
            } catch (error) {
                rmSync(`${path}.part`, { force: true });
                errors.push(error as Error);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

    if (errors.length > 0) {
        throw new Error(`${errors.length} Bible(s) failed:\n  ${errors.map((error) => error.message).join('\n  ')}`);
    }
    return downloaded;
}

// CLI: node scripts/fetch-bibles.ts
if (process.argv[1] === import.meta.filename) {
    const downloaded = await fetchBibles({ log: console.log });
    console.log(`fetch-bibles: ${readCatalog().length} Bibles up to date (${downloaded.length} downloaded)`);
}
