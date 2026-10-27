// Verifica o build em dist/, executado após `vite build`:
// - os dados públicos (index.json e Bíblias EBF1) foram publicados byte a byte;
// - a aplicação está agrupada em um JS e um CSS, e o HTML está minificado.
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
        problems.push(`dado ausente: ${published}`);
    } else if (sha256(file) !== sha256(published)) {
        problems.push(`dado alterado: ${published}`);
    }
}

const bundles = readdirSync('dist/assets').filter((file) => /\.(js|css)$/.test(file));
for (const extension of ['js', 'css']) {
    const count = bundles.filter((file) => file.endsWith(`.${extension}`)).length;
    if (count !== 1) {
        problems.push(`esperado 1 arquivo .${extension} em dist/assets, encontrados ${count}`);
    }
}

const html = readFileSync('dist/index.html', 'utf8');
if (html.includes('<!--') || html.trim().split('\n').length > 1) {
    problems.push('dist/index.html não está minificado');
}

if (problems.length > 0) {
    console.error(`Problemas no build:\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`check-dist: ${dataFiles.length} arquivos de dados sem alteração; 1 JS e 1 CSS; HTML minificado.`);
