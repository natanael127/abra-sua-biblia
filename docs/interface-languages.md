# Interface languages

The texts of the interface are translated into 17 languages, which are also the languages of the
Bibles: the list of translations only offers the ones in the interface language (plus the one
currently open, if it is of another language, since a link may open any Bible and changing the
interface language does not disturb the reading). They use
[i18next](https://www.i18next.com), with one file per language in `src/i18n/locales/`, named by the
ISO 639-3 code (`por.json`, `eng.json`, `zho.json`...). Portuguese is the reference: its keys type
`t()` and `tests/i18n` fail if another language lacks a key, has an empty text, changes the
placeholders (`{{count}}`) or lacks a plural form that its language uses.

The language shown is, in order of priority:

1. the one the user chose in the combobox, saved in `localStorage` (`uiLanguage`);
2. the first language of the browser (`navigator.languages`) that has a translation;
3. the default language of `settings.json` (`defaultLanguage`, below).

The components use `t('some.key')` from `src/i18n/reactive.svelte.ts`, which makes them render
again in the new language when it changes (the pure logic uses `t` from `src/i18n`). The few texts
of `index.html` (title, `<meta>` tags) are marked with `data-i18n` (text), `data-i18n-html`,
`data-i18n-title`, `data-i18n-placeholder`, `data-i18n-aria-label` and `data-i18n-content`
(attributes). Arabic and Urdu are right to left: the page receives `dir="rtl"` and is mirrored, while the
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
