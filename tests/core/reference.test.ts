import { describe, expect, it } from 'vitest';
import { formatVerseRanges, parseReference, resolveVerseIndexes } from '../../src/core/reference';

describe('parseReference', () => {
    it('whole chapter', () => {
        expect(parseReference('Mt 5')).toEqual({
            book: 'Mt',
            chapter: 5,
            verses: [],
            allAfterLast: false,
            allVerses: true,
        });
    });

    it('single verse, with 0-based index', () => {
        expect(parseReference('Jo 3,16')?.verses).toEqual([15]);
    });

    it('combined ranges and verses, sorted and without duplicates', () => {
        expect(parseReference('Mt 5,7.3-5.4')?.verses).toEqual([2, 3, 4, 6]);
    });

    it('"N-" marks all verses from N onwards and ignores the rest', () => {
        const parsed = parseReference('Mt 5,3-.10');
        expect(parsed?.verses).toEqual([2]);
        expect(parsed?.allAfterLast).toBe(true);
    });

    it('accepts spaces around the verse numbers', () => {
        expect(parseReference('Mt 5, 3 - 5 ')?.verses).toEqual([2, 3, 4]);
    });

    it.each(['', 'Jo', 'Jo 3:16', 'Jo três', ' Jo 3', 'Jo  3'])('rejects "%s"', (reference) => {
        expect(parseReference(reference)).toBeNull();
    });
});

describe('resolveVerseIndexes', () => {
    it('whole chapter', () => {
        expect(resolveVerseIndexes(parseReference('Sl 117')!, 2)).toEqual([0, 1]);
    });

    it('drops verses outside the chapter', () => {
        expect(resolveVerseIndexes(parseReference('Sl 117,0.2-5')!, 2)).toEqual([1]);
    });

    it('expands "from N onwards" to the end of the chapter', () => {
        expect(resolveVerseIndexes(parseReference('Mt 5,1.3-')!, 5)).toEqual([0, 2, 3, 4]);
    });

    it('does not change the parsed reference', () => {
        const parsed = parseReference('Mt 5,3-')!;
        resolveVerseIndexes(parsed, 10);
        expect(parsed.verses).toEqual([2]);
    });
});

describe('formatVerseRanges', () => {
    it.each([
        [[], ''],
        [[15], ',16'],
        [[0, 1, 2, 4], ',1-3.5'],
        [[2, 4, 5, 6, 9], ',3.5-7.10'],
    ])('%j -> "%s"', (verses, expected) => {
        expect(formatVerseRanges(verses)).toBe(expected);
    });
});
