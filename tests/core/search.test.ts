import { describe, expect, it } from 'vitest';
import { type EbfDocument, getBookAbbreviation } from '../../src/core/ebf';
import {
    foldText,
    highlightMatches,
    highlightTerms,
    isSearchIndexReady,
    prepareSearchIndex,
    searchVerses,
} from '../../src/core/search';
import { loadBible } from '../helpers';

const ebf: EbfDocument = {
    bible: {
        name: 'Teste',
        books: [
            {
                names: ['Gênesis'],
                abbreviation: 'Gn',
                chapters: [{ verses: [{ text: 'Haja LUZ.' }, 'E houve luz.'] }, { verses: [{ text: 'Sem nada.' }] }],
            },
            {
                names: ['João'],
                chapters: [{ verses: [{ text: 'A luz brilha nas trevas.' }, { text: 'Felizes os puros de coração.' }] }],
            },
        ],
    },
};

/** A new Bible on every call: the index is kept per document. */
const smallBible = (): EbfDocument => structuredClone(ebf);

const refs = (response: { results: { bookAbbr: string; chapter: number; verse: number }[] }) =>
    response.results.map((r) => `${r.bookAbbr} ${r.chapter},${r.verse}`);

describe('foldText', () => {
    it('removes accents and cedilla and ignores case', () => {
        expect(foldText('Coração, ÁGUA, pão, Senhor, ü')).toBe('coracao, agua, pao, senhor, u');
    });
});

describe('searchVerses before the index is ready (phrase search)', () => {
    it('finds ignoring case, in Bible order', () => {
        expect(searchVerses(smallBible(), 'luz')).toEqual({
            results: [
                { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 1, text: 'Haja LUZ.' },
                { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 2, text: 'E houve luz.' },
                { bookAbbr: 'Joã', bookName: 'João', chapter: 1, verse: 1, text: 'A luz brilha nas trevas.' },
            ],
            total: 3,
            ranked: false,
        });
    });

    it.each(['coracao', 'CORAÇÃO', 'coraçao', 'puros de coracão'])('ignores accents: "%s"', (query) => {
        expect(searchVerses(smallBible(), query).results.map((r) => r.text)).toEqual(['Felizes os puros de coração.']);
    });

    it('requires at least 3 characters', () => {
        expect(searchVerses(smallBible(), ' lu ')).toEqual({ results: [], total: 0, ranked: false });
    });

    it('limits the number of results, reporting the total', () => {
        const response = searchVerses(smallBible(), 'luz', 2);
        expect(response.results).toHaveLength(2);
        expect(response.total).toBe(3);
    });
});

