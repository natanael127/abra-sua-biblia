import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone';
import { minify } from 'html-minifier-terser';
import { type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { writeIndex } from './scripts/build-index';
import { describePageVersion, uncommittedChanges } from './scripts/build-version';
import { escapeHtml } from './src/core/text';

/** Troca %PAGE_VERSION% no index.html pela versão (no build e no servidor de desenvolvimento). */
function injectVersion(): Plugin {
    return {
        name: 'inject-version',
        buildStart() {
            const version = describePageVersion();
            console.log(`Versão: ${version}`);
            if (version.includes('-dirty')) {
                console.log(`Arquivos alterados em relação ao commit:\n${uncommittedChanges()}`);
            }
        },
        transformIndexHtml: (html) => html.replace('%PAGE_VERSION%', escapeHtml(describePageVersion())),
    };
}

/**
 * Gera o public/assets/data/index.json (lista de Bíblias) a partir dos
 * arquivos *.ebf1.json e do settings.json, ao iniciar o build e o servidor de
 * desenvolvimento. Falha se o índice não puder ser gerado.
 */
function generateBibleIndex(): Plugin {
    return {
        name: 'generate-bible-index',
        buildStart() {
            const entries = writeIndex();
            const defaultBible = entries.find((entry) => entry.default)?.slug ?? '';
            console.log(`index.json: ${entries.length} Bíblias (padrão: ${defaultBible})`);
        },
    };
}

const EBF1_VALIDATOR_ID = 'virtual:ebf1-validator';

/**
 * Módulo virtual com o validador do schema oficial do EBF1 (pacote
 * easy-bible-format), gerado pelo ajv como código: o ajv não vai para o
 * bundle, só o validador e dois auxiliares do runtime dele.
 */
function ebf1Validator(): Plugin {
    const resolvedId = `\0${EBF1_VALIDATOR_ID}`;
    return {
        name: 'ebf1-validator',
        resolveId: (id) => (id === EBF1_VALIDATOR_ID ? resolvedId : undefined),
        load(id) {
            if (id !== resolvedId) return undefined;
            const schemaFile = fileURLToPath(import.meta.resolve('easy-bible-format/ebf1-schema.json'));
            const schema = JSON.parse(readFileSync(schemaFile, 'utf8')) as object;
            const ajv = new Ajv({ allErrors: true, strict: true, code: { source: true, esm: true } });
            // O código gerado usa require() nos auxiliares do runtime; vira import para o bundle
            const imports: string[] = [];
            const code = standaloneCode(ajv, ajv.compile(schema)).replace(/require\("([^"]+)"\)/g, (_, path: string) => {
                const name = `runtime${imports.length}`;
                imports.push(`import * as ${name} from '${path}';`);
                return name;
            });
            return `${imports.join('\n')}\n${code}`;
        },
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
        generateBibleIndex(),
        ebf1Validator(),
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
