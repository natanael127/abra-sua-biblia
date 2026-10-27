import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import { highlightQuery, searchVerses } from '../../src/core/search';
import { escapeHtml } from '../../src/core/text';
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
            { names: ['João'], chapters: [{ verses: [{ text: 'A luz brilha nas trevas.' }] }] },
        ],
    },
};

describe('searchVerses', () => {
    it('encontra sem diferenciar maiúsculas, inclusive versículos em texto simples', () => {
        expect(searchVerses(ebf, 'luz')).toEqual([
            { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 1, text: 'Haja LUZ.' },
            { bookAbbr: 'Gn', bookName: 'Gênesis', chapter: 1, verse: 2, text: 'E houve luz.' },
            { bookAbbr: 'Joã', bookName: 'João', chapter: 1, verse: 1, text: 'A luz brilha nas trevas.' },
        ]);
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
});

describe('highlightQuery', () => {
    it('marca as ocorrências preservando maiúsculas', () => {
        expect(highlightQuery('Haja LUZ e luz', 'luz')).toBe('Haja <mark>LUZ</mark> e <mark>luz</mark>');
    });

    it('trata caracteres especiais de regex e de HTML na busca', () => {
        const text = escapeHtml('a (b) <c> a.b');
        expect(highlightQuery(text, '(b)')).toBe('a <mark>(b)</mark> &lt;c&gt; a.b');
        expect(highlightQuery(text, '<c>')).toBe('a (b) <mark>&lt;c&gt;</mark> a.b');
        expect(highlightQuery(text, 'a.b')).toBe('a (b) &lt;c&gt; <mark>a.b</mark>');
    });
});
