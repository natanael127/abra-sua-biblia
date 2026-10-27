import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { minify } from 'html-minifier-terser';
import { type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

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
