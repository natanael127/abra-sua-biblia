import { describe, expect, it } from 'vitest';
import {
    type EbfDocument,
    findBook,
    findBookByUrlId,
    getBookAbbreviation,
    getBookUrlId,
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
    it.each(['Jo', 'jo', 'JHN', 'jhn', 'João', 'evangelho segundo joão'])('finds by "%s"', (query) => {
        expect(findBook(ebf, query)?.usfm_id).toBe('JHN');
    });

    it('returns undefined when it does not exist', () => {
        expect(findBook(ebf, 'Mt')).toBeUndefined();
    });
});

describe('book in URLs', () => {
    // An abbreviation of one book that is the USFM id of another (as "Jud" in English Bibles)
    const collision: EbfDocument = {
        bible: {
            name: 'Test',
            books: [
                { names: ['Judges'], abbreviation: 'Jud', usfm_id: 'JDG', chapters: [] },
                { names: ['Jude'], abbreviation: 'Jude', usfm_id: 'JUD', chapters: [] },
                { names: ['Psalms'], abbreviation: 'Ps', chapters: [] },
            ],
        },
    };

    it('is identified by the USFM id, or by the abbreviation without one', () => {
        expect(getBookUrlId(ebf.bible.books[0]!)).toBe('JHN');
        expect(getBookUrlId(collision.bible.books[2]!)).toBe('Ps');
    });

    it('is found by USFM id first', () => {
        expect(findBookByUrlId(collision, 'jud')?.names[0]).toBe('Jude');
        expect(findBook(collision, 'jud')?.names[0]).toBe('Judges');
    });

    it('falls back to abbreviation and name', () => {
        expect(findBookByUrlId(collision, 'ps')?.names[0]).toBe('Psalms');
        expect(findBookByUrlId(ebf, 'joão')?.usfm_id).toBe('JHN');
        expect(findBookByUrlId(ebf, 'mt')).toBeUndefined();
    });
});

describe('book names', () => {
    it('uses fallbacks when name and abbreviation are missing', () => {
        const [, rev] = ebf.bible.books;
        expect(getBookName(rev!)).toBe('REV');
        expect(getBookAbbreviation(rev!)).toBe('REV');
    });
});

describe('getNumOfChapters', () => {
    it('counts the chapters or returns 0', () => {
        expect(getNumOfChapters(ebf, 'Jo')).toBe(1);
        expect(getNumOfChapters(ebf, 'Mt')).toBe(0);
    });
});

describe('validateEbf (official EBF1 schema)', () => {
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

    it('accepts a valid document, including optional fields and an empty verse', () => {
        expect(validateEbf(valid())).toEqual([]);
        expect(isEbfDocument(valid())).toBe(true);
    });

    type Doc = ReturnType<typeof valid>;
    const firstBook = (d: Doc) => d.bible.books[0]!;
    const firstChapter = (d: Doc) => firstBook(d).chapters[0]!;

    it.each([null, {}, [], 'texto'])('rejects a document without bible: %j', (data) => {
        expect(validateEbf(data)[0]).toMatch(/^\/: /);
        expect(isEbfDocument(data)).toBe(false);
    });

    it.each<[string, (d: Doc) => void, string]>([
        ['verse as plain text', (d) => { (firstChapter(d) as { verses: unknown[] }).verses = ['texto']; }, '/bible/books/0/chapters/0/verses/0'],
        ['no language', (d) => { Reflect.deleteProperty(d.bible, 'language'); }, '/bible'],
        ['ISO 639-1 language', (d) => { d.bible.language = 'pt'; }, '/bible/language'],
        ['unknown usfm_id', (d) => { firstBook(d).usfm_id = 'AAA'; }, '/bible/books/0/usfm_id'],
        ['abbreviation with a space', (d) => { firstBook(d).abbreviation = '1 Cor'; }, '/bible/books/0/abbreviation'],
        ['extra field', (d) => { Object.assign(d.bible, { extra: 1 }); }, '/bible'],
        ['chapter without verses', (d) => { firstChapter(d).verses = []; }, '/bible/books/0/chapters/0/verses'],
    ])('rejects: %s', (_name, mutate, path) => {
        const doc = valid();
        mutate(doc);
        const errors = validateEbf(doc);
        expect(errors.some((error) => error.startsWith(`${path}: `)), errors.join('\n')).toBe(true);
        expect(isEbfDocument(doc)).toBe(false);
    });
});
