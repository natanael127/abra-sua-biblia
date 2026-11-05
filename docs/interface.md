# Interface (Svelte)

The interface is made of [Svelte 5](https://svelte.dev) components, with runes (`$state`,
`$derived`, `$props`). The pure logic stays out of them, in plain TypeScript (`src/core/`,
`src/data/`, `src/router/`); the state shared by the components is in `.svelte.ts` modules (e.g.
`src/screens/reader/reader.svelte.ts`). The styles of the reader are global, in `src/styles/style.css`;
the newer components (main menu, Help and About pages) keep theirs in their own `<style>`.

`npm run typecheck` runs `svelte-check`, which checks the `.ts` files and the components (including
the translation keys passed to `t`). ESLint also lints the components (`eslint-plugin-svelte`),
except for the `no-unsafe-*` rules there: typescript-eslint does not know the types of imported
components, which `svelte-check` does check. The unit tests of components mount them in jsdom
(`mount` from `svelte`, e.g. `tests/ui/text-search.test.ts`).
