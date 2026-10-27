// Garante que os dados públicos (index.json e Bíblias EBF1) foram publicados
// byte a byte, sem transformação do build. Executado após `vite build`.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE = 'public/assets/data';
const OUTPUT = 'dist/assets/data';

const listFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
    );
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const problems = [];
const files = listFiles(SOURCE).filter((file) => file.endsWith('.json'));
for (const file of files) {
    const published = join(OUTPUT, relative(SOURCE, file));
    if (!existsSync(published)) {
        problems.push(`ausente: ${published}`);
    } else if (sha256(file) !== sha256(published)) {
        problems.push(`alterado: ${published}`);
    }
}

if (problems.length > 0) {
    console.error(`Dados publicados diferentes da origem:\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`check-dist: ${files.length} arquivos de dados publicados sem alteração.`);
