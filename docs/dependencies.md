# Dependencies and `npm audit`

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
`vite-plugin-pwa`, and by `@sveltejs/vite-plugin-svelte`. There is no fixed version (4.3.1 is the
latest), and it only merges the build options, which are ours. That is why `npm audit` still shows
5 low-severity vulnerabilities (`deepmerge` and the four packages that depend on it). Reassess when
`workbox-build` or `@sveltejs/vite-plugin-svelte` switch dependencies.
