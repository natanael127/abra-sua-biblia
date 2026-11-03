# Abra sua Bíblia!

A website to read the Bible in the translation of your choice: https://www.abrasuabiblia.com.br

Built with TypeScript and [Vite](https://vite.dev), deployed on [Vercel](https://vercel.com).

## Language policy

All source code and documentation in this project (comments, identifiers, tests, README and any
other docs) must be written in **English**. The exceptions are the translations of the user
interface (`src/i18n/locales/`, see [Interface languages](#interface-languages)), the Bible data and
the test fixtures that depend on them, which are in Portuguese.

## Development

Requires Node.js 24.

```bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serves the production build (needed to test the service worker)
```

To reproduce the Vercel environment locally (uses `vercel.json`):

```bash
npm i -g vercel
vercel dev         # development
vercel build       # build identical to production, into .vercel/output
```

## Tests

```bash
npm run check      # typecheck + lint + unit tests
npm run test:e2e   # end-to-end tests (Playwright) against the production build
```

On the first run of the E2E tests, install the browser with `npx playwright install chromium`.

## Dependencies and `npm audit`

No production dependency has a known vulnerability (`npm audit --omit=dev`). What `npm audit`
still lists is only in the build tooling and does not ship to the site.

`package.json` pins two versions (`overrides`) because of transitive dependencies:

- `glob` ^14.0.3: `workbox-build` 7.4.1 (the latest 7.x) uses `glob` 11, which is deprecated and
  vulnerable;
- `minimatch` ^11.0.4: fixes the glob-pattern DoS (GHSA-g3hv-75wg-m249) in `eslint`,
  `typescript-eslint` and `workbox-build`.

If an update of `eslint`, `typescript-eslint` or `workbox-build` starts requiring a different
version of either, remove the override and run `npm run check` and `npm run build`.

Accepted risk: `deepmerge` 4.3.1 (prototype pollution in `mergeObject()`, low severity,
GHSA-gcqx-w48m-w2h4), used by `@rollup/plugin-node-resolve` inside `workbox-build` and
`vite-plugin-pwa`. There is no fixed version (4.3.1 is the latest), and it only merges the build
options, which are ours. That is why `npm audit` still shows 4 low-severity vulnerabilities
(`deepmerge` and the three packages that depend on it). Reassess when `workbox-build` switches
dependencies.

## Structure

```
index.html              page (Vite entry point)
settings.json           site configuration (default Bible and default interface language)
src/
  core/                 pure logic: EBF1 format, references, rendering, search, XML
  data/                 loading of the index and of the Bibles
  router/               SPA router (History API), independent of the screens
  screens/              screens; reader/ is the reading one (/{bible}/{book}/{passage})
  ui/                   theme, language combobox, modals, messages, preferences
  i18n/                 interface languages: i18next setup, detection, flags and locales/*.json
  sw/                   service worker (Workbox)
  app.ts                registration of the screens and routes
public/                 copied unchanged into the build
  assets/data/          Bibles (*.ebf1.json) and the index.json generated at build time
  assets/icons/
  manifest.json
scripts/                build-index.ts (generates index.json) and check-dist.mjs
tests/                  unit tests (Vitest)
e2e/                    end-to-end tests (Playwright)
```

## Input reference and resulting citation

The code keeps apart two ways of naming a passage, which can differ:

- **input reference**: what the user wrote, in the reference field or in a link, e.g.
  `joão 3, 18.16.17`. Its canonical form only swaps the book for the Bible's abbreviation
  (`Jo 3, 18.16.17`) and is what goes into the field, the URL and the search history;
- **resulting citation**: the compacted citation of the verses actually displayed, e.g.
  `Jo 3,16-18`. It is shown after the passage, in the page title and when sharing.

The passage is built (`src/core/passage.ts`) from the input reference and the display options
into a structure independent of the output format, which carries the resulting citation and is
then rendered (`src/core/render.ts`) as HTML for reading and as plain text for copying. See
`src/core/reference.ts` for the details.

## Interface languages

The texts of the interface are translated into 17 languages (the Bible translations are a separate
matter: any language can be read with any interface language). They use
[i18next](https://www.i18next.com), with one file per language in `src/i18n/locales/`, named by the
ISO 639-3 code (`por.json`, `eng.json`, `cmn.json`...). Portuguese is the reference: its keys type
`t()` and `tests/i18n` fail if another language lacks a key, has an empty text, changes the
placeholders (`{{count}}`) or lacks a plural form that its language uses.

The language shown is, in order of priority:

1. the one the user chose in the combobox, saved in `localStorage` (`uiLanguage`);
2. the first language of the browser (`navigator.languages`) that has a translation;
3. the default language of `settings.json` (`defaultLanguage`, below).

Texts are marked in `index.html` with `data-i18n` (text), `data-i18n-html`, `data-i18n-title`,
`data-i18n-placeholder`, `data-i18n-aria-label` and `data-i18n-content` (attributes); the ones built
by the code use `t('some.key')`. The modals are recreated in the new language when the language
changes. Arabic and Urdu are right to left: the page receives `dir="rtl"` and is mirrored, while the
Bible text keeps its own direction (`dir="auto"`).

To add a language:

1. add it to `UI_LANGUAGES` in `src/i18n/languages.ts` (ISO 639-3 code, BCP 47 tag, native name and
   direction) and keep the list alphabetical by code, which is the order of the combobox;
2. create `src/i18n/locales/<code>.json` with the same keys as `por.json`, and import it in
   `src/i18n/index.ts`;
3. add its flag in `src/i18n/flags.ts` (from [flag-icons](https://github.com/lipis/flag-icons)).

`npm run check` tells what is missing. The page title, `<meta>` tags for link previews and
`manifest.json` are static, in Portuguese; only `<title>` and the `description` change with the
language.

## Bibles

The Bibles live in `public/assets/data/bibles` in the
[Easy Bible Format (EBF1)](https://github.com/natanael127/easy-bible-format) and are published
exactly as they are in the repository, so that they can be downloaded and used in other projects:

- the tests validate all of them against the official schema (`ebf1-schema.json`), which comes
  from the format's repository as an npm dependency pinned to a commit (`easy-bible-format` in
  `package.json`). To update the schema, change the commit hash and run `npm install`;
- `scripts/check-dist.mjs` runs at the end of every build and fails if any published file differs
  from its source.

To add a Bible, just drop the `.ebf1.json` file into `public/assets/data/bibles`.
The index (`public/assets/data/index.json`, not in git) is generated by `scripts/build-index.ts`
on every `npm run build` and `npm run dev`: name, type (Catholic/Protestant, by the number of
books), language (ISO 639-3) and URL slug, all taken from the file name (`por_ave_maria.ebf1.json`
→ `/por/ave-maria`, which opens at `/por/ave-maria/jo/3,16`). The file name must start with the
language. The build fails if a name is repeated or if a slug is repeated within the same language.

The Bible opened on the first visit is set in `settings.json`, by language and slug (`defaultBible`).

The interface language used when the user has not chosen one and the browser's has no translation
is also set in `settings.json`, by the ISO 639-3 code of one of the interface languages. The build
fails if it is not one of them:

```json
{
    "defaultBible": "por/ave-maria",
    "defaultLanguage": "por"
}
```
