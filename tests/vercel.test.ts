/**
 * SPA rewrite on Vercel: the screens (/por/ave-maria/jo/3,16, /planos...) are served
 * index.html. Published files and Vite's internal paths (used by
 * `vercel dev`, where the rewrite applies before the Vite server) are excluded.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT_DIR } from './helpers';

interface VercelConfig {
    rewrites: { source: string; destination: string }[];
}

const config = JSON.parse(readFileSync(join(ROOT_DIR, 'vercel.json'), 'utf8')) as VercelConfig;
const spaRewrite = config.rewrites.find((rewrite) => rewrite.destination === '/index.html');
const isRewritten = (path: string) => new RegExp(`^${spaRewrite?.source ?? '$^'}$`).test(path);

describe('SPA rewrite (vercel.json)', () => {
    it('serves the page on every screen', () => {
        for (const path of [
            '/',
            '/por',
            '/por/ave-maria',
            '/por/ave-maria/jo/3,16',
            '/por/ave-maria/mt/5,3-12.21-38',
            '/por/ave-maria/j%C3%B3/1',
            '/upload/gen/1,1-2',
            '/planos',
            '/a/b/c/d',
        ]) {
            expect(isRewritten(path), path).toBe(true);
        }
    });

    it('does not capture files or Vite internal paths', () => {
        for (const path of [
            '/manifest.json',
            '/service-worker.js',
            '/assets/data/index.json',
            '/assets/index-abc123.js',
            '/@vite/client',
            '/@fs/home/x.ts',
            '/src/main.ts',
            '/node_modules/.vite/deps/workbox-window.js',
        ]) {
            expect(isRewritten(path), path).toBe(false);
        }
    });
});
