import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [
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
