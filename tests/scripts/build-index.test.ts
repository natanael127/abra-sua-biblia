import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildIndex,
    getBibleLanguage,
    getBibleSlug,
    getBibleType,
    readSettings,
    SETTINGS_FILE,
    writeIndex,
} from '../../scripts/build-index';

let dataDir: string;

/** Cria uma Bíblia mínima com o nome e a quantidade de livros informados. */
function addBible(file: string, name: string | undefined, books = 1) {
    const book = { names: ['Livro'], chapters: [{ verses: ['texto'] }] };
    writeFileSync(join(dataDir, 'bibles', file), JSON.stringify({ bible: { name, books: Array(books).fill(book) } }));
}

beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'build-index-'));
    mkdirSync(join(dataDir, 'bibles'));
});

afterEach(() => {
    rmSync(dataDir, { recursive: true });
});

describe('getBibleSlug', () => {
    it.each([
        ['por_ave_maria', 'ave-maria'],
        ['por_pe_matos_soares', 'pe-matos-soares'],
        ['por_aa', 'aa'],
        ['eng_KJV_1611', 'kjv-1611'],
        ['minha biblia', 'minha-biblia'],
        ['_x_', 'x'],
    ])('%s -> %s', (id, slug) => {
        expect(getBibleSlug(id)).toBe(slug);
    });
});

describe('getBibleLanguage', () => {
    it('lê o prefixo ISO 639-3 do nome do arquivo', () => {
        expect(getBibleLanguage('por_ave_maria')).toBe('por');
        expect(getBibleLanguage('ENG_KJV')).toBe('eng');
        expect(getBibleLanguage('minha_biblia')).toBeUndefined();
        expect(getBibleLanguage('portugues_x')).toBeUndefined();
    });
});

describe('getBibleType', () => {
    it('classifica pela quantidade de livros', () => {
        expect(getBibleType(73)).toBe('catholic');
        expect(getBibleType(66)).toBe('protestant');
        expect(getBibleType(3)).toBe('other');
    });
});

describe('buildIndex', () => {
    it('lista as Bíblias em ordem de arquivo, com nome, idioma, slug, tipo e a padrão', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB', 73);
        addBible('por_acf.ebf1.json', 'Almeida Corrigida', 66);
        addBible('ignorado.json', 'Não é EBF1');
        expect(buildIndex(dataDir, { defaultBible: 'por/cnbb' })).toEqual([
            {
                name: 'Almeida Corrigida',
                language: 'por',
                slug: 'acf',
                path: 'bibles/por_acf.ebf1.json',
                type: 'protestant',
            },
            {
                name: 'CNBB',
                language: 'por',
                slug: 'cnbb',
                path: 'bibles/por_cnbb.ebf1.json',
                type: 'catholic',
                default: true,
            },
        ]);
    });

    it('sem nome na Bíblia, usa o nome do arquivo', () => {
        addBible('por_teste.ebf1.json', undefined);
        expect(buildIndex(dataDir, { defaultBible: 'por/teste' })[0]?.name).toBe('por_teste');
    });

    it('o mesmo slug pode existir em idiomas diferentes', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        addBible('eng_cnbb.ebf1.json', 'Outra');
        const entries = buildIndex(dataDir, { defaultBible: 'eng/cnbb' });
        expect(entries.map((entry) => [entry.language, entry.slug, entry.default])).toEqual([
            ['eng', 'cnbb', true],
            ['por', 'cnbb', undefined],
        ]);
    });

    it('falha se a Bíblia padrão não existe, listando as Bíblias', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/ave-maria' })).toThrow(
            'a Bíblia padrão "por/ave-maria" não existe. Bíblias: por/cnbb',
        );
        expect(() => buildIndex(dataDir, { defaultBible: 'cnbb' })).toThrow('a Bíblia padrão "cnbb" não existe');
    });

    it('falha com slug repetido no idioma ou vazio', () => {
        addBible('por_a_b.ebf1.json', 'A');
        addBible('por_a-b.ebf1.json', 'B');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a-b' })).toThrow('slug inválido ou repetido "por/a-b"');

        rmSync(join(dataDir, 'bibles/por_a-b.ebf1.json'));
        addBible('por_.ebf1.json', 'Vazio');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a-b' })).toThrow('slug inválido ou repetido "por/"');
    });

    it('falha se o nome do arquivo não começa pelo idioma', () => {
        addBible('cnbb.ebf1.json', 'CNBB');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/cnbb' })).toThrow(
            'bibles/cnbb.ebf1.json: o nome do arquivo deve começar pelo idioma ISO 639-3',
        );
    });

    it('falha com nome repetido', () => {
        addBible('por_a.ebf1.json', 'Mesma');
        addBible('por_b.ebf1.json', 'Mesma');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/a' })).toThrow('nome repetido "Mesma"');
    });

    it('falha com JSON inválido, indicando o arquivo', () => {
        writeFileSync(join(dataDir, 'bibles/por_x.ebf1.json'), '{');
        expect(() => buildIndex(dataDir, { defaultBible: 'por/x' })).toThrow('bibles/por_x.ebf1.json: JSON inválido');
    });
});

describe('writeIndex', () => {
    it('grava o index.json com 4 espaços e quebra de linha final', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        writeIndex(dataDir, { defaultBible: 'por/cnbb' });
        const written = readFileSync(join(dataDir, 'index.json'), 'utf8');
        expect(written).toBe(`${JSON.stringify(JSON.parse(written), null, 4)}\n`);
        expect(written).toContain('\n    {\n        "name": "CNBB",');
    });
});

describe('readSettings', () => {
    it('lê o settings.json do projeto', () => {
        expect(readSettings(SETTINGS_FILE)).toEqual({ defaultBible: 'por/ave-maria' });
    });

    it('exige o slug da Bíblia padrão', () => {
        const file = join(dataDir, 'settings.json');
        writeFileSync(file, '{}');
        expect(() => readSettings(file)).toThrow('"defaultBible" deve ser o idioma e o slug de uma Bíblia');
    });
});
