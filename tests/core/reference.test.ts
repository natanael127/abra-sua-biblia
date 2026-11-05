import { describe, expect, it } from 'vitest';
import { formatVerseRanges, parseReference, resolveVerseIndexes } from '../../src/core/reference';

describe('parseReference', () => {
    const parsed = (book: string, chapter: number, verses: number[], allAfterLast = false, allVerses = false) => ({
        book,
        chapter,
        verses,
        allAfterLast,
        allVerses,
    });

    it('whole chapter', () => {
        expect(parseReference('Mt 5')).toEqual(parsed('Mt', 5, [], false, true));
    });

    it('single verse, with 0-based index', () => {
        expect(parseReference('Jo 3,16')).toEqual(parsed('Jo', 3, [15]));
    });

    it('combined ranges and verses, sorted and without duplicates', () => {
        expect(parseReference('Mt 5,7.3-5.4')?.verses).toEqual([2, 3, 4, 6]);
    });

    it('"N-" marks all verses from N onwards and ignores the rest', () => {
        expect(parseReference('Mt 5,3-.10')).toEqual(parsed('Mt', 5, [2], true));
        expect(parseReference('Mt 5,3-.1-2.7-')).toEqual(parsed('Mt', 5, [2], true));
    });

    it('"N-" keeps the verses before it', () => {
        expect(parseReference('Mt 5,7.3-')).toEqual(parsed('Mt', 5, [2, 6], true));
    });

    it('accepts spaces around the verse numbers', () => {
        expect(parseReference('Mt 5, 3 - 5 ')?.verses).toEqual([2, 3, 4]);
        expect(parseReference('Mt 5, 1 . 3 - 4 . 7 ')?.verses).toEqual([0, 2, 3, 6]);
        expect(parseReference('Mt 5,3 - ')).toEqual(parsed('Mt', 5, [2], true));
        expect(parseReference('Mt 5,\t3')?.verses).toEqual([2]);
    });

    describe('colon notation: "Book chapter:verses", with commas between the verses', () => {
        it.each([
            ['Jo 3:16', 'Jo 3,16'],
            ['Mt 5:3-12', 'Mt 5,3-12'],
            ['Mt 5:3-12,21-38', 'Mt 5,3-12.21-38'],
            ['Mt 5:7,3-5,4', 'Mt 5,7.3-5.4'],
            ['Mt 5:3-', 'Mt 5,3-'],
            ['Mt 5:3-,10', 'Mt 5,3-.10'],
            ['Mt 5:7,3-', 'Mt 5,7.3-'],
            ['Mt 5: 3 - 5 , 7 ', 'Mt 5, 3 - 5 . 7 '],
            ['Jo 3:0-2', 'Jo 3,0-2'],
            ['Jo 3:16-14', 'Jo 3,16-14'],
            ['1CO 13:4-7,13', '1CO 13,4-7.13'],
        ])('"%s" is read like "%s"', (colon, comma) => {
            expect(parseReference(colon)).toEqual(parseReference(comma));
            expect(parseReference(colon)).not.toBeNull();
        });

        it.each(['Jo 3:', 'Jo 3:16.17', 'Jo 3:16,17.18', 'Jo 3,16:17', 'Jo 3:16:17', 'Jo 3 :16', 'Jo 3:,16', 'Jo 3:16,', 'Jo 3::16'])(
            'rejects "%s"',
            (reference) => {
                expect(parseReference(reference)).toBeNull();
            },
        );
    });

    describe('en dash and em dash work as the range hyphen', () => {
        it.each([
            ['Jo 3,16–18', 'Jo 3,16-18'],
            ['Jo 3,16—18', 'Jo 3,16-18'],
            ['Jo 3,16 – 18', 'Jo 3,16 - 18'],
            ['Mt 5,3–12.21—38', 'Mt 5,3-12.21-38'],
            ['Mt 5,3–', 'Mt 5,3-'],
            ['Mt 5:3–12,21—', 'Mt 5,3-12.21-'],
        ])('"%s" is read like "%s"', (dash, hyphen) => {
            expect(parseReference(dash)).toEqual(parseReference(hyphen));
            expect(parseReference(dash)).not.toBeNull();
        });

        it.each(['Jo 3,16−18', 'Jo 3,16‐18', 'Jo 3,16~18', 'Jo 3,16_18', 'Jo 3,16–—18', 'Jo 3,–16', 'Jo 3–4'])('rejects "%s"', (reference) => {
            expect(parseReference(reference)).toBeNull();
        });
    });

    it.each([
        ['Jo 3,16', 'Jo'],
        ['jo 3,16', 'jo'],
        ['JHN 3,16', 'JHN'],
        ['João 3,16', 'João'],
        ['1Cor 13,4', '1Cor'],
        ['1CO 13,4', '1CO'],
        ['1co 13,4', '1co'],
        ['Xyz 1,1', 'Xyz'],
        ['Ct 1', 'Ct'],
        ['马太福音 5,3', '马太福音'],
        ['متى 5,3', 'متى'],
    ])('keeps the book as written: "%s" -> "%s"', (reference, book) => {
        expect(parseReference(reference)?.book).toBe(book);
    });

    it.each(['1 Cor 13,4', '1 Coríntios 13', 'Cântico dos Cânticos 1,1', 'São João 3,16', '1 Jo 1'])(
        'rejects a book with spaces: "%s"',
        (reference) => {
            expect(parseReference(reference)).toBeNull();
        },
    );

    it('verse 0 is kept as index -1 (dropped later), but 0 starting a range is skipped', () => {
        expect(parseReference('Jo 3,0')?.verses).toEqual([-1]);
        expect(parseReference('Jo 3,0-2')?.verses).toEqual([0, 1]);
        expect(parseReference('Jo 3,0-')).toEqual(parsed('Jo', 3, [], true));
    });

    it('a descending range yields no verses', () => {
        expect(parseReference('Jo 3,16-14')).toEqual(parsed('Jo', 3, []));
        expect(parseReference('Jo 3,16-14.2')?.verses).toEqual([1]);
    });

    it('chapter 0 and leading zeros', () => {
        expect(parseReference('Jo 0')?.chapter).toBe(0);
        expect(parseReference('Jo 03,016')).toEqual(parsed('Jo', 3, [15]));
    });

    it('numbers of up to 3 digits', () => {
        expect(parseReference('Sl 150')?.chapter).toBe(150);
        expect(parseReference('Sl 119,176')?.verses).toEqual([175]);
        expect(parseReference('Jo 3,999')?.verses).toEqual([998]);
        expect(parseReference('Jo 3,1-999')?.verses).toHaveLength(999);
    });

    it.each([
        // empty, missing parts
        '',
        ' ',
        'Jo',
        'Jo ',
        '3',
        '3,16',
        ' 3,16',
        'Jo 3,',
        'Jo ,16',
        // spacing around book and chapter
        ' Jo 3',
        'Jo  3',
        'Jo 3 ',
        'Jo\t3',
        'Jo 3 ,16',
        'Jo3,16',
        // other separators
        'Jo 3;16',
        'Jo 3,16,17',
        'Jo 3,16;17',
        'Jo 3-4',
        'Jo 3.16',
        // not numbers
        'Jo três',
        'Jo 3,abc',
        'Jo 3,16abc',
        'Jo 3,16.x',
        'Jo 3a',
        'Jo -3',
        'Jo +3',
        'Jo 3,+16',
        'Jo 3,1e2',
        'Jo 3,١٦',
        'Jo ٣,16',
        // malformed verse lists
        'Jo 3,.16',
        'Jo 3,16.',
        'Jo 3,16..17',
        'Jo 3,-16',
        'Jo 3,-',
        'Jo 3,16--18',
        'Jo 3,16-17-18',
        'Jo 3,16 17',
        'Jo 3, ',
        // more than 3 digits
        'Jo 1000',
        'Jo 3,1000',
        'Jo 3,1-1000',
        'Jo 3,1-9999999999',
        // a book with spaces
        '1 Cor 13',
    ])('rejects "%s"', (reference) => {
        expect(parseReference(reference)).toBeNull();
    });

    it('is fast on long and malicious inputs', () => {
        const inputs = [
            `Jo 3,${'1.'.repeat(20000)}1`,
            `Jo 3,${'1.'.repeat(20000)}`,
            `Jo 3,${' '.repeat(20000)}x`,
            `Jo 3,1${' '.repeat(20000)}x`,
            `Jo 3,1-${' '.repeat(20000)}x`,
            `Jo 3,${'1 . '.repeat(20000)}x`,
            `${'J'.repeat(50000)} 3,1x`,
            `Jo ${'1'.repeat(50000)}`,
            `Jo 3:${'1,'.repeat(20000)}x`,
            `Jo 3:${'1 – '.repeat(20000)}x`,
            `Jo 3,${'1–'.repeat(20000)}`,
        ];
        const start = performance.now();
        for (const input of inputs) parseReference(input);
        expect(performance.now() - start).toBeLessThan(500);
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
