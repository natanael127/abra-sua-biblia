/**
 * Intermediate structure of a displayed passage, independent of the output
 * format. It is built from the input reference and the display options, and
 * then rendered separately for reading (HTML) and for copying (plain text):
 *
 *     input reference + options -> Passage -> HTML for reading
 *                                          -> plain text for copying
 *
 * Building it also yields the resulting citation of what is displayed, which
 * can differ from the input reference (see ./reference).
 *
 * The texts are raw (not HTML-escaped): escaping is up to each renderer.
 */
import {
    type EbfDocument,
    type EbfVerse,
    findBook,
    getBookAbbreviation,
    getBookName,
    getVerseText,
    getVerseTitle,
} from './ebf';
import { t } from '../i18n';
import { formatVerseRanges, parseReference, resolveVerseIndexes } from './reference';
import { escapeHtml, toSingleQuotes } from './text';

export interface DisplayOptions {
    quotes: boolean;
    verseNumbers: boolean;
    lineBreaks: boolean;
    ellipsis: boolean;
    parenthesesCitation: boolean;
    sectionTitles: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: Readonly<DisplayOptions> = {
    quotes: false,
    verseNumbers: true,
    lineBreaks: true,
    ellipsis: true,
    parenthesesCitation: true,
    sectionTitles: true,
};

/** Text that marks verses left out between two selected ones. */
export const OMISSION_TEXT = '[...]';

export type PassageElement =
    /** Section title, shown before the verse it introduces. */
    | { type: 'title'; text: string }
    /** Verse; `number` only when verse numbers are displayed. */
    | { type: 'verse'; text: string; number?: number }
    /** Verses left out between two selected ones. */
    | { type: 'omission'; text: string }
    /**
     * Resulting citation after the verses ("Gn 1,1-2.4", without the parentheses):
     * present only with the `parenthesesCitation` option.
     */
    | { type: 'resulting-citation'; text: string };

export interface Passage {
    /** Book and chapter, with the chapter title and the Bible name ("Gênesis 1: A criação (Ave Maria)"). */
    heading: string;
    /**
     * Resulting citation: the citation of what is displayed, compacted and with
     * the Bible's abbreviation ("Gn 1,1-2.4"), always present, even when it is
     * not among the elements. It can differ from the input reference the
     * passage was built from ("gênesis 1, 4.1.2" -> "Gn 1,1-2.4").
     */
    resultingCitation: string;
    elements: PassageElement[];
    /** The passage is wrapped in double quotes, from the first to the last verse. */
    quoted: boolean;
    /** Each element on its own line (otherwise separated by spaces). */
    lineBreaks: boolean;
}

/**
 * Result of building a passage: the passage, or the HTML of an error. An
 * input reference that cannot be parsed has no message of its own (the screen
 * shows the instructions).
 */
export type PassageResult =
    | { kind: 'passage'; passage: Passage }
    | { kind: 'error'; html: string }
    | { kind: 'invalid-input-reference' };

const errorResult = (message: string): PassageResult => ({
    kind: 'error',
    html: `<span class="error">${message}</span>`,
});

/** Elements of the selected verses: titles, verses and omission markers. */
export function buildVerseElements(
    verseIndexes: readonly number[],
    chapterVerses: readonly EbfVerse[],
    displayOpt: DisplayOptions,
): PassageElement[] {
    const elements: PassageElement[] = [];

    // Replace all kind of double quotes with single quotes, so they do not
    // clash with the ones that wrap the passage.
    const adjustQuotes = (text: string) => (displayOpt.quotes ? toSingleQuotes(text) : text);

    let previousVerse = -1;
    for (const verseIndex of verseIndexes) {
        // Gap between verses: omission marker
        if (previousVerse >= 0 && verseIndex > previousVerse + 1 && displayOpt.ellipsis) {
            elements.push({ type: 'omission', text: OMISSION_TEXT });
        }
        previousVerse = verseIndex;

        const verse = chapterVerses[verseIndex];
        const text = getVerseText(verse);
        // Verses without text (omitted by the translation) are left out, title included
        if (!text) continue;

        const title = getVerseTitle(verse);
        if (displayOpt.sectionTitles && title) {
            elements.push({ type: 'title', text: adjustQuotes(title) });
        }
        elements.push({
            type: 'verse',
            text: adjustQuotes(text),
            ...(displayOpt.verseNumbers && { number: verseIndex + 1 }),
        });
    }

    return elements;
}

/** Builds the passage asked for by the input reference. */
export function buildPassage(inputReference: string, ebf: EbfDocument | null, displayOpt: DisplayOptions): PassageResult {
    if (!ebf) {
        return errorResult(t('errors.noBibleLoaded'));
    }

    try {
        return build(inputReference, ebf, displayOpt);
    } catch (error) {
        console.error('Error processing the Bible JSON:', error);
        return errorResult(t('errors.invalidBible'));
    }
}

function build(inputReference: string, ebf: EbfDocument, displayOpt: DisplayOptions): PassageResult {
    const parsedRef = parseReference(inputReference);
    if (parsedRef === null) {
        return { kind: 'invalid-input-reference' };
    }

    const book = findBook(ebf, parsedRef.book);
    if (!book) {
        return errorResult(t('errors.bookNotFound', { book: escapeHtml(parsedRef.book) }));
    }

    const chapter = book.chapters[parsedRef.chapter - 1];
    if (!chapter) {
        return errorResult(t('errors.chapterNotFound', { chapter: parsedRef.chapter, book: escapeHtml(getBookName(book)) }));
    }

    let heading = `${getBookName(book)} ${parsedRef.chapter}`;
    if (chapter.title) {
        heading += `: ${chapter.title}`;
    }
    if (ebf.bible.name) {
        heading += ` (${ebf.bible.name})`;
    }

    const verseIndexes = resolveVerseIndexes(parsedRef, chapter.verses.length);
    const elements = buildVerseElements(verseIndexes, chapter.verses, displayOpt);

    // From the verses found, not from the input reference: book abbreviation,
    // verses sorted, compacted and limited to the chapter
    let resultingCitation = `${getBookAbbreviation(book)} ${parsedRef.chapter}`;
    if (!parsedRef.allVerses) {
        resultingCitation += formatVerseRanges(verseIndexes);
    }
    if (displayOpt.parenthesesCitation) {
        elements.push({ type: 'resulting-citation', text: resultingCitation });
    }

    return {
        kind: 'passage',
        passage: { heading, resultingCitation, elements, quoted: displayOpt.quotes, lineBreaks: displayOpt.lineBreaks },
    };
}
