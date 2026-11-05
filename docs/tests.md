# Tests

```bash
npm run check      # typecheck + lint + unit tests
npm run test:e2e   # end-to-end tests (Playwright) against the production build
```

On the first run of the E2E tests, install the browser with `npx playwright install chromium`.

The tests read the Bibles from a local copy (`.bibles-cache/`, not versioned) that is downloaded
from the Blob store (see [Bibles](bibles.md)) and checked against the catalog: `npm test` does it
by itself and `npm run test:e2e` runs `npm run bibles:fetch` first. The first run downloads ~120 MB
(740 MB once uncompressed); the next ones only check the files. The build of the site does not need
the Bibles.
