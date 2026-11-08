/**
 * Intermediate structure of a displayed passage (the text of the verses that a
 * Bible reference points to), independent of the output format. It is built from the input reference and the display options, and
 * then rendered separately for reading (HTML) and for copying (plain text):
 *
 *     input reference + options -> Passage -> HTML for reading
 *                                          -> plain text for copying
 *
 * Building it also yields the resulting reference of what is displayed, which
 * can differ from the input reference (see ./reference).
 *
 * The texts are raw (not HTML-escaped): escaping is up to each renderer.
 */
import {
    type EbfCrossReference,
    type EbfDocument,
    type EbfVerse,
    findBook,
    getBookAbbreviation,
    getBookName,
    getVerseComment,
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
    parenthesesReference: boolean;
    sectionTitles: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: Readonly<DisplayOptions> = {
    quotes: false,
    verseNumbers: true,
    lineBreaks: true,
    ellipsis: true,
    parenthesesReference: true,
    sectionTitles: true,
};

/** Text that marks verses left out between two selected ones. */
export const OMISSION_TEXT = '[...]';

export type PassageElement =
    /** Section title, shown before the verse it introduces. */
    | { type: 'title'; text: string }
    /**
     * Verse; `number` only when verse numbers are displayed, `notes` only when
     * the verse has a comment or cross-references.
     */
    | { type: 'verse'; text: string; number?: number; notes?: Notes }
    /** Verses left out between two selected ones. */
    | { type: 'omission'; text: string }
    /**
     * Resulting reference after the verses ("Gn 1,1-2.4", without the parentheses):
     * present only with the `parenthesesReference` option.
     */
    | { type: 'resulting-reference'; text: string };

/**
 * What the Bible says about a displayed verse or chapter besides its text: a
 * comment and (verses only) cross-references, as stored in the Bible (see
 * ./cross-references). At least one of them is present.
 */
export interface Notes {
    /** Reference of the verse or chapter itself, with the Bible's abbreviation ("Jo 3,16", "Jo 3"). */
    source: string;
    comment?: string;
    references?: readonly EbfCrossReference[];
}

export interface Passage {
    /** Book and chapter, with the chapter title and the Bible name ("Gênesis 1: A criação (Ave Maria)"). */
    heading: string;
    /** Comment of the chapter, when it has one. */
    chapterNotes?: Notes;
    /**
     * Resulting reference: the reference of what is displayed, compacted and
     * with the Bible's abbreviation ("Gn 1,1-2.4"), always present, even when it is
     * not among the elements. It can differ from the input reference the
     * passage was built from ("gênesis 1, 4.1.2" -> "Gn 1,1-2.4").
     */
    resultingReference: string;
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

/**
 * Elements of the selected verses: titles, verses and omission markers.
 * `chapterReference` is the book abbreviation and chapter ("Jo 3"), for the
 * source of the notes.
 */
export function buildVerseElements(
    verseIndexes: readonly number[],
    chapterVerses: readonly EbfVerse[],
    displayOpt: DisplayOptions,
    chapterReference: string,
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
        const comment = getVerseComment(verse);
        const references = typeof verse === 'object' ? verse.references : undefined;
        elements.push({
            type: 'verse',
            text: adjustQuotes(text),
            ...(displayOpt.verseNumbers && { number: verseIndex + 1 }),
            ...((comment || references?.length) && {
                notes: {
                    source: `${chapterReference},${verseIndex + 1}`,
                    ...(comment && { comment }),
                    ...(references?.length && { references }),
                },
            }),
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
    const chapterReference = `${getBookAbbreviation(book)} ${parsedRef.chapter}`;
    const elements = buildVerseElements(verseIndexes, chapter.verses, displayOpt, chapterReference);

    // From the verses found, not from the input reference: book abbreviation,
    // verses sorted, compacted and limited to the chapter
    let resultingReference = chapterReference;
    if (!parsedRef.allVerses) {
        resultingReference += formatVerseRanges(verseIndexes);
    }
    if (displayOpt.parenthesesReference) {
        elements.push({ type: 'resulting-reference', text: resultingReference });
    }

    return {
        kind: 'passage',
        passage: {
            heading,
            ...(chapter.comment && { chapterNotes: { source: chapterReference, comment: chapter.comment } }),
            resultingReference,
            elements,
            quoted: displayOpt.quotes,
            lineBreaks: displayOpt.lineBreaks,
        },
    };
}
