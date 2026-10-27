import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildIndex,
    getBibleSlug,
    getBibleType,
    readSettings,
    RESERVED_SLUGS,
    SETTINGS_FILE,
    writeIndex,
} from '../../scripts/build-index';
import { UPLOAD_SLUG } from '../../src/screens/reader/url';

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

describe('getBibleType', () => {
    it('classifica pela quantidade de livros', () => {
        expect(getBibleType(73)).toBe('catholic');
        expect(getBibleType(66)).toBe('protestant');
        expect(getBibleType(3)).toBe('other');
    });
});

describe('buildIndex', () => {
    it('lista as Bíblias em ordem de arquivo, com nome, slug, tipo e a padrão', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB', 73);
        addBible('por_acf.ebf1.json', 'Almeida Corrigida', 66);
        addBible('ignorado.json', 'Não é EBF1');
        expect(buildIndex(dataDir, { defaultBible: 'cnbb' })).toEqual([
            { name: 'Almeida Corrigida', slug: 'acf', path: 'bibles/por_acf.ebf1.json', type: 'protestant' },
            { name: 'CNBB', slug: 'cnbb', path: 'bibles/por_cnbb.ebf1.json', type: 'catholic', default: true },
        ]);
    });

    it('sem nome na Bíblia, usa o nome do arquivo', () => {
        addBible('por_teste.ebf1.json', undefined);
        expect(buildIndex(dataDir, { defaultBible: 'teste' })[0]?.name).toBe('por_teste');
    });

    it('falha se a Bíblia padrão não existe, listando os slugs', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        expect(() => buildIndex(dataDir, { defaultBible: 'ave-maria' })).toThrow(
            'a Bíblia padrão "ave-maria" não existe. Slugs: cnbb',
        );
    });

    it('falha com slug repetido ou reservado', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        addBible('eng_cnbb.ebf1.json', 'Outra');
        expect(() => buildIndex(dataDir, { defaultBible: 'cnbb' })).toThrow('slug inválido ou repetido "cnbb"');

        rmSync(join(dataDir, 'bibles/eng_cnbb.ebf1.json'));
        addBible('por_upload.ebf1.json', 'Upload');
        expect(() => buildIndex(dataDir, { defaultBible: 'cnbb' })).toThrow('slug inválido ou repetido "upload"');
    });

    it('falha com nome repetido', () => {
        addBible('por_a.ebf1.json', 'Mesma');
        addBible('por_b.ebf1.json', 'Mesma');
        expect(() => buildIndex(dataDir, { defaultBible: 'a' })).toThrow('nome repetido "Mesma"');
    });

    it('falha com JSON inválido, indicando o arquivo', () => {
        writeFileSync(join(dataDir, 'bibles/por_x.ebf1.json'), '{');
        expect(() => buildIndex(dataDir, { defaultBible: 'x' })).toThrow('bibles/por_x.ebf1.json: JSON inválido');
    });

    it('os slugs reservados incluem o do upload da tela de leitura', () => {
        expect(RESERVED_SLUGS.has(UPLOAD_SLUG)).toBe(true);
    });
});

describe('writeIndex', () => {
    it('grava o index.json com 4 espaços e quebra de linha final', () => {
        addBible('por_cnbb.ebf1.json', 'CNBB');
        writeIndex(dataDir, { defaultBible: 'cnbb' });
        const written = readFileSync(join(dataDir, 'index.json'), 'utf8');
        expect(written).toBe(`${JSON.stringify(JSON.parse(written), null, 4)}\n`);
        expect(written).toContain('\n    {\n        "name": "CNBB",');
    });
});

describe('readSettings', () => {
    it('lê o settings.json do projeto', () => {
        expect(readSettings(SETTINGS_FILE)).toEqual({ defaultBible: 'ave-maria' });
    });

    it('exige o slug da Bíblia padrão', () => {
        const file = join(dataDir, 'settings.json');
        writeFileSync(file, '{}');
        expect(() => readSettings(file)).toThrow('"defaultBible" deve ser o slug de uma Bíblia');
    });
});
