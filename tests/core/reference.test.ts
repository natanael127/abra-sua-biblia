import { describe, expect, it } from 'vitest';
import { formatVerseRanges, parseReference, resolveVerseIndexes } from '../../src/core/reference';

describe('parseReference', () => {
    it('capítulo inteiro', () => {
        expect(parseReference('Mt 5')).toEqual({
            book: 'Mt',
            chapter: 5,
            verses: [],
            allAfterLast: false,
            allVerses: true,
        });
    });

    it('versículo único, com índice base 0', () => {
        expect(parseReference('Jo 3,16')?.verses).toEqual([15]);
    });

    it('intervalos e versículos combinados, ordenados e sem repetição', () => {
        expect(parseReference('Mt 5,7.3-5.4')?.verses).toEqual([2, 3, 4, 6]);
    });

    it('"N-" marca todos os versículos a partir de N e ignora o restante', () => {
        const parsed = parseReference('Mt 5,3-.10');
        expect(parsed?.verses).toEqual([2]);
        expect(parsed?.allAfterLast).toBe(true);
    });

    it('aceita espaços em volta dos números dos versículos', () => {
        expect(parseReference('Mt 5, 3 - 5 ')?.verses).toEqual([2, 3, 4]);
    });

    it.each(['', 'Jo', 'Jo 3:16', 'Jo três', ' Jo 3', 'Jo  3'])('rejeita "%s"', (reference) => {
        expect(parseReference(reference)).toBeNull();
    });
});

describe('resolveVerseIndexes', () => {
    it('capítulo inteiro', () => {
        expect(resolveVerseIndexes(parseReference('Sl 117')!, 2)).toEqual([0, 1]);
    });

    it('descarta versículos fora do capítulo', () => {
        expect(resolveVerseIndexes(parseReference('Sl 117,0.2-5')!, 2)).toEqual([1]);
    });

    it('expande "a partir de N" até o fim do capítulo', () => {
        expect(resolveVerseIndexes(parseReference('Mt 5,1.3-')!, 5)).toEqual([0, 2, 3, 4]);
    });

    it('não altera a referência interpretada', () => {
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
