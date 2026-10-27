import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** Pasta de build a testar; sem ela, gera o build de produção em dist/. Ex.: E2E_OUT_DIR=.vercel/output/static */
const OUT_DIR = process.env.E2E_OUT_DIR;
const preview = `npx vite preview --port ${PORT} --strictPort`;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    // Testa o build de produção, igual ao publicado na Vercel
    webServer: {
        command: OUT_DIR ? `${preview} --outDir ${OUT_DIR}` : `npm run build && ${preview}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
