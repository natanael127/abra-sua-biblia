import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
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

/** Bíblia nova a cada chamada: o índice é guardado por documento. */
const smallBible = (): EbfDocument => structuredClone(ebf);

const refs = (response: { results: { bookAbbr: string; chapter: number; verse: number }[] }) =>
    response.results.map((r) => `${r.bookAbbr} ${r.chapter},${r.verse}`);

describe('foldText', () => {
    it('remove acentos e cedilha e ignora maiúsculas', () => {
        expect(foldText('Coração, ÁGUA, pão, Senhor, ü')).toBe('coracao, agua, pao, senhor, u');
    });
});

describe('searchVerses antes de o índice ficar pronto (busca por trecho)', () => {
    it('encontra sem diferenciar maiúsculas, na ordem da Bíblia', () => {
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

    it.each(['coracao', 'CORAÇÃO', 'coraçao', 'puros de coracão'])('ignora acentos: "%s"', (query) => {
        expect(searchVerses(smallBible(), query).results.map((r) => r.text)).toEqual(['Felizes os puros de coração.']);
    });

    it('exige ao menos 3 caracteres', () => {
        expect(searchVerses(smallBible(), ' lu ')).toEqual({ results: [], total: 0, ranked: false });
    });

    it('limita a quantidade de resultados, informando o total', () => {
        const response = searchVerses(smallBible(), 'luz', 2);
        expect(response.results).toHaveLength(2);
        expect(response.total).toBe(3);
    });
});

describe('searchVerses com o índice pronto (busca por relevância)', () => {
    it('monta o índice e passa a ordenar por relevância', async () => {
        const bible = smallBible();
        expect(isSearchIndexReady(bible)).toBe(false);
        await prepareSearchIndex(bible);
        expect(isSearchIndexReady(bible)).toBe(true);

        const response = searchVerses(bible, 'luz');
        expect(response.ranked).toBe(true);
        expect(response.total).toBe(3);
        // Versículo mais curto pesa mais (BM25)
        expect(refs(response)[0]).toBe('Gn 1,1');
        expect(response.results[0]?.terms).toEqual(['luz']);
    });

    it('exige todos os termos, em qualquer ordem', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        expect(refs(searchVerses(bible, 'trevas luz'))).toEqual(['Joã 1,1']);
        expect(searchVerses(bible, 'luz coração').total).toBe(0);
    });

    it('a última palavra vale como prefixo (busca enquanto digita)', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        expect(refs(searchVerses(bible, 'puros de cora'))).toEqual(['Joã 1,2']);
        // Só a última: "pur" no meio da busca não é prefixo
        expect(searchVerses(bible, 'pur de coração').total).toBe(0);
    });

    it('tolera um erro de digitação em palavras com 4 letras ou mais', async () => {
        const bible = smallBible();
        await prepareSearchIndex(bible);
        // Uma letra trocada ou faltando (distância de edição 1)
        expect(refs(searchVerses(bible, 'trevaz brilha'))).toEqual(['Joã 1,1']);
        expect(refs(searchVerses(bible, 'brilha nas trvas'))).toEqual(['Joã 1,1']);
        // Palavras curtas não: "lus" não encontra "luz"
        expect(searchVerses(bible, 'lus trevas').total).toBe(0);
    });

    it('a frase exata vem antes, mesmo com pontuação menor', async () => {
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

    it('trocar de Bíblia abandona o índice da anterior', async () => {
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

    describe('numa Bíblia completa', () => {
        const bible = loadBible('por_ave_maria');

        it('indexa em blocos e encontra por relevância', { timeout: 60_000 }, async () => {
            await prepareSearchIndex(bible);
            expect(refs(searchVerses(bible, 'bem-aventurados os puros de coracao'))[0]).toBe('Mt 5,8');
            expect(refs(searchVerses(bible, 'Deus amou o mundo'))[0]).toBe('Jo 3,16');
            expect(refs(searchVerses(bible, 'bem-aventurados os mansos'))).toEqual(['Mt 5,5']);

            const many = searchVerses(bible, 'senhor');
            expect(many.results).toHaveLength(200);
            expect(many.total).toBeGreaterThan(200);
        });
    });
});

describe('highlightTerms', () => {
    it('marca as palavras encontradas, preservando acentos e maiúsculas', () => {
        expect(highlightTerms('Felizes os puros de Coração!', ['puros', 'coracao'])).toBe(
            'Felizes os <mark>puros</mark> de <mark>Coração</mark>!',
        );
    });

    it('junta palavras vizinhas e marca palavras curtas só entre elas', () => {
        expect(
            highlightTerms('Bem-aventurados os mansos, os pobres', ['bem', 'aventurados', 'os', 'mansos', 'de']),
        ).toBe('<mark>Bem-aventurados os mansos</mark>, os pobres');
    });

    it('funciona com acentos compostos (NFD) e escapa o HTML', () => {
        const decomposed = 'coração'.normalize('NFD');
        expect(highlightTerms(`<b> ${decomposed}`, ['coracao'])).toBe(`&lt;b&gt; <mark>${decomposed}</mark>`);
        expect(highlightTerms('<b>x</b>', ['zzz'])).toBe('&lt;b&gt;x&lt;/b&gt;');
    });
});

describe('highlightMatches', () => {
    it('marca as ocorrências preservando o texto original', () => {
        expect(highlightMatches('Haja LUZ e luz', 'luz')).toBe('Haja <mark>LUZ</mark> e <mark>luz</mark>');
    });

    it('marca o texto acentuado quando a busca não tem acento', () => {
        expect(highlightMatches('Puros de coração, ó coração!', 'coracao')).toBe(
            'Puros de <mark>coração</mark>, ó <mark>coração</mark>!',
        );
    });

    it('funciona com acentos compostos (NFD) no texto', () => {
        const decomposed = 'coração'.normalize('NFD');
        expect(highlightMatches(`o ${decomposed}`, 'coracao')).toBe(`o <mark>${decomposed}</mark>`);
    });

    it('escapa o HTML do texto e da busca', () => {
        expect(highlightMatches('a (b) <c> a.b & d', '<c>')).toBe('a (b) <mark>&lt;c&gt;</mark> a.b &amp; d');
        expect(highlightMatches('a (b) <c> a.b', '(b)')).toBe('a <mark>(b)</mark> &lt;c&gt; a.b');
        expect(highlightMatches('a (b) <c> a.b', 'a.b')).toBe('a (b) &lt;c&gt; <mark>a.b</mark>');
    });

    it('sem ocorrências, apenas escapa', () => {
        expect(highlightMatches('<b>x</b>', 'zzz')).toBe('&lt;b&gt;x&lt;/b&gt;');
    });
});
