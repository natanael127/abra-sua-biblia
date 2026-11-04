import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CatalogEntry, sha256 } from '../../scripts/catalog';
import { fetchBibles } from '../../scripts/fetch-bibles';

const BASE = 'https://store.example.com';
const files: Record<string, string> = { 'a.ebf1.json': '{"a":1}', 'b.ebf1.json': '{"b":22}' };
const catalog: CatalogEntry[] = Object.entries(files).map(([file, text]) => ({
    file,
    name: file,
    language: 'por',
    slug: file[0]!,
    type: 'other',
    size: Buffer.byteLength(text),
    sha256: sha256(Buffer.from(text)),
}));

let cacheDir: string;
let remote: Record<string, string>;
let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'fetch-bibles-'));
    remote = { ...files };
    fetchFn = vi.fn<typeof fetch>((input) => {
        const file = (input as string).replace(`${BASE}/`, '');
        const body = remote[file];
        return Promise.resolve(
            body === undefined ? new Response('', { status: 404, statusText: 'Not Found' }) : new Response(body),
        );
    });
});

afterEach(() => {
    rmSync(cacheDir, { recursive: true });
});

const run = () => fetchBibles({ catalog, baseUrl: BASE, cacheDir, fetchFn });

describe('fetchBibles', () => {
    it('downloads the Bibles from the Blob store into the folder', async () => {
        expect((await run()).sort()).toEqual(['a.ebf1.json', 'b.ebf1.json']);
        expect(readFileSync(join(cacheDir, 'a.ebf1.json'), 'utf8')).toBe(files['a.ebf1.json']);
        expect(fetchFn).toHaveBeenCalledWith(`${BASE}/a.ebf1.json`);
    });

    it('does not download again what is already there and matches', async () => {
        await run();
        fetchFn.mockClear();
        expect(await run()).toEqual([]);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('downloads again a file that was changed locally', async () => {
        await run();
        writeFileSync(join(cacheDir, 'a.ebf1.json'), '{"a":2}');
        expect(await run()).toEqual(['a.ebf1.json']);
        expect(readFileSync(join(cacheDir, 'a.ebf1.json'), 'utf8')).toBe(files['a.ebf1.json']);
    });

    it('fails, without keeping the file, if the Blob store has a different version', async () => {
        remote['b.ebf1.json'] = '{"b":99}';
        await expect(run()).rejects.toThrow('b.ebf1.json: the file in the Blob store does not match bibles-catalog.json');
        expect(existsSync(join(cacheDir, 'b.ebf1.json'))).toBe(false);
        expect(readdirSync(cacheDir).filter((name) => name.endsWith('.part'))).toEqual([]);
    });

    it('fails naming the file that is missing from the Blob store', async () => {
        delete remote['a.ebf1.json'];
        await expect(run()).rejects.toThrow('a.ebf1.json: download failed (404 Not Found)');
    });
});
