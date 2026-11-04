/**
 * Easy Bible Format, version 1 (EBF1).
 * https://github.com/natanael127/easy-bible-format
 *
 * The Bibles in the Blob store (bibles-catalog.json) follow this format and are
 * published without any transformation, so they can be downloaded and used in
 * other projects. Their conformance to the official schema (ebf1-schema.json from the
 * easy-bible-format package, pinned to a commit) is checked in the tests.
 *
 * The types below describe what the site is able to read, more leniently than
 * the schema (optional abbreviation, usfm_id and language, verse as plain
 * text), because they also cover the output of the XML converters. JSON files
 * uploaded by the user must follow the schema (validateEbf).
 */
import validateEbf1Schema from 'virtual:ebf1-validator';

export interface EbfCrossReference {
    usfm_id: string;
    chapter: number;
    verse: number;
}

export interface EbfVerseObject {
    text: string;
    title?: string;
    comment?: string;
    references?: EbfCrossReference[];
}

/** A verse can be an object or just its text. */
export type EbfVerse = EbfVerseObject | string;

export interface EbfChapter {
    verses: EbfVerse[];
    title?: string;
    comment?: string;
}

export interface EbfBook {
    names: string[];
    abbreviation?: string;
    usfm_id?: string;
    chapters: EbfChapter[];
}

export interface EbfBible {
    name: string;
    language?: string;
    books: EbfBook[];
}

export interface EbfDocument {
    bible: EbfBible;
    metadata?: Record<string, unknown>;
}

export function getVerseText(verse: EbfVerse | undefined): string | undefined {
    return typeof verse === 'string' ? verse : verse?.text;
}

export function getVerseTitle(verse: EbfVerse | undefined): string | undefined {
    return typeof verse === 'object' ? verse.title : undefined;
}

/** Main name of the book, with fallbacks for incomplete files. */
export function getBookName(book: EbfBook): string {
    return book.names[0] ?? book.abbreviation ?? book.usfm_id ?? '';
}

/** Abbreviation used in references, with fallbacks for incomplete files. */
export function getBookAbbreviation(book: EbfBook): string {
    return book.abbreviation || getBookName(book).substring(0, 3);
}

export function findBook(ebf: EbfDocument, bookString: string): EbfBook | undefined {
    const wanted = bookString.toLowerCase();
    return ebf.bible.books.find(
        (b) =>
            b.abbreviation?.toLowerCase() === wanted ||
            b.usfm_id?.toLowerCase() === wanted ||
            b.names.some((name) => name.toLowerCase() === wanted),
    );
}

/**
 * Identifier of the book in URLs: the USFM id (uniform across translations),
 * or the abbreviation in files without one. Case is left to the caller.
 */
export function getBookUrlId(book: EbfBook): string {
    return book.usfm_id || getBookAbbreviation(book);
}

/**
 * Finds the book of a URL: by USFM id first (an abbreviation of one book may be
 * the USFM id of another, e.g. "Jud"), then like `findBook`.
 */
export function findBookByUrlId(ebf: EbfDocument, urlId: string): EbfBook | undefined {
    const wanted = urlId.toLowerCase();
    return ebf.bible.books.find((b) => b.usfm_id?.toLowerCase() === wanted) ?? findBook(ebf, urlId);
}

/**
 * The same book in another Bible, written as it is there: `bookString` is looked
 * up in `from` and its book is matched in `to` by USFM id (or by URL id, for
 * files without one). The form typed is kept: a name of the book gives the name
 * in the same position in `to` (or another one), an abbreviation or USFM id gives
 * the abbreviation. Names with spaces do not fit in an input reference (the book
 * ends at the first space), so the abbreviation is used when `to` has no other.
 * Undefined when either Bible lacks the book.
 */
export function translateBook(from: EbfDocument, to: EbfDocument, bookString: string): string | undefined {
    const source = findBook(from, bookString);
    const target = source && findBookByUrlId(to, getBookUrlId(source));
    if (!target) return undefined;

    const wanted = bookString.toLowerCase();
    const nameIndex = source.names.findIndex((name) => name.toLowerCase() === wanted);
    const typedName =
        nameIndex >= 0 && source.abbreviation?.toLowerCase() !== wanted && source.usfm_id?.toLowerCase() !== wanted;
    if (typedName) {
        const fits = (name: string | undefined): name is string => !!name && !/\s/.test(name);
        const name = fits(target.names[nameIndex]) ? target.names[nameIndex] : target.names.find(fits);
        if (name) return name;
    }
    return getBookAbbreviation(target);
}

export function getNumOfChapters(ebf: EbfDocument, bookString: string): number {
    return findBook(ebf, bookString)?.chapters.length ?? 0;
}

/**
 * Validates the document against the official EBF1 schema (used when uploading
 * JSON files). Returns the list of problems found (empty when the document is
 * valid), each one with the path of the field.
 */
export function validateEbf(data: unknown): string[] {
    if (validateEbf1Schema(data)) return [];
    return (validateEbf1Schema.errors ?? []).map((error) => `${error.instancePath || '/'}: ${error.message ?? 'invalid'}`);
}

export function isEbfDocument(data: unknown): data is EbfDocument {
    return validateEbf1Schema(data);
}
