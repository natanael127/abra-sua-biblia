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

/**
 * Parses references in the format "Book chapter[,verses]", where verses are
 * numbers or ranges separated by dots. E.g.: "Mt 5,3-12.21-".
 */
export function parseReference(reference: string): ParsedReference | null {
    const [book = '', ...rest] = reference.split(' ');
    const others = rest.join(' ');

    // Basic pattern: Chapter[,Verse(s)]
    const match = /^(\d+)(?:,(.+))?$/.exec(others);
    if (!match) {
        return null;
    }

    const chapter = match[1] ?? '';
    const verseRef = match[2];

    // Verses (may contain multiple references separated by dots)
    const verseSegments = verseRef ? verseRef.split('.') : [];
    const allVerses = !verseRef;

    const versesList: number[] = [];
    let allAfterLast = false;
    for (const segment of verseSegments) {
        if (allAfterLast) break;

        // Check whether it is a range (e.g. 5-7) or a single verse
        if (segment.includes('-')) {
            const [startText = '', endText = ''] = segment.split('-');
            const start = parseInt(startText.trim());
            let end = parseInt(endText.trim());
            if (isNaN(end)) {
                allAfterLast = true;
                end = start;
            }
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (i > 0) {
                        versesList.push(i - 1);
                    }
                }
            }
        } else {
            const verseNumber = parseInt(segment.trim());
            if (!isNaN(verseNumber)) {
                versesList.push(verseNumber - 1);
            }
        }
    }

    versesList.sort((a, b) => a - b);

    return {
        book,
        chapter: parseInt(chapter),
        verses: [...new Set(versesList)],
        allAfterLast,
        allVerses,
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
 * Compacts verse indexes (0-based) into reference notation.
 * E.g.: [0, 1, 2, 4] -> ",1-3.5". An empty list yields an empty string.
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