describe('searchVerses with the index ready (relevance search)', () => {
    it('builds the index and starts sorting by relevance', async () => {
        const bible = smallBible();
        expect(isSearchIndexReady(bible)).toBe(false);
        await prepareSearchIndex(bible);
        expect(isSearchIndexReady(bible)).toBe(true);

        const response = searchVerses(bible, 'luz');
        expect(response.ranked).toBe(true);
        expect(response.total).toBe(3);
        // A shorter verse weighs more (BM25)
        expect(refs(response)[0]).toBe('Gn 1,1');
        expect(response.results[0]?.terms).toEqual(['luz']);
    });

    it('in book order, lists the verses in Bible order, with the same terms', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);

        const response = searchVerses(bible, 'luz', undefined, 'book');
        expect(refs(response)).toEqual(['Gn 1,1', 'Gn 1,2', 'Joã 1,1']);
        expect(response.total).toBe(3);
        expect(response.ranked).toBe(false);
        expect(response.results[0]?.terms).toEqual(['luz']);
    });

    it('in book order, relevance does not affect the order', async () => {
        const bible: EbfDocument = {
            bible: {
                name: 'Teste',
                books: [
                    { names: ['Primeiro'], abbreviation: 'P', chapters: [{ verses: ['Um versículo bem longo que fala da luz só uma vez, no meio de muitas outras palavras.'] }] },
                    { names: ['Segundo'], abbreviation: 'S', chapters: [{ verses: ['Luz!', 'Luz, luz.'] }] },
                ],
            },
        };
        await prepareSearchIndex(bible);

        expect(refs(searchVerses(bible, 'luz'))[0]).not.toBe('P 1,1');
        expect(refs(searchVerses(bible, 'luz', undefined, 'book'))).toEqual(['P 1,1', 'S 1,1', 'S 1,2']);
    });

    it('requires all terms, in any order', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        expect(refs(searchVerses(bible, 'trevas luz'))).toEqual(['Joã 1,1']);
        expect(searchVerses(bible, 'luz coração').total).toBe(0);
    });

    it('the last word counts as a prefix (search while typing)', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        expect(refs(searchVerses(bible, 'puros de cora'))).toEqual(['Joã 1,2']);
        // Only the last one: "pur" in the middle of the query is not a prefix
        expect(searchVerses(bible, 'pur de coração').total).toBe(0);
    });

    it('tolerates one typo in words with 4 letters or more', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        // One letter swapped or missing (edit distance 1)
        expect(refs(searchVerses(bible, 'trevaz brilha'))).toEqual(['Joã 1,1']);
        expect(refs(searchVerses(bible, 'brilha nas trvas'))).toEqual(['Joã 1,1']);
        // Not for short words: "lus" does not find "luz"
        expect(searchVerses(bible, 'lus trevas').total).toBe(0);
    });

    it('the exact phrase comes first, even with a lower score', async () => {
        const bible: EbfDocument = {
            bible: {
                name: 'Frase',
                books: [
                    {
                        names: ['Livro'],
                        abbreviation: 'Lv',
                        chapters: [
                            {
                                verses: [
                                    'Mansos, mansos, os mansos; bem e aventurados.',
                                    'Bem-aventurados os mansos, porque possuirão a terra prometida por Deus.',
                                ],
                            },
                        ],
                    },
                ],
            },
        };
        await prepareSearchIndex(bible);
        expect(refs(searchVerses(bible, 'bem-aventurados os mansos'))).toEqual(['Lv 1,2', 'Lv 1,1']);
    });

    it('switching Bibles abandons the previous index', async () => {
        const first = loadBible('por_cnbb');
        const second = smallBible();
        const firstReady = prepareSearchIndex(first);
        const secondReady = prepareSearchIndex(second);

        await firstReady;
        expect(isSearchIndexReady(first)).toBe(false);
        expect(searchVerses(first, 'luz').ranked).toBe(false);
        await secondReady;
        expect(isSearchIndexReady(second)).toBe(true);
    });

    describe('on a full Bible', () => {
        const bible = loadBible('por_ave_maria');

        it('indexes in slices and finds by relevance', { timeout: 60_000 }, async () => {
            await prepareSearchIndex(bible);
            expect(refs(searchVerses(bible, 'bem-aventurados os puros de coracao'))[0]).toBe('Mt 5,8');
            expect(refs(searchVerses(bible, 'Deus amou o mundo'))[0]).toBe('Jo 3,16');
            expect(refs(searchVerses(bible, 'bem-aventurados os mansos'))).toEqual(['Mt 5,5']);

            const many = searchVerses(bible, 'senhor');
            expect(many.results).toHaveLength(200);
            expect(many.total).toBeGreaterThan(200);

            // By book: the first 200 of the Bible, in ascending order of position
            const byBook = searchVerses(bible, 'senhor', undefined, 'book');
            expect(byBook.results).toHaveLength(200);
            expect(byBook.total).toBe(many.total);
            expect(byBook.ranked).toBe(false);
            const books = bible.bible.books.map(getBookAbbreviation);
            const positions = byBook.results.map(
                (r) => books.indexOf(r.bookAbbr) * 1e6 + r.chapter * 1e3 + r.verse,
            );
            expect(positions).toEqual([...positions].sort((a, b) => a - b));
        });
    });
});

describe('highlightTerms', () => {
    it('highlights the found words, preserving accents and case', () => {
        expect(highlightTerms('Felizes os puros de Coração!', ['puros', 'coracao'])).toBe(
            'Felizes os <mark>puros</mark> de <mark>Coração</mark>!',
        );
    });

    it('joins neighboring words and highlights short words only between them', () => {
        expect(
            highlightTerms('Bem-aventurados os mansos, os pobres', ['bem', 'aventurados', 'os', 'mansos', 'de']),
        ).toBe('<mark>Bem-aventurados os mansos</mark>, os pobres');
    });

    it('works with decomposed accents (NFD) and escapes HTML', () => {
        const decomposed = 'coração'.normalize('NFD');
        expect(highlightTerms(`<b> ${decomposed}`, ['coracao'])).toBe(`&lt;b&gt; <mark>${decomposed}</mark>`);
        expect(highlightTerms('<b>x</b>', ['zzz'])).toBe('&lt;b&gt;x&lt;/b&gt;');
    });
});

describe('highlightMatches', () => {
    it('highlights the occurrences preserving the original text', () => {
        expect(highlightMatches('Haja LUZ e luz', 'luz')).toBe('Haja <mark>LUZ</mark> e <mark>luz</mark>');
    });

    it('highlights accented text when the query has no accent', () => {
        expect(highlightMatches('Puros de coração, ó coração!', 'coracao')).toBe(
            'Puros de <mark>coração</mark>, ó <mark>coração</mark>!',
        );
    });

    it('works with decomposed accents (NFD) in the text', () => {
        const decomposed = 'coração'.normalize('NFD');
        expect(highlightMatches(`o ${decomposed}`, 'coracao')).toBe(`o <mark>${decomposed}</mark>`);
    });

    it('escapes the HTML of the text and of the query', () => {
        expect(highlightMatches('a (b) <c> a.b & d', '<c>')).toBe('a (b) <mark>&lt;c&gt;</mark> a.b &amp; d');
        expect(highlightMatches('a (b) <c> a.b', '(b)')).toBe('a <mark>(b)</mark> &lt;c&gt; a.b');
        expect(highlightMatches('a (b) <c> a.b', 'a.b')).toBe('a (b) &lt;c&gt; <mark>a.b</mark>');
    });

    it('with no occurrences, only escapes', () => {
        expect(highlightMatches('<b>x</b>', 'zzz')).toBe('&lt;b&gt;x&lt;/b&gt;');
    });
});
