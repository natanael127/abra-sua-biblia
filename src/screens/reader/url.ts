/**
 * Reader screen URLs: /{language}/{bible}/{book}/{chapterVerses}, e.g.:
 * /por/ave-maria/mt/5,3-12.21-38. The language is the translation's ISO 639-3
 * code; book and chapterVerses are the parts of the Bible reference: the book
 * is the translation's abbreviation, in lowercase; chapterVerses follows the notation of the input reference, as typed (not the resulting
 * reference, see src/core/reference.ts). A Bible loaded by upload has no
 * language: /upload/{book}/{chapterVerses}.
 */
import { buildPath, type PathParams } from '../../router/path';

/** Route pattern of the reader screen. */
export const READER_PATTERN = '/:language?/:bible?/:book?/:chapterVerses?';

/** URL identifier of the Bible loaded by upload (it cannot be shared). */
export const UPLOAD_KEY = 'upload';

/** What the reader screen URL asks for. */
export interface ReaderTarget {
    /** Language and slug ("por/ave-maria") or UPLOAD_KEY; absent if the URL does not identify the Bible. */
    bibleKey?: string;
    /** Language, when it is the only part of the Bible in the URL ("/por"). */
    language?: string;
    book?: string;
    /** Chapter and verses of the reference, e.g.: "5,3-12". */
    chapterVerses?: string;
}

/** Parses the READER_PATTERN parameters. */
export function parseReaderParams(params: PathParams): ReaderTarget {
    const language = params.language?.toLowerCase();
    if (language === UPLOAD_KEY) {
        return { bibleKey: UPLOAD_KEY, book: params.bible, chapterVerses: params.book };
    }
    if (!language || !params.bible) {
        return { language };
    }
    return { bibleKey: `${language}/${params.bible.toLowerCase()}`, book: params.book, chapterVerses: params.chapterVerses };
}

/**
 * Path of the passage asked for by the (canonical) input reference; without a
 * valid one, only the Bible's. `bibleKey`: "por/ave-maria" or UPLOAD_KEY.
 */
export function readerPath(bibleKey: string, inputReference?: string | null): string {
    const bibleSegments = bibleKey.split('/');
    const [book, ...rest] = (inputReference ?? '').trim().split(' ');
    const chapterVerses = rest.join(' ').trim();
    if (!book || !chapterVerses) {
        return buildPath(...bibleSegments);
    }
    return buildPath(...bibleSegments, book.toLowerCase(), chapterVerses);
}

/** Input reference from the URL parameters; a book alone opens chapter 1. */
export function inputReferenceFromPath(book?: string, chapterVerses?: string): string {
    if (!book) return '';
    return `${book} ${chapterVerses ?? '1'}`;
}

export interface LegacyLink {
    /** Bible name, e.g. "Ave-Maria". */
    bible?: string;
    /** Input reference of the `quote` parameter, e.g. "Jo 3,16". */
    inputReference?: string;
}

/**
 * Reads the links shared by the previous version: /?bible=Ave-Maria&quote=Jo%203%2C16.
 * Returns null if the URL has none of these parameters.
 */
export function parseLegacyLink(search: string): LegacyLink | null {
    const params = new URLSearchParams(search);
    const bible = params.get('bible')?.trim() || undefined;
    const inputReference = params.get('quote')?.trim() || undefined;
    if (!bible && !inputReference) return null;
    return { bible, inputReference };
}
