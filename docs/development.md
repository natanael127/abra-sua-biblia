# Development

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
