# Bibles

The Bibles are in the [Easy Bible Format (EBF1)](https://github.com/natanael127/easy-bible-format),
published exactly as they are so that they can be downloaded and used in other projects. They are
**not in this repository and not in the deploy**: they live in a public
[Vercel Blob](https://vercel.com/docs/vercel-blob) store (`biblesUrl` in `settings.json`), one file
per Bible at the root of the store, named as in the catalog (`por_ave_maria.ebf1.json`). The browser
fetches the Bible that the reader opens straight from there (the store allows CORS and sets
`Cache-Control`), and the service worker caches it like the rest of the site.

`bibles-catalog.json` (versioned) is the list of the Bibles that the site offers. For each one it
has the file name, `name`, `language` (ISO 639-3), `slug` (the URL identifier), type
(Catholic/Protestant, by the number of books), size and SHA-256. All of it, except the file name,
comes from the content of the file (`bible.name`, `bible.language`, `bible.slug`, number of
`bible.books`), never from its name. The `slug` is optional in the EBF1 schema but required here
(`"language": "por", "slug": "ave-maria"` → `/por/ave-maria`, which opens at
`/por/ave-maria/jhn/3,16`). The catalog script fails if any of the three is missing, if a name is
repeated or if a slug is repeated within the same language.

On every `npm run build` and `npm run dev`, `scripts/build-index.ts` generates
`public/assets/data/index.json` (not in git) from the catalog and `settings.json`, with the `url` of
each Bible in the store, followed by `?v=` and the start of the SHA-256: the store ignores the query,
but it makes the browser fetch the Bible again when it changes. `scripts/check-dist.mjs` runs at the
end of every build and fails if anything but `index.json` ended up in `dist/assets/data`.

The tests validate every Bible against the official schema (`ebf1-schema.json`), which comes from the
format's repository as an npm dependency pinned to a commit (`easy-bible-format` in `package.json`).
To update the schema, change the commit hash and run `npm install`.

To add, change or remove a Bible:

1. `npm run bibles:fetch` brings the local copy (`.bibles-cache/`) up to date;
2. put the `.ebf1.json` file there, or change or delete it. The file name does not matter to the
   site, but keep it unique;
3. upload it to the store with the same name and **without a random suffix** (Vercel dashboard,
   Vercel CLI or `@vercel/blob`; an existing file has to be overwritten);
4. `npm run bibles:catalog` regenerates `bibles-catalog.json` from the local copy (`--prune` accepts
   Bibles that were deleted on purpose) and tells what was added, changed or removed;
5. commit the catalog. To check that the store has exactly what the catalog says, delete
   `.bibles-cache/` and run `npm run bibles:fetch`: it fails if any file differs.

The Bible opened on the first visit is set in `settings.json`, by language and slug (`defaultBible`).

The interface language used when the user has not chosen one and the browser's has no translation
is also set in `settings.json`, by the ISO 639-3 code of one of the interface languages. The build
fails if it is not one of them. `biblesUrl` is the https URL of the Blob store, without the trailing
slash:

```json
{
    "defaultBible": "por/ave-maria",
    "defaultLanguage": "por",
    "biblesUrl": "https://<store>.public.blob.vercel-storage.com"
}
```
