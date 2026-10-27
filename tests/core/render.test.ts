import { describe, expect, it } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions, renderReference } from '../../src/core/render';

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

describe('renderReference', () => {
    it('sem Bíblia carregada', () => {
        expect(renderReference('Gn 1', null, options(), '')).toEqual({
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>',
        });
    });

    it('referência inválida mostra as instruções', () => {
        expect(renderReference('Gn', ebf, options(), '<p>ajuda</p>')).toEqual({ error: true, html: '<p>ajuda</p>' });
    });

    it('escapa o nome do livro digitado na mensagem de erro (evita XSS por link compartilhado)', () => {
        const result = renderReference('<img/src=x/onerror=alert(1)> 1', ebf, options(), '');
        expect(result.error).toBe(true);
        expect(result.html).not.toContain('<img');
        expect(result.html).toContain('&lt;img/src=x/onerror=alert(1)&gt;');
    });

    it('capítulo inexistente', () => {
        expect(renderReference('Gn 2', ebf, options(), '').html).toBe(
            '<span class="error">Capítulo 2 não encontrado em Gênesis.</span>',
        );
    });

    it('cabeçalho com título do capítulo e nome da Bíblia escapados', () => {
        expect(renderReference('Gn 1,1', ebf, options(), '').html).toContain(
            '<div class="reference">Gênesis 1: A criação (Teste &lt;b&gt;)</div>',
        );
    });

    it('aceita versículos em texto simples e escapa o conteúdo', () => {
        const html = renderReference('Gn 1,2-4', ebf, options({ sectionTitles: false }), '').html;
        expect(html).toContain('<sup>2</sup> Versículo em texto simples, &quot;citado&quot;.');
        expect(html).toContain('<sup>4</sup> Disse &lt;Deus&gt;: “Haja luz”.');
        expect(html).not.toContain('<sup>3</sup>');
    });

    it('com aspas, troca as aspas internas por simples e envolve o trecho', () => {
        const html = renderReference(
            'Gn 1,2.4',
            ebf,
            options({ quotes: true, verseNumbers: false, parenthesesCitation: false, lineBreaks: false }),
            '',
        ).html;
        expect(html).toBe(
            '<div class="reference">Gênesis 1: A criação (Teste &lt;b&gt;)</div>' +
                `<div class="verse-text">"Versículo em texto simples, 'citado'. [...] Disse &lt;Deus&gt;: 'Haja luz'."</div>`,
        );
    });

    it('título de seção antes do número do versículo', () => {
        expect(renderReference('Gn 1,1', ebf, options(), '').html).toContain(
            '<span class="section-title">Origem</span><sup>1</sup> No princípio.',
        );
    });

    it('citação compactada no final', () => {
        expect(renderReference('Gn 1,1-2.4', ebf, options(), '').html).toContain(
            '<span class="verse-reference">(Gn 1,1-2.4)</span>',
        );
    });

    it('arquivo corrompido não derruba a página', () => {
        const corrupted = { bible: { name: 'x', books: [{ names: ['A'], abbreviation: 'A', chapters: [{}] }] } };
        const result = renderReference('A 1', corrupted as unknown as EbfDocument, options(), '');
        expect(result).toEqual({
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>',
        });
    });
});
