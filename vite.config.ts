import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { minify } from 'html-minifier-terser';
import { type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { escapeHtml } from './src/core/text';

const git = (args: string): string =>
    execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/**
 * Versão: hash curto (7 caracteres) do commit.
 *
 * No servidor da Vercel, vem do commit sincronizado com o git, sem "-dirty":
 * lá não há alterações locais, mas a própria Vercel modifica o vercel.json
 * durante o build e o git acusaria alterações. Nos builds locais, indica
 * "-dirty" quando há alterações não commitadas. As tags são ignoradas para
 * o resultado ser igual nos dois casos (a Vercel clona sem elas).
 */
function describeVersion(): string {
    const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA;
    if (vercelCommit) {
        return vercelCommit.slice(0, 7);
    }
    try {
        return git(`describe --always --dirty=-dirty --exclude='*' --abbrev=7`);
    } catch {
        return 'versão desconhecida';
    }
}

/** Troca %GIT_DESCRIBE% no index.html pela versão (no build e no servidor de desenvolvimento). */
function injectVersion(): Plugin {
    return {
        name: 'inject-version',
        buildStart() {
            const version = describeVersion();
            console.log(`Versão: ${version}`);
            if (version.endsWith('-dirty')) {
                console.log(`Arquivos alterados em relação ao commit:\n${git('status --porcelain')}`);
            }
        },
        transformIndexHtml: (html) => html.replace('%GIT_DESCRIBE%', escapeHtml(describeVersion())),
    };
}

/** Minifica o index.html (inclusive os scripts inline) e o manifest.json publicados. */
function minifyStaticFiles(): Plugin {
    let outDir = 'dist';
    return {
        name: 'minify-static-files',
        apply: 'build',
        configResolved(config) {
            outDir = config.build.outDir;
        },
        transformIndexHtml: {
            order: 'post',
            handler: (html) =>
                minify(html, {
                    collapseWhitespace: true,
                    removeComments: true,
                    minifyCSS: true,
                    minifyJS: true,
                }),
        },
        writeBundle() {
            const manifest = join(outDir, 'manifest.json');
            writeFileSync(manifest, JSON.stringify(JSON.parse(readFileSync(manifest, 'utf8'))));
        },
    };
}

export default defineConfig({
    build: {
        rolldownOptions: {
            // Um único arquivo JS: inclui no bundle também o que é importado sob demanda
            output: { codeSplitting: false },
        },
    },
    plugins: [
        injectVersion(),
        minifyStaticFiles(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/sw',
            filename: 'service-worker.ts',
            // Registrado em src/main.ts
            injectRegister: false,
            // O manifest é o arquivo estático public/manifest.json
            manifest: false,
            includeManifestIcons: false,
            injectManifest: {
                // As Bíblias (JSON) ficam fora do precache: são baixadas sob demanda
                globPatterns: ['**/*.{js,css,html,ico,png}'],
            },
        }),
    ],
    test: {
        include: ['tests/**/*.test.ts'],
    },
});
