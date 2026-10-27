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

const COMBINING_MARKS = /\p{M}/gu;

/** Forma usada na comparação: sem acentos/cedilha e em minúsculas ("Coração" -> "coracao"). */
export function foldText(text: string): string {
    return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

interface IndexedVerse {
    folded: string;
    result: SearchResult;
}

/** Versículos já normalizados, calculados uma vez por Bíblia carregada. */
const indexCache = new WeakMap<EbfDocument, IndexedVerse[]>();

/** Prepara o índice de busca da Bíblia (leva algumas centenas de ms numa Bíblia completa). */
export function prepareSearchIndex(ebf: EbfDocument): void {
    getIndex(ebf);
}

function getIndex(ebf: EbfDocument): IndexedVerse[] {
    let index = indexCache.get(ebf);
    if (!index) {
        index = [];
        for (const book of ebf.bible.books) {
            const bookAbbr = getBookAbbreviation(book);
            const bookName = getBookName(book);
            for (const [ci, chapter] of book.chapters.entries()) {
                for (const [vi, verse] of chapter.verses.entries()) {
                    const text = getVerseText(verse);
                    if (text) {
                        index.push({
                            folded: foldText(text),
                            result: { bookAbbr, bookName, chapter: ci + 1, verse: vi + 1, text },
                        });
                    }
                }
            }
        }
        indexCache.set(ebf, index);
    }
    return index;
}

/**
 * Busca versículos que contenham o texto, na ordem da Bíblia, sem diferenciar
 * maiúsculas de minúsculas nem considerar acentos.
 */
export function searchVerses(ebf: EbfDocument, query: string, maxResults = MAX_SEARCH_RESULTS): SearchResult[] {
    const results: SearchResult[] = [];
    if (query.length < MIN_QUERY_LENGTH) return results;

    const needle = foldText(query);
    for (const { folded, result } of getIndex(ebf)) {
        if (folded.includes(needle)) {
            results.push(result);
            if (results.length >= maxResults) break;
        }
    }

    return results;
}

/**
 * Normaliza o texto caractere a caractere, guardando para cada posição do
 * resultado a posição de origem. map[folded.length] é o fim do texto original.
 */
function foldWithMap(text: string): { folded: string; map: number[] } {
    let folded = '';
    const map: number[] = [];
    for (let i = 0; i < text.length; ) {
        const char = String.fromCodePoint(text.codePointAt(i) ?? 0);
        const foldedChar = foldText(char);
        for (let k = 0; k < foldedChar.length; k++) map.push(i);
        folded += foldedChar;
        i += char.length;
    }
    map.push(text.length);
    return { folded, map };
}

/**
 * Escapa o texto para HTML e envolve em <mark> as ocorrências da busca,
 * com os mesmos critérios de searchVerses (sem acentos e maiúsculas).
 */
export function highlightMatches(text: string, query: string): string {
    const needle = foldText(query);
    if (!needle) return escapeHtml(text);

    const { folded, map } = foldWithMap(text);
    let html = '';
    let last = 0;
    for (let found = folded.indexOf(needle); found !== -1; found = folded.indexOf(needle, found + needle.length)) {
        // Combining marks after the last matched letter belong to the match
        const start = map[found] ?? last;
        const end = map[found + needle.length] ?? text.length;
        html += `${escapeHtml(text.slice(last, start))}<mark>${escapeHtml(text.slice(start, end))}</mark>`;
        last = end;
    }
    return html + escapeHtml(text.slice(last));
}
