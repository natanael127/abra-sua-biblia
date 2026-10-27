import { describe, expect, it } from 'vitest';
import {
    type EbfDocument,
    findBook,
    getBookAbbreviation,
    getBookName,
    getNumOfChapters,
    isEbfDocument,
    validateEbf,
} from '../../src/core/ebf';

const ebf: EbfDocument = {
    bible: {
        name: 'Teste',
        books: [
            { names: ['João', 'Evangelho segundo João'], abbreviation: 'Jo', usfm_id: 'JHN', chapters: [{ verses: [] }] },
            { names: [], usfm_id: 'REV', chapters: [] },
        ],
    },
};

describe('findBook', () => {
    it.each(['Jo', 'jo', 'JHN', 'jhn', 'João', 'evangelho segundo joão'])('encontra por "%s"', (query) => {
        expect(findBook(ebf, query)?.usfm_id).toBe('JHN');
    });

    it('retorna undefined quando não existe', () => {
        expect(findBook(ebf, 'Mt')).toBeUndefined();
    });
});

describe('nomes do livro', () => {
    it('usa alternativas quando faltam nome e abreviação', () => {
        const [, rev] = ebf.bible.books;
        expect(getBookName(rev!)).toBe('REV');
        expect(getBookAbbreviation(rev!)).toBe('REV');
    });
});

describe('getNumOfChapters', () => {
    it('conta os capítulos ou retorna 0', () => {
        expect(getNumOfChapters(ebf, 'Jo')).toBe(1);
        expect(getNumOfChapters(ebf, 'Mt')).toBe(0);
    });
});

describe('validateEbf (schema oficial do EBF1)', () => {
    const valid = () => ({
        bible: {
            name: 'X',
            language: 'por',
            books: [
                {
                    names: ['Gênesis'],
                    abbreviation: 'Gn',
                    usfm_id: 'GEN',
                    chapters: [
                        {
                            title: 't',
                            comment: 'c',
                            verses: [
                                { text: '' },
                                { text: 'v', title: 't', comment: 'c', references: [{ usfm_id: 'GEN', chapter: 1, verse: 1 }] },
                            ],
                        },
                    ],
                },
            ],
        },
        metadata: { file_hash: 'abc' },
    });

    it('aceita documento válido, inclusive com campos opcionais e versículo vazio', () => {
        expect(validateEbf(valid())).toEqual([]);
        expect(isEbfDocument(valid())).toBe(true);
    });

    type Doc = ReturnType<typeof valid>;
    const firstBook = (d: Doc) => d.bible.books[0]!;
    const firstChapter = (d: Doc) => firstBook(d).chapters[0]!;

    it.each([null, {}, [], 'texto'])('rejeita documento sem bible: %j', (data) => {
        expect(validateEbf(data)[0]).toMatch(/^\/: /);
        expect(isEbfDocument(data)).toBe(false);
    });

    it.each<[string, (d: Doc) => void, string]>([
        ['versículo só como texto', (d) => { (firstChapter(d) as { verses: unknown[] }).verses = ['texto']; }, '/bible/books/0/chapters/0/verses/0'],
        ['sem idioma', (d) => { Reflect.deleteProperty(d.bible, 'language'); }, '/bible'],
        ['idioma ISO 639-1', (d) => { d.bible.language = 'pt'; }, '/bible/language'],
        ['usfm_id desconhecido', (d) => { firstBook(d).usfm_id = 'AAA'; }, '/bible/books/0/usfm_id'],
        ['abreviação com espaço', (d) => { firstBook(d).abbreviation = '1 Cor'; }, '/bible/books/0/abbreviation'],
        ['campo extra', (d) => { Object.assign(d.bible, { extra: 1 }); }, '/bible'],
        ['capítulo sem versículos', (d) => { firstChapter(d).verses = []; }, '/bible/books/0/chapters/0/verses'],
    ])('rejeita: %s', (_name, mutate, path) => {
        const doc = valid();
        mutate(doc);
        const errors = validateEbf(doc);
        expect(errors.some((error) => error.startsWith(`${path}: `)), errors.join('\n')).toBe(true);
        expect(isEbfDocument(doc)).toBe(false);
    });
});
