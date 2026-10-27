/**
 * Busca textual nos versículos, sem diferenciar maiúsculas nem acentos.
 *
 * A busca por relevância usa um índice do MiniSearch, montado em blocos de
 * ~10 ms para não travar a página (leva alguns segundos numa Bíblia completa). Enquanto o
 * índice não fica pronto, vale a busca por trecho, na ordem da Bíblia.
 */
import MiniSearch from 'minisearch';
import { type EbfDocument, getBookAbbreviation, getBookName, getVerseText } from './ebf';
import { escapeHtml } from './text';

export const MIN_QUERY_LENGTH = 3;
export const MAX_SEARCH_RESULTS = 200;

/** Tempo máximo de cada bloco da indexação antes de devolver o controle à página. */
const INDEX_SLICE_MS = 10;

export interface SearchResult {
    bookAbbr: string;
    bookName: string;
    chapter: number;
    verse: number;
    text: string;
    /** Palavras encontradas (normalizadas), para o destaque; só na busca por relevância. */
    terms?: string[];
}

export interface SearchResponse {
    results: SearchResult[];
    /** Total de versículos encontrados (pode passar do limite de resultados). */
    total: number;
    /** true: ordenados por relevância; false: busca por trecho, na ordem da Bíblia. */
    ranked: boolean;
}

const COMBINING_MARKS = /\p{M}/gu;
/** Palavras: o inverso do separador padrão do MiniSearch (espaços e pontuação). */
const WORD = /[^\n\r\p{Z}\p{P}]+/gu;
/** Separador que une palavras numa mesma marcação: só espaços e hífens. */
const JOINABLE_GAP = /^[\s\p{Z}\p{Pd}]+$/u;

/** Forma usada na comparação: sem acentos/cedilha e em minúsculas ("Coração" -> "coracao"). */
export function foldText(text: string): string {
    return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

interface IndexedVerse {
    /** Texto normalizado, calculado sob demanda (ver foldedText). */
    folded?: string;
    result: SearchResult;
}

const foldedText = (verse: IndexedVerse): string => (verse.folded ??= foldText(verse.result.text));

/** Versículos da Bíblia, listados uma vez por Bíblia carregada. */
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

/** Só a Bíblia em uso tem índice (cerca de 100 MB numa Bíblia completa). */
let current: RankedIndex | null = null;

interface Scheduler {
    postTask?: (callback: () => void, options: { priority: 'background' }) => Promise<void>;
}

/**
 * Devolve o controle à página. Com scheduler.postTask, a indexação roda em
 * prioridade baixa, depois de interações e timers (digitação, mensagens);
 * sem ele, um setTimeout reveza com as demais tarefas.
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
 * Começa a montar, em blocos, o índice de relevância da Bíblia, descartando o
 * da anterior. A promessa resolve quando o índice fica pronto ou é descartado.
 */
export function prepareSearchIndex(ebf: EbfDocument): Promise<void> {
    if (current?.ebf === ebf) return current.whenReady;

    const verses = getVerses(ebf);
    // Documentos são as posições em `verses`; o texto é indexado já normalizado
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
            // Outra Bíblia foi escolhida: abandona este índice
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

/** O índice de relevância da Bíblia está pronto. */
export function isSearchIndexReady(ebf: EbfDocument): boolean {
    return current?.ebf === ebf && current.ready;
}

/**
 * Busca versículos. Com o índice pronto, todos os termos precisam aparecer
 * (o último vale como prefixo, para buscar enquanto digita; palavras com 4
 * letras ou mais toleram um erro de digitação) e os resultados vêm por
 * relevância, com a frase exata primeiro. Sem o índice, busca o trecho exato,
 * na ordem da Bíblia.
 */
export function searchVerses(ebf: EbfDocument, query: string, maxResults = MAX_SEARCH_RESULTS): SearchResponse {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return { results: [], total: 0, ranked: false };

    return isSearchIndexReady(ebf) && current
        ? rankedSearch(getVerses(ebf), current.miniSearch, trimmed, maxResults)
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

    // Frase exata primeiro; depois, por relevância
    hits.sort((a, b) => Number(b.phrase) - Number(a.phrase) || b.hit.score - a.hit.score);

    const results = hits.slice(0, maxResults).flatMap(({ hit, verse }) =>
        verse ? [{ ...verse.result, terms: hit.terms }] : [],
    );
    return { results, total: hits.length, ranked: true };
}

/**
 * Escapa o texto para HTML e envolve em <mark> as palavras encontradas pela
 * busca por relevância. Palavras vizinhas (separadas só por espaço ou hífen)
 * formam uma só marcação; palavras curtas ("os", "de") só são marcadas
 * quando vizinhas de outra marcada.
 */
export function highlightTerms(text: string, terms: readonly string[]): string {
    const wanted = new Set(terms);
    const words = Array.from(text.matchAll(WORD), (match) => {
        const folded = foldText(match[0]);
        return { start: match.index, end: match.index + match[0].length, folded, hit: wanted.has(folded) };
    });
    /** A palavra i e a seguinte estão separadas só por espaços ou hífens. */
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
 * Escapa o texto para HTML e envolve em <mark> as ocorrências do trecho
 * buscado, com os mesmos critérios da busca por trecho (sem acentos e maiúsculas).
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
