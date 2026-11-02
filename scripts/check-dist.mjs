// Checks the build in dist/, run after `vite build`:
// - the public data (index.json and EBF1 Bibles) was published byte for byte;
// - the application is bundled into one JS and one CSS file, and the HTML is minified.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const DATA_SOURCE = 'public/assets/data';
const DATA_OUTPUT = 'dist/assets/data';

const listFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
    );
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const problems = [];

const dataFiles = listFiles(DATA_SOURCE).filter((file) => file.endsWith('.json'));
for (const file of dataFiles) {
    const published = join(DATA_OUTPUT, relative(DATA_SOURCE, file));
    if (!existsSync(published)) {
        problems.push(`missing data file: ${published}`);
    } else if (sha256(file) !== sha256(published)) {
        problems.push(`modified data file: ${published}`);
    }
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
console.log(`check-dist: ${dataFiles.length} data files unchanged; 1 JS and 1 CSS; HTML minified.`);
