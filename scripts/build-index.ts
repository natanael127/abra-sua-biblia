/**
 * Gera o public/assets/data/index.json a partir das Bíblias (*.ebf1.json) e
 * do settings.json. Executado pelo Vite ao iniciar (dev e build); o arquivo
 * gerado não é versionado.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dirname, '..');
/** Pasta de dados publicada pelo site (onde ficam o index.json e as Bíblias). */
export const DATA_DIR = join(ROOT_DIR, 'public/assets/data');
export const SETTINGS_FILE = join(ROOT_DIR, 'settings.json');

/** Pastas, relativas a DATA_DIR, com as Bíblias. */
const BIBLE_DIRECTORIES = ['bibles'];
const BIBLE_FILE_SUFFIX = '.ebf1.json';

/** Slugs que não podem identificar Bíblias, porque são caminhos usados pelo site. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(['upload', 'assets']);

/** Quantidade de livros por tipo de Bíblia. */
const BIBLE_TYPE_BOOKS = {
    catholic: 73, // 46 AT + 27 NT (inclui deuterocanônicos)
    protestant: 66, // 39 AT + 27 NT
} as const;

export type BibleType = keyof typeof BIBLE_TYPE_BOOKS | 'other';

export interface IndexEntry {
    name: string;
    slug: string;
    /** Caminho relativo a DATA_DIR, ex.: "bibles/por_ave_maria.ebf1.json". */
    path: string;
    type: BibleType;
    default?: true;
}

export interface Settings {
    /** Slug da Bíblia aberta na primeira visita, ex.: "ave-maria". */
    defaultBible: string;
}

export function readSettings(file = SETTINGS_FILE): Settings {
    const settings = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>;
    if (typeof settings.defaultBible !== 'string' || !settings.defaultBible) {
        throw new Error(`${file}: "defaultBible" deve ser o slug de uma Bíblia, ex.: "ave-maria"`);
    }
    return { defaultBible: settings.defaultBible };
}

export function getBibleType(numBooks: number): BibleType {
    for (const [type, books] of Object.entries(BIBLE_TYPE_BOOKS)) {
        if (numBooks === books) return type as BibleType;
    }
    return 'other';
}

/**
 * Identificador da Bíblia na URL (ex.: /ave-maria/jo/3,16), a partir do nome
 * do arquivo sem o prefixo de idioma ISO 639-3: "por_ave_maria" -> "ave-maria".
 */
export function getBibleSlug(bibleId: string): string {
    return bibleId
        .toLowerCase()
        .replace(/^[a-z]{3}_/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

interface BibleFile {
    bible?: { name?: unknown; books?: unknown[] };
}

/** Monta o índice; lança erro com a causa se algo impedir um índice válido. */
export function buildIndex(dataDir = DATA_DIR, settings: Settings = readSettings()): IndexEntry[] {
    const entries: IndexEntry[] = [];

    for (const directory of BIBLE_DIRECTORIES) {
        const files = readdirSync(join(dataDir, directory))
            .filter((file) => file.endsWith(BIBLE_FILE_SUFFIX))
            .sort();
        for (const file of files) {
            const path = `${directory}/${file}`;
            let data: BibleFile;
            try {
                data = JSON.parse(readFileSync(join(dataDir, path), 'utf8')) as BibleFile;
            } catch (error) {
                throw new Error(`${path}: JSON inválido`, { cause: error });
            }
            const bibleId = file.slice(0, -BIBLE_FILE_SUFFIX.length);
            const name = typeof data.bible?.name === 'string' && data.bible.name ? data.bible.name : bibleId;
            entries.push({
                name,
                slug: getBibleSlug(bibleId),
                path,
                type: getBibleType(data.bible?.books?.length ?? 0),
            });
        }
    }

    // O nome aparece na lista de traduções e o slug identifica a Bíblia na URL
    const names = new Set<string>();
    const slugs = new Set<string>();
    for (const entry of entries) {
        if (names.has(entry.name)) throw new Error(`${entry.path}: nome repetido "${entry.name}"`);
        if (!entry.slug || RESERVED_SLUGS.has(entry.slug) || slugs.has(entry.slug)) {
            throw new Error(`${entry.path}: slug inválido ou repetido "${entry.slug}"`);
        }
        names.add(entry.name);
        slugs.add(entry.slug);
    }

    const defaultEntry = entries.find((entry) => entry.slug === settings.defaultBible);
    if (!defaultEntry) {
        throw new Error(
            `settings.json: a Bíblia padrão "${settings.defaultBible}" não existe. Slugs: ${[...slugs].join(', ')}`,
        );
    }
    defaultEntry.default = true;

    return entries;
}

/** Gera e grava o index.json; devolve o índice gerado. */
export function writeIndex(dataDir = DATA_DIR, settings: Settings = readSettings()): IndexEntry[] {
    const entries = buildIndex(dataDir, settings);
    writeFileSync(join(dataDir, 'index.json'), `${JSON.stringify(entries, null, 4)}\n`);
    return entries;
}
