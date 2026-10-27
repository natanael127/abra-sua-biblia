import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'dev-dist', 'node_modules', 'public', 'coverage', 'playwright-report', 'test-results'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
            globals: { ...globals.browser },
        },
        rules: {
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
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
