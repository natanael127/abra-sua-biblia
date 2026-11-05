/**
 * Bible references.
 *
 * A **Bible reference** is the address of a passage: book, chapter and verses
 * ("Jo 3,16-18"). It is not the **passage**, which is the text it points to
 * (see ./passage). Each passage displayed involves two references, which must
 * not be confused:
 *
 * - **input reference**: the reference as the user wrote it (in the reference
 *   field, in a link, in the history), in a free notation: "joão 3, 18.16.17".
 *   It is what gets parsed (`parseReference`). Its canonical form only swaps
 *   the book for the Bible's abbreviation ("Jo 3, 18.16.17") and keeps the
 *   rest as typed; it is what goes into the field and the URL.
 * - **resulting reference**: the reference of what is actually displayed,
 *   built from the verses found in the chapter, compacted and in the Bible's
 *   notation: "Jo 3,16-18". It is shown after the passage (between
 *   parentheses, with the `parenthesesReference` option), in the page title
 *   and when sharing (see `Passage.resultingReference` in ./passage).
 *
 * They can differ in the book (name or abbreviation), the notation
 * ("Jo 3:16" -> "Jo 3,16"), the spacing, the order and repetition of verses,
 * and verses that do not exist in the chapter ("Jo 3,16-99" -> "Jo 3,16-36").
 */

/** Input reference broken into its parts, before being fitted to the chapter. */
export interface ParsedReference {
    book: string;
    chapter: number;
    /** Verse indexes (0-based), sorted and without duplicates. */
    verses: number[];
    /** The reference ends in "N-": all verses from N onwards. */
    allAfterLast: boolean;
    /** The reference does not specify verses: the whole chapter. */
    allVerses: boolean;
}

/** Chapter or verse number: up to 3 digits (no chapter or verse goes beyond 176). */
const NUMBER = String.raw`\d{1,3}`;

/** Range dash: hyphen, en dash or em dash (the last two come with texts copied from documents). */
const DASH = '[-\u2013\u2014]';

/** One verse segment: "N", "N-M" or "N-" (from N onwards), with optional spaces around the numbers. */
const SEGMENT = String.raw`\s*${NUMBER}\s*(?:${DASH}\s*(?:${NUMBER}\s*)?)?`;

/**
 * Whole input reference, in one of two notations that do not overlap:
 *
 * - "Book chapter,segment.segment..." (comma before the verses, dots between them);
 * - "Book chapter:segment,segment..." (colon before the verses, commas between them).
 *
 * The book is a single word, so books whose names have spaces are written by
 * abbreviation or USFM id ("1Cor", "1CO"); exactly one space separates it from
 * the chapter.
 */
const REFERENCE_PATTERN = new RegExp(
    String.raw`^(\S+) (${NUMBER})(?:,(${SEGMENT}(?:\.${SEGMENT})*)|:(${SEGMENT}(?:,${SEGMENT})*))?$`,
);

/** Picks the parts of each segment of an already validated verse list. */
const SEGMENT_PARTS_PATTERN = new RegExp(String.raw`(\d+)\s*(?:(${DASH})\s*(\d+)?)?`, 'g');

/**
 * Parses an input reference in the format "Book chapter[,verses]", where verses
 * are numbers or ranges separated by dots ("Mt 5,3-12.21-"), or
 * "Book chapter[:verses]", where they are separated by commas
 * ("Mt 5:3-12,21-"). The book is kept as written: it is only looked up in the
 * Bible later. Returns null when the reference does not follow the format.
 */
export function parseReference(inputReference: string): ParsedReference | null {
    const match = REFERENCE_PATTERN.exec(inputReference);
    if (!match) {
        return null;
    }
    const [, book = '', chapter = '', dotList, commaList] = match;
    const verseList = dotList ?? commaList;

    const versesList: number[] = [];
    let allAfterLast = false;
    for (const [, startText = '', dash, endText] of (verseList ?? '').matchAll(SEGMENT_PARTS_PATTERN)) {
        const start = Number(startText);
        if (!dash) {
            versesList.push(start - 1);
            continue;
        }
        // "N-": everything from N onwards, so the segments after it do not matter
        if (endText === undefined) {
            allAfterLast = true;
        }
        const end = endText === undefined ? start : Number(endText);
        for (let verse = Math.max(start, 1); verse <= end; verse++) {
            versesList.push(verse - 1);
        }
        if (allAfterLast) break;
    }

    versesList.sort((a, b) => a - b);

    return {
        book,
        chapter: Number(chapter),
        verses: [...new Set(versesList)],
        allAfterLast,
        allVerses: verseList === undefined,
    };
}

/**
 * Fits the verse indexes to the actual size of the chapter: drops the ones
 * that do not exist and expands "whole chapter" and "from N onwards".
 */
export function resolveVerseIndexes(parsedReference: ParsedReference, numOfVerses: number): number[] {
    if (parsedReference.allVerses) {
        return Array.from({ length: numOfVerses }, (_, i) => i);
    }

    const output = parsedReference.verses.filter((verse) => verse >= 0 && verse < numOfVerses);

    const lastIndex = output.at(-1);
    if (parsedReference.allAfterLast && lastIndex !== undefined) {
        for (let i = lastIndex + 1; i < numOfVerses; i++) {
            output.push(i);
        }
    }

    return output;
}

/**
 * Compacts verse indexes (0-based) into the verse part of a resulting
 * reference. E.g.: [0, 1, 2, 4] -> ",1-3.5". An empty list yields an empty
 * string.
 */
export function formatVerseRanges(versesList: readonly number[]): string {
    const first = versesList[0];
    if (first === undefined) {
        return '';
    }

    const ranges: string[] = [];
    const pushRange = (start: number, end: number) => {
        ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
    };

    let rangeStart = first;
    let rangeEnd = first;
    for (const verse of versesList.slice(1)) {
        if (verse === rangeEnd + 1) {
            rangeEnd = verse;
        } else {
            pushRange(rangeStart, rangeEnd);
            rangeStart = verse;
            rangeEnd = verse;
        }
    }
    pushRange(rangeStart, rangeEnd);

    return `,${ranges.join('.')}`;
}
