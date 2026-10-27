import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import { foldText, highlightMatches, searchVerses } from '../../src/core/search';
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

describe('foldText', () => {
    it('remove acentos e cedilha e ignora maiúsculas', () => {
        expect(foldText('Coração, ÁGUA, pão, Senhor, ü')).toBe('coracao, agua, pao, senhor, u');
    });
});

describe('searchVerses', () => {
    it('encontra sem diferenciar maiúsculas, inclusive versículos em texto simples', () => {
        expect(searchVerses(ebf, 'luz')).toEqual([
            { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 1, text: 'Haja LUZ.' },
            { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 2, text: 'E houve luz.' },
            { bookAbbr: 'Joã', bookName: 'João', chapter: 1, verse: 1, text: 'A luz brilha nas trevas.' },
        ]);
    });

    it.each(['coracao', 'CORAÇÃO', 'coraçao', 'puros de coracão'])('ignora acentos: "%s"', (query) => {
        expect(searchVerses(ebf, query).map((r) => r.text)).toEqual(['Felizes os puros de coração.']);
    });

    it('exige ao menos 3 caracteres', () => {
        expect(searchVerses(ebf, 'lu')).toEqual([]);
    });

    it('limita a quantidade de resultados', () => {
        expect(searchVerses(ebf, 'luz', 2)).toHaveLength(2);
    });

    it('limita a 200 resultados numa Bíblia completa', () => {
        expect(searchVerses(loadBible('pt_ave_maria'), 'senhor')).toHaveLength(200);
    });

    it('encontra numa Bíblia completa digitando sem acento', () => {
        const results = searchVerses(loadBible('pt_ave_maria'), 'bem-aventurados os puros de coracao');
        expect(results.map((r) => `${r.bookAbbr} ${r.chapter},${r.verse}`)).toEqual(['Mt 5,8']);
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
