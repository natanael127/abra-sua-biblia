import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import { buildPassage, DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from '../../src/core/passage';

const ebf: EbfDocument = {
    bible: {
        name: 'Teste',
        books: [
            {
                names: ['Gênesis'],
                abbreviation: 'Gn',
                usfm_id: 'GEN',
                chapters: [
                    {
                        title: 'A criação',
                        verses: [
                            { text: 'No princípio.', title: 'Origem' },
                            'Versículo "citado".',
                            { text: '', title: 'Título de versículo vazio' },
                            { text: 'Disse <Deus>: “Haja luz”.' },
                        ],
                    },
                ],
            },
        ],
    },
};

const options = (overrides: Partial<DisplayOptions> = {}): DisplayOptions => ({
    ...DEFAULT_DISPLAY_OPTIONS,
    ...overrides,
});

const passage = (reference: string, overrides: Partial<DisplayOptions> = {}) => {
    const result = buildPassage(reference, ebf, options(overrides));
    if (result.kind !== 'passage') throw new Error(`no passage: ${result.kind}`);
    return result.passage;
};

describe('buildPassage', () => {
    it('elements in reading order, with raw (unescaped) texts', () => {
        expect(passage('Gn 1,1-2.4')).toEqual({
            heading: 'Gênesis 1: A criação (Teste)',
            quoted: false,
            lineBreaks: true,
            elements: [
                { type: 'title', text: 'Origem' },
                { type: 'verse', number: 1, text: 'No princípio.' },
                { type: 'verse', number: 2, text: 'Versículo "citado".' },
                { type: 'omission', text: '[...]' },
                { type: 'verse', number: 4, text: 'Disse <Deus>: “Haja luz”.' },
                { type: 'citation', text: 'Gn 1,1-2.4' },
            ],
        });
    });

    it('options turned off leave their elements out', () => {
        expect(
            passage('Gn 1,1.4', {
                verseNumbers: false,
                ellipsis: false,
                sectionTitles: false,
                parenthesesCitation: false,
                lineBreaks: false,
            }),
        ).toMatchObject({
            lineBreaks: false,
            elements: [
                { type: 'verse', text: 'No princípio.' },
                { type: 'verse', text: 'Disse <Deus>: “Haja luz”.' },
            ],
        });
        expect(passage('Gn 1,1', { verseNumbers: false }).elements[1]).not.toHaveProperty('number');
    });

    it('with quotes, inner double quotes become single quotes', () => {
        const quoted = passage('Gn 1,2-4', { quotes: true });
        expect(quoted.quoted).toBe(true);
        expect(quoted.elements.filter((element) => element.type === 'verse').map((element) => element.text)).toEqual([
            "Versículo 'citado'.",
            "Disse <Deus>: 'Haja luz'.",
        ]);
    });

    it('a verse without text is left out with its title, without an omission marker', () => {
        expect(passage('Gn 1,2-4').elements.map((element) => element.type)).toEqual(['verse', 'verse', 'citation']);
    });

    it('whole chapter: citation without verses', () => {
        expect(passage('Gn 1').elements.at(-1)).toEqual({ type: 'citation', text: 'Gn 1' });
    });

    it('errors and invalid reference', () => {
        expect(buildPassage('Gn', ebf, options())).toEqual({ kind: 'invalid-reference' });
        expect(buildPassage('Gn 2', ebf, options())).toEqual({
            kind: 'error',
            html: '<span class="error">Capítulo 2 não encontrado em Gênesis.</span>',
        });
        expect(buildPassage('Gn 1', null, options()).kind).toBe('error');
    });
});
