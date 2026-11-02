import { describe, expect, it } from 'vitest';
import { matchPath } from '../../src/router/path';
import { parseLegacyLink, parseReaderParams, READER_PATTERN, readerPath, referenceFromPath, UPLOAD_KEY } from '../../src/screens/reader/url';

describe('readerPath', () => {
    it('uses the book in lowercase and the passage in the reference notation', () => {
        expect(readerPath('por/ave-maria', 'Mt 5,3-12.21-38')).toBe('/por/ave-maria/mt/5,3-12.21-38');
        expect(readerPath('por/ave-maria', '1Cor 13')).toBe('/por/ave-maria/1cor/13');
        expect(readerPath('por/cnbb', 'Êx 20,1-17')).toBe('/por/cnbb/%C3%AAx/20,1-17');
        expect(readerPath(UPLOAD_KEY, 'Gn 1,1-2')).toBe('/upload/gn/1,1-2');
    });

    it('without a complete reference, points only to the Bible', () => {
        expect(readerPath('por/ave-maria')).toBe('/por/ave-maria');
        expect(readerPath('por/ave-maria', null)).toBe('/por/ave-maria');
        expect(readerPath('por/ave-maria', '  ')).toBe('/por/ave-maria');
        expect(readerPath('por/ave-maria', 'Mt')).toBe('/por/ave-maria');
        expect(readerPath('por/ave-maria', ' Mt  ')).toBe('/por/ave-maria');
        expect(readerPath(UPLOAD_KEY)).toBe('/upload');
    });
});

describe('parseReaderParams', () => {
    const parse = (path: string) => parseReaderParams(matchPath(READER_PATTERN, path)!);

    it('reads language, Bible, book and passage', () => {
        expect(parse('/por/Ave-Maria/mt/5,3-12')).toEqual({ bibleKey: 'por/ave-maria', book: 'mt', passage: '5,3-12' });
        expect(parse('/POR/ave-maria')).toEqual({ bibleKey: 'por/ave-maria', book: undefined, passage: undefined });
    });

    it('the language alone does not identify the Bible', () => {
        expect(parse('/por')).toEqual({ language: 'por' });
        expect(parse('/')).toEqual({ language: undefined });
    });

    it('an upload has no language: the book and passage come right after', () => {
        expect(parse('/upload/gen/1,1-2')).toEqual({ bibleKey: UPLOAD_KEY, book: 'gen', passage: '1,1-2' });
        expect(parse('/upload')).toEqual({ bibleKey: UPLOAD_KEY, book: undefined, passage: undefined });
    });
});

describe('referenceFromPath', () => {
    it('builds the reference from the URL parameters', () => {
        expect(referenceFromPath('mt', '5,3-12')).toBe('mt 5,3-12');
        expect(referenceFromPath()).toBe('');
    });

    it('a book alone opens chapter 1', () => {
        expect(referenceFromPath('mt')).toBe('mt 1');
    });

    it('a round trip through the URL preserves the reference', () => {
        for (const reference of ['Mt 5,3-12.21-38', 'Jo 3', 'Sl 119,1-', 'Êx 20,1.3.5-7']) {
            const target = parseReaderParams(matchPath(READER_PATTERN, readerPath('por/ave-maria', reference))!);
            expect(referenceFromPath(target.book, target.passage)).toBe(reference.toLowerCase());
        }
    });
});

describe('parseLegacyLink', () => {
    it('reads the links from the previous version', () => {
        expect(parseLegacyLink('?bible=Ave-Maria&quote=Jo%203%2C16')).toEqual({ bible: 'Ave-Maria', reference: 'Jo 3,16' });
        expect(parseLegacyLink('?bible=Edi%C3%A7%C3%A3o%20Pastoral&quote=Sl+23%2C1')).toEqual({
            bible: 'Edição Pastoral',
            reference: 'Sl 23,1',
        });
    });

    it('accepts only one of the parameters', () => {
        expect(parseLegacyLink('?quote=Mt%205')).toEqual({ bible: undefined, reference: 'Mt 5' });
        expect(parseLegacyLink('?bible=CNBB')).toEqual({ bible: 'CNBB', reference: undefined });
    });

    it('ignores URLs without the parameters or with them empty', () => {
        expect(parseLegacyLink('')).toBeNull();
        expect(parseLegacyLink('?utm_source=x')).toBeNull();
        expect(parseLegacyLink('?bible=&quote=%20')).toBeNull();
    });
});
