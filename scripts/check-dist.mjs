// Checks the build in dist/, run after `vite build`:
// - the only public data is index.json: the Bibles stay in the Blob store and never ship with the site;
// - the application is bundled into one JS and one CSS file, and the HTML is minified.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_OUTPUT = 'dist/assets/data';

const listFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
    );

const problems = [];

const dataFiles = existsSync(DATA_OUTPUT) ? listFiles(DATA_OUTPUT) : [];
if (!dataFiles.includes(join(DATA_OUTPUT, 'index.json'))) {
    problems.push(`missing data file: ${join(DATA_OUTPUT, 'index.json')}`);
}
for (const file of dataFiles.filter((file) => !file.endsWith('index.json'))) {
    problems.push(`unexpected data file (the Bibles must not be published by the site): ${file}`);
}

const bundles = readdirSync('dist/assets').filter((file) => /\.(js|css)$/.test(file));
for (const extension of ['js', 'css']) {
    const count = bundles.filter((file) => file.endsWith(`.${extension}`)).length;
    if (count !== 1) {
        problems.push(`expected 1 .${extension} file in dist/assets, found ${count}`);
    }
}

const html = readFileSync('dist/index.html', 'utf8');
if (html.includes('<!--') || html.trim().split('\n').length > 1) {
    problems.push('dist/index.html is not minified');
}

if (problems.length > 0) {
    console.error(`Build problems:\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log('check-dist: index.json only (no Bibles); 1 JS and 1 CSS; HTML minified.');
