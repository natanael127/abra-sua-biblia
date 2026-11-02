/**
 * Full-text search over the verses, ignoring case and accents.
 *
 * The search uses a MiniSearch index, built in slices of ~10 ms so the page
 * does not freeze (it takes a few seconds for a full Bible). Until the index
 * is ready, a phrase search is used instead, in Bible order.
 */
import MiniSearch from 'minisearch';
import { type EbfDocument, getBookAbbreviation, getBookName, getVerseText } from './ebf';
import { escapeHtml } from './text';

export const MIN_QUERY_LENGTH = 3;
export const MAX_SEARCH_RESULTS = 200;

/** Maximum time of each indexing slice before control is handed back to the page. */
const INDEX_SLICE_MS = 10;

export interface SearchResult {
    bookAbbr: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
    /** Matched words (normalized), for highlighting; only in relevance search. */
    terms?: string[];
}

/** Result order: by relevance or in Bible order (books, chapters and verses). */
export type SearchOrder = 'relevance' | 'book';

export interface SearchResponse {
    results: SearchResult[];
    /** Total number of verses found (may exceed the results limit). */
    total: number;
    /** true: sorted by relevance; false: in Bible order (book order or phrase search). */
    ranked: boolean;
}

const COMBINING_MARKS = /\p{M}/gu;
/** Words: the inverse of MiniSearch's default separator (spaces and punctuation). */
const WORD = /[^\n\r\p{Z}\p{P}]+/gu;
/** Separator that joins words into a single highlight: only spaces and hyphens. */
const JOINABLE_GAP = /^[\s\p{Z}\p{Pd}]+$/u;

