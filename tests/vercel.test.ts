/**
 * Rewrite da SPA na Vercel: as telas (/ave-maria/jo/3,16, /planos...) recebem
 * o index.html. Arquivos publicados e caminhos internos do Vite (usados pelo
 * `vercel dev`, em que o rewrite vale antes do servidor do Vite) ficam de fora.
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

describe('rewrite da SPA (vercel.json)', () => {
    it('entrega a página em todas as telas', () => {
        for (const path of [
            '/',
            '/ave-maria',
            '/ave-maria/jo/3,16',
            '/ave-maria/mt/5,3-12.21-38',
            '/ave-maria/j%C3%B3/1',
            '/upload/gen/1,1-2',
            '/planos',
            '/a/b/c/d',
        ]) {
            expect(isRewritten(path), path).toBe(true);
        }
    });

    it('não captura arquivos nem caminhos internos do Vite', () => {
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
