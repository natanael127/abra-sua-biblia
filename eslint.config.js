import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
    { ignores: ['dist', '.vercel', 'dev-dist', '.svelte-check', 'node_modules', 'public', 'coverage', 'playwright-report', 'test-results'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...svelte.configs.recommended,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname, extraFileExtensions: ['.svelte'] },
            globals: { ...globals.browser },
        },
        rules: {
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        },
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: { parser: tseslint.parser, svelteConfig },
        },
    },
    {
        files: ['**/*.svelte'],
        rules: {
            // typescript-eslint does not know the types of the imported components (they come out as `any`);
            // svelte-check, in the typecheck, checks them
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            // TypeScript already reports undefined names (and knows the globals of vite-env.d.ts)
            'no-undef': 'off',
        },
    },
    {
        files: ['*.js', '*.mjs', 'scripts/**'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        files: ['tests/**', 'e2e/**', '*.ts'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
);