/** Form used for comparison: without accents/cedilla and lowercase ("Coração" -> "coracao"). */
export function foldText(text: string): string {
    return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

interface IndexedVerse {
    /** Normalized text, computed on demand (see foldedText). */
    folded?: string;
    result: SearchResult;
}

const foldedText = (verse: IndexedVerse): string => (verse.folded ??= foldText(verse.result.text));

/** Verses of the Bible, listed once per loaded Bible. */
const versesCache = new WeakMap<EbfDocument, IndexedVerse[]>();

function getVerses(ebf: EbfDocument): IndexedVerse[] {
    let verses = versesCache.get(ebf);
    if (!verses) {
        verses = [];
        for (const book of ebf.bible.books) {
            const bookAbbr = getBookAbbreviation(book);
            const bookName = getBookName(book);
            for (const [ci, chapter] of book.chapters.entries()) {
                for (const [vi, verse] of chapter.verses.entries()) {
                    const text = getVerseText(verse);
                    if (text) {
                        verses.push({ result: { bookAbbr, bookName, chapter: ci + 1, verse: vi + 1, text } });
                    }
                }
            }
        }
        versesCache.set(ebf, verses);
    }
    return verses;
}

interface RankedIndex {
    ebf: EbfDocument;
    miniSearch: MiniSearch<number>;
    ready: boolean;
    whenReady: Promise<void>;
}

/** Only the Bible in use has an index (about 100 MB for a full Bible). */
let current: RankedIndex | null = null;

interface Scheduler {
    postTask?: (callback: () => void, options: { priority: 'background' }) => Promise<void>;
}

/**
 * Hands control back to the page. With scheduler.postTask, indexing runs at
 * low priority, after interactions and timers (typing, messages); without it,
 * a setTimeout takes turns with the other tasks.
 */
const yieldToPage = (): Promise<void> => {
    const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler;
    if (scheduler?.postTask) {
        return scheduler.postTask(() => {}, { priority: 'background' });
    }
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
};

/**
 * Starts building, in slices, the relevance index of the Bible, discarding
 * the previous one. The promise resolves when the index is ready or discarded.
 */
export function prepareSearchIndex(ebf: EbfDocument): Promise<void> {
    if (current?.ebf === ebf) return current.whenReady;

    const verses = getVerses(ebf);
    // Documents are positions in `verses`; the text is indexed already normalized
    const miniSearch = new MiniSearch<number>({
        fields: ['text'],
        extractField: (position, field) => {
            const verse = verses[position];
            return field === 'id' ? String(position) : verse ? foldedText(verse) : '';
        },
    });
    const index: RankedIndex = { ebf, miniSearch, ready: false, whenReady: Promise.resolve() };
    current = index;

    index.whenReady = (async () => {
        let position = 0;
        while (position < verses.length) {
            await yieldToPage();
            // Another Bible was chosen: abandon this index
            if (current !== index) return;
            const deadline = performance.now() + INDEX_SLICE_MS;
            do {
                miniSearch.add(position++);
            } while (position < verses.length && (position % 50 !== 0 || performance.now() < deadline));
        }
        index.ready = current === index;
    })();
    return index.whenReady;
}

/** The relevance index of the Bible is ready. */
export function isSearchIndexReady(ebf: EbfDocument): boolean {
    return current?.ebf === ebf && current.ready;
}

/**
 * Searches verses. With the index ready, all terms must appear (the last one
 * counts as a prefix, to search while typing; words with 4 letters or more
 * tolerate one typo) and results come by relevance, with the exact phrase
 * first, or, with `order: 'book'`, in Bible order (in which case they are the
 * first `maxResults` of the Bible, not the most relevant ones). Without the
 * index, searches for the exact phrase, in Bible order.
 */
export function searchVerses(
    ebf: EbfDocument,
    query: string,
    maxResults = MAX_SEARCH_RESULTS,
    order: SearchOrder = 'relevance',
): SearchResponse {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return { results: [], total: 0, ranked: false };

    return isSearchIndexReady(ebf) && current
        ? rankedSearch(getVerses(ebf), current.miniSearch, trimmed, maxResults, order)
        : phraseSearch(getVerses(ebf), trimmed, maxResults);
}

function phraseSearch(verses: readonly IndexedVerse[], query: string, maxResults: number): SearchResponse {
    const needle = foldText(query);
    const matches = verses.filter((verse) => foldedText(verse).includes(needle));
    return { results: matches.slice(0, maxResults).map(({ result }) => result), total: matches.length, ranked: false };
}

function rankedSearch(
    verses: readonly IndexedVerse[],
    miniSearch: MiniSearch<number>,
    query: string,
    maxResults: number,
    order: SearchOrder,
): SearchResponse {
    const phrase = foldText(query);
    const hits = miniSearch
        .search(query, {
            combineWith: 'AND',
            processTerm: foldText,
            prefix: (_term, i, terms) => i === terms.length - 1,
            fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
        })
        .map((hit) => {
            const verse = verses[Number(hit.id)];
            return { hit, verse, phrase: verse ? foldedText(verse).includes(phrase) : false };
        });

    if (order === 'book') {
        // The ids are positions in the Bible, already in book, chapter and verse order
        hits.sort((a, b) => Number(a.hit.id) - Number(b.hit.id));
    } else {
        // Exact phrase first; then by relevance
        hits.sort((a, b) => Number(b.phrase) - Number(a.phrase) || b.hit.score - a.hit.score);
    }

    const results = hits.slice(0, maxResults).flatMap(({ hit, verse }) =>
        verse ? [{ ...verse.result, terms: hit.terms }] : [],
    );
    return { results, total: hits.length, ranked: order === 'relevance' };
}

/**
 * Escapes the text for HTML and wraps in <mark> the words found by the
 * relevance search. Neighboring words (separated only by space or hyphen)
 * form a single highlight; short words ("os", "de") are only highlighted when
 * next to another highlighted word.
 */
export function highlightTerms(text: string, terms: readonly string[]): string {
    const wanted = new Set(terms);
    const words = Array.from(text.matchAll(WORD), (match) => {
        const folded = foldText(match[0]);
        return { start: match.index, end: match.index + match[0].length, folded, hit: wanted.has(folded) };
    });
    /** Word i and the next one are separated only by spaces or hyphens. */
    const joinsNext = (i: number): boolean => {
        const next = words[i + 1];
        return !!next && JOINABLE_GAP.test(text.slice(words[i]?.end, next.start));
    };
    const marked = words.map(
        (word, i) =>
            word.hit &&
            (word.folded.length >= 3 || (!!words[i - 1]?.hit && joinsNext(i - 1)) || (!!words[i + 1]?.hit && joinsNext(i))),
    );

    let html = '';
    let last = 0;
    for (let i = 0; i < words.length; i++) {
        if (!marked[i]) continue;
        let j = i;
        while (marked[j + 1] && joinsNext(j)) j++;
        const start = words[i]?.start ?? last;
        const end = words[j]?.end ?? start;
        html += `${escapeHtml(text.slice(last, start))}<mark>${escapeHtml(text.slice(start, end))}</mark>`;
        last = end;
        i = j;
    }
    return html + escapeHtml(text.slice(last));
}

/**
 * Normalizes the text character by character, keeping for each position of
 * the result its source position. map[folded.length] is the end of the
 * original text.
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
 * Escapes the text for HTML and wraps in <mark> the occurrences of the
 * searched phrase, with the same criteria as the phrase search (ignoring
 * accents and case).
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
