import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from '../../src/core/passage';
import { renderPassageText, renderReference } from '../../src/core/render';

const ebf: EbfDocument = {
    bible: {
        name: 'Teste <b>',
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
                            'Versículo em texto simples, "citado".',
                            { text: '' },
                            { text: 'Disse <Deus>: “Haja luz”.', title: 'Luz' },
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

describe('renderReference', () => {
    it('with no Bible loaded', () => {
        expect(renderReference('Gn 1', null, options(), '')).toEqual({
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>',
        });
    });

    it('invalid reference shows the instructions', () => {
        expect(renderReference('Gn', ebf, options(), '<p>ajuda</p>')).toEqual({ error: true, html: '<p>ajuda</p>' });
    });

    it('escapes the typed book name in the error message (prevents XSS via shared link)', () => {
        const result = renderReference('<img/src=x/onerror=alert(1)> 1', ebf, options(), '');
        expect(result.error).toBe(true);
        expect(result.html).not.toContain('<img');
        expect(result.html).toContain('&lt;img/src=x/onerror=alert(1)&gt;');
    });

    it('nonexistent chapter', () => {
        expect(renderReference('Gn 2', ebf, options(), '').html).toBe(
            '<span class="error">Capítulo 2 não encontrado em Gênesis.</span>',
        );
    });

    it('header with escaped chapter title and Bible name', () => {
        expect(renderReference('Gn 1,1', ebf, options(), '').html).toContain(
            '<div class="reference">Gênesis 1: A criação (Teste &lt;b&gt;)</div>',
        );
    });

    it('accepts plain-text verses and escapes the content', () => {
        const html = renderReference('Gn 1,2-4', ebf, options({ sectionTitles: false }), '').html;
        expect(html).toContain('<sup>2</sup> Versículo em texto simples, &quot;citado&quot;.');
        expect(html).toContain('<sup>4</sup> Disse &lt;Deus&gt;: “Haja luz”.');
        expect(html).not.toContain('<sup>3</sup>');
    });

    it('with quotes, replaces inner quotes with single quotes and wraps the passage', () => {
        const html = renderReference(
            'Gn 1,2.4',
            ebf,
            options({ quotes: true, verseNumbers: false, parenthesesCitation: false, lineBreaks: false, sectionTitles: false }),
            '',
        ).html;
        expect(html).toBe(
            '<div class="reference">Gênesis 1: A criação (Teste &lt;b&gt;)</div>' +
                `<div class="verse-text">"Versículo em texto simples, &#39;citado&#39;. [...] Disse &lt;Deus&gt;: &#39;Haja luz&#39;."</div>`,
        );
    });

    it('section title before the verse number', () => {
        expect(renderReference('Gn 1,1', ebf, options(), '').html).toContain(
            '<span class="section-title">Origem</span><sup>1</sup> No princípio.',
        );
    });

    it('compacted citation at the end', () => {
        expect(renderReference('Gn 1,1-2.4', ebf, options(), '').html).toContain(
            '<span class="verse-reference">(Gn 1,1-2.4)</span>',
        );
    });

    it('corrupted file does not crash the page', () => {
        const corrupted = { bible: { name: 'x', books: [{ names: ['A'], abbreviation: 'A', chapters: [{}] }] } };
        const result = renderReference('A 1', corrupted as unknown as EbfDocument, options(), '');
        expect(result).toEqual({
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>',
        });
    });
});

describe('renderPassageText', () => {
    const text = (reference: string, overrides: Partial<DisplayOptions> = {}) => {
        const { passage } = renderReference(reference, ebf, options(overrides), '');
        if (!passage) throw new Error('no passage');
        return renderPassageText(passage);
    };

    it('one line per verse, superscript numbers, citation at the end, without escaping', () => {
        expect(text('Gn 1,2-4', { sectionTitles: false })).toBe(
            '² Versículo em texto simples, "citado".\n⁴ Disse <Deus>: “Haja luz”.\n(Gn 1,2-4)\n',
        );
    });

    it('section titles in a paragraph of their own, without a blank line at the start', () => {
        expect(text('Gn 1,1-2.4')).toBe(
            'Origem\n\n¹ No princípio.\n² Versículo em texto simples, "citado".\n[...]\n\nLuz\n\n⁴ Disse <Deus>: “Haja luz”.\n(Gn 1,1-2.4)\n',
        );
    });

    it('without line breaks, section titles still have a paragraph of their own', () => {
        expect(text('Gn 1,1-4', { lineBreaks: false, parenthesesCitation: false })).toBe(
            'Origem\n\n¹ No princípio. ² Versículo em texto simples, "citado".\n\nLuz\n\n⁴ Disse <Deus>: “Haja luz”.',
        );
    });

    it('without line breaks and with quotes', () => {
        expect(text('Gn 1,2.4', { quotes: true, verseNumbers: false, parenthesesCitation: false, lineBreaks: false, sectionTitles: false })).toBe(
            `"Versículo em texto simples, 'citado'. [...] Disse <Deus>: 'Haja luz'."`,
        );
    });
});
