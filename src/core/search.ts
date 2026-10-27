import { type EbfDocument, getBookAbbreviation, getBookName, getVerseText } from './ebf';
import { escapeHtml } from './text';

export const MIN_QUERY_LENGTH = 3;
export const MAX_SEARCH_RESULTS = 200;

export interface SearchResult {
    bookAbbr: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
}

/** Busca versículos que contenham o texto, sem diferenciar maiúsculas de minúsculas. */
export function searchVerses(ebf: EbfDocument, query: string, maxResults = MAX_SEARCH_RESULTS): SearchResult[] {
    const results: SearchResult[] = [];
    if (query.length < MIN_QUERY_LENGTH) return results;

    const queryLower = query.toLowerCase();

    for (const book of ebf.bible.books) {
        for (const [ci, chapter] of book.chapters.entries()) {
            for (const [vi, verse] of chapter.verses.entries()) {
                const text = getVerseText(verse);
                if (text?.toLowerCase().includes(queryLower)) {
                    results.push({
                        bookAbbr: getBookAbbreviation(book),
                        bookName: getBookName(book),
                        chapter: ci + 1,
                        verse: vi + 1,
                        text,
                    });
                    if (results.length >= maxResults) return results;
                }
            }
        }
    }

    return results;
}

/** Envolve as ocorrências da busca em <mark>, num texto já escapado. */
export function highlightQuery(escapedText: string, query: string): string {
    const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Case-insensitive replace, preserving original case in the output
    return escapedText.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>');
}
