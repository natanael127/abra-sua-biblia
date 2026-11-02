/**
 * Reader screen URLs: /{language}/{bible}/{book}/{passage}, e.g.:
 * /por/ave-maria/mt/5,3-12.21-38. The language is the translation's ISO 639-3
 * code; the book is the translation's abbreviation, in lowercase; the passage
 * follows the notation of the typed reference. A Bible loaded by upload has no
 * language: /upload/{book}/{passage}.
 */
import { buildPath, type PathParams } from '../../router/path';

/** Route pattern of the reader screen. */
export const READER_PATTERN = '/:language?/:bible?/:book?/:passage?';

/** URL identifier of the Bible loaded by upload (it cannot be shared). */
export const UPLOAD_KEY = 'upload';

/** What the reader screen URL asks for. */
export interface ReaderTarget {
    /** Language and slug ("por/ave-maria") or UPLOAD_KEY; absent if the URL does not identify the Bible. */
    bibleKey?: string;
    /** Language, when it is the only part of the Bible in the URL ("/por"). */
    language?: string;
    book?: string;
    passage?: string;
}

/** Parses the READER_PATTERN parameters. */
export function parseReaderParams(params: PathParams): ReaderTarget {
    const language = params.language?.toLowerCase();
    if (language === UPLOAD_KEY) {
        return { bibleKey: UPLOAD_KEY, book: params.bible, passage: params.book };
    }
    if (!language || !params.bible) {
        return { language };
    }
    return { bibleKey: `${language}/${params.bible.toLowerCase()}`, book: params.book, passage: params.passage };
}

/** Path of the passage; without a valid reference, only the Bible's. `bibleKey`: "por/ave-maria" or UPLOAD_KEY. */
export function readerPath(bibleKey: string, reference?: string | null): string {
    const bibleSegments = bibleKey.split('/');
    const [book, ...rest] = (reference ?? '').trim().split(' ');
    const passage = rest.join(' ').trim();
    if (!book || !passage) {
        return buildPath(...bibleSegments);
    }
    return buildPath(...bibleSegments, book.toLowerCase(), passage);
}

/** Reference from the URL parameters; a book alone opens chapter 1. */
export function referenceFromPath(book?: string, passage?: string): string {
    if (!book) return '';
    return `${book} ${passage ?? '1'}`;
}

export interface LegacyLink {
    /** Bible name, e.g. "Ave-Maria". */
    bible?: string;
    reference?: string;
}

/**
 * Reads the links shared by the previous version: /?bible=Ave-Maria&quote=Jo%203%2C16.
 * Returns null if the URL has none of these parameters.
 */
export function parseLegacyLink(search: string): LegacyLink | null {
    const params = new URLSearchParams(search);
    const bible = params.get('bible')?.trim() || undefined;
    const reference = params.get('quote')?.trim() || undefined;
    if (!bible && !reference) return null;
    return { bible, reference };
}
