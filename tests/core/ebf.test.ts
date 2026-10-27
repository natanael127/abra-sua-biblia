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

describe('validateEbf', () => {
    it('aceita documento válido, inclusive com campos opcionais', () => {
        const doc = {
            bible: {
                name: 'X',
                language: 'pt',
                books: [
                    {
                        names: ['A'],
                        abbreviation: 'A',
                        usfm_id: 'AAA',
                        chapters: [
                            {
                                title: 't',
                                comment: 'c',
                                verses: [
                                    'texto',
                                    { text: 'v', title: 't', comment: 'c', references: [{ usfm_id: 'GEN', chapter: 1, verse: 1 }] },
                                ],
                            },
                        ],
                    },
                ],
            },
            metadata: { file_hash: 'abc' },
        };
        expect(validateEbf(doc)).toEqual([]);
        expect(isEbfDocument(doc)).toBe(true);
    });

    it.each([
        [null, 'bible: objeto ausente'],
        [[], 'bible: objeto ausente'],
        [{ bible: { books: [] } }, 'bible.name: deve ser texto'],
        [{ bible: { name: 'x' } }, 'bible.books: deve ser lista'],
        [{ bible: { name: 'x', books: [{ names: 'A', chapters: [] }] } }, 'bible.books[0].names: deve ser lista de textos'],
        [{ bible: { name: 'x', books: [{ names: [], chapters: [{}] }] } }, 'bible.books[0].chapters[0].verses: deve ser lista'],
        [
            { bible: { name: 'x', books: [{ names: [], chapters: [{ verses: [{ title: 'a' }] }] }] } },
            'bible.books[0].chapters[0].verses[0].text: deve ser texto',
        ],
        [
            { bible: { name: 'x', books: [{ names: [], chapters: [{ verses: [{ text: 'a', references: [{}] }] }] }] } },
            'bible.books[0].chapters[0].verses[0].references: deve ser lista de {usfm_id, chapter, verse}',
        ],
    ])('rejeita %j', (data, error) => {
        expect(validateEbf(data)).toContain(error);
        expect(isEbfDocument(data)).toBe(false);
    });
});
