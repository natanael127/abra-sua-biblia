/**
 * Cross-references of a verse (`references` in EBF1): verses elsewhere in the
 * Bible that are related to it, each one stored as a single verse
 * (book USFM id, chapter, verse).
 *
 * For display they are grouped: consecutive entries of the same book and
 * chapter become one reference with verse ranges (MRK 10:7, MRK 10:8 ->
 * "Mc 10,7-8"), keeping the order of the file otherwise.
 */
import { type EbfBook, type EbfCrossReference, type EbfDocument, getBookAbbreviation, getVerseText } from './ebf';
import { formatVerseRanges } from './reference';

export interface CrossReference {
    /**
     * Reference to show and to navigate to, with the Bible's abbreviation
     * ("Mc 10,7-8"); with the USFM id when the Bible lacks the book ("TOB 1,1").
     */
    reference: string;
    /** Text of the verses, separated by spaces; empty when the Bible lacks them. */
    text: string;
    /** The Bible has the book, so the reference can be opened. */
    available: boolean;
}

interface Group {
    usfmId: string;
    chapter: number;
    /** 1-based verse numbers. */
    verses: number[];
}

/** Groups consecutive entries of the same book and chapter. */
function groupReferences(references: readonly EbfCrossReference[]): Group[] {
    const groups: Group[] = [];
    for (const { usfm_id, chapter, verse } of references) {
        const usfmId = usfm_id.toUpperCase();
        const last = groups.at(-1);
        if (last?.usfmId === usfmId && last.chapter === chapter) {
            if (!last.verses.includes(verse)) last.verses.push(verse);
        } else {
            groups.push({ usfmId, chapter, verses: [verse] });
        }
    }
    return groups;
}

const findBookByUsfmId = (ebf: EbfDocument, usfmId: string): EbfBook | undefined =>
    ebf.bible.books.find((book) => book.usfm_id?.toUpperCase() === usfmId);

/** Cross-references of a verse, grouped and resolved against the Bible. */
export function resolveCrossReferences(ebf: EbfDocument, references: readonly EbfCrossReference[]): CrossReference[] {
    return groupReferences(references).map(({ usfmId, chapter, verses }) => {
        const indexes = verses.map((verse) => verse - 1).sort((a, b) => a - b);
        const book = findBookByUsfmId(ebf, usfmId);
        const reference = `${book ? getBookAbbreviation(book) : usfmId} ${chapter}${formatVerseRanges(indexes)}`;
        const chapterVerses = book?.chapters[chapter - 1]?.verses ?? [];
        const text = indexes
            .map((index) => getVerseText(chapterVerses[index]))
            .filter(Boolean)
            .join(' ');
        return { reference, text, available: book !== undefined };
    });
}
