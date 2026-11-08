import { describe, expect, it } from 'vitest';
import { resolveCrossReferences } from '../../src/core/cross-references';
import type { EbfDocument } from '../../src/core/ebf';
import { buildPassage, DEFAULT_DISPLAY_OPTIONS } from '../../src/core/passage';
import { renderPassageHtml, renderPassageText } from '../../src/core/render';

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
                        verses: [
                            { text: 'No princípio.', references: [{ usfm_id: 'JHN', chapter: 1, verse: 1 }] },
                            'Sem referências.',
                        ],
                    },
                ],
            },
            {
                names: ['João'],
                abbreviation: 'Jo',
                usfm_id: 'JHN',
                chapters: [{ verses: ['No princípio era o Verbo.', 'Ele estava no princípio.', 'Tudo foi feito.'] }],
            },
        ],
    },
};

describe('resolveCrossReferences', () => {
    it('groups consecutive verses of the same chapter, keeping the order of the file', () => {
        const references = resolveCrossReferences(ebf, [
            { usfm_id: 'JHN', chapter: 1, verse: 1 },
            { usfm_id: 'JHN', chapter: 1, verse: 2 },
            { usfm_id: 'GEN', chapter: 1, verse: 1 },
            { usfm_id: 'jhn', chapter: 1, verse: 3 },
            { usfm_id: 'JHN', chapter: 1, verse: 1 },
        ]);
        expect(references).toEqual([
            { reference: 'Jo 1,1-2', text: 'No princípio era o Verbo. Ele estava no princípio.', available: true },
            { reference: 'Gn 1,1', text: 'No princípio.', available: true },
            { reference: 'Jo 1,1.3', text: 'No princípio era o Verbo. Tudo foi feito.', available: true },
        ]);
    });

    it('a book the Bible lacks is shown by its USFM id and cannot be opened', () => {
        expect(resolveCrossReferences(ebf, [{ usfm_id: 'TOB', chapter: 1, verse: 1 }])).toEqual([
            { reference: 'TOB 1,1', text: '', available: false },
        ]);
    });
});

describe('cross-references in the passage', () => {
    const build = (overrides = {}) => {
        const result = buildPassage('Gn 1', ebf, { ...DEFAULT_DISPLAY_OPTIONS, ...overrides });
        if (result.kind !== 'passage') throw new Error(result.kind);
        return result.passage;
    };

    it('only verses with cross-references carry them, with the reference of the verse', () => {
        const [first, second] = build().elements;
        expect(first).toMatchObject({
            crossReferences: { source: 'Gn 1,1', references: [{ usfm_id: 'JHN', chapter: 1, verse: 1 }] },
        });
        expect(second).not.toHaveProperty('crossReferences');
    });

    it('a balloon between the verse number and its text in the HTML, not in the copied text', () => {
        const passage = build({ quotes: true, parenthesesReference: false });
        const html = renderPassageHtml(passage);
        expect(html.match(/cross-references-button/g)).toHaveLength(1);
        expect(html).toMatch(
            /"<sup>1<\/sup><button type="button" class="cross-references-button" data-element="0"[^>]*><svg.*?<\/svg><\/button> No princípio\./,
        );
        expect(html).toContain('title="Referências cruzadas de Gn 1,1"');
        expect(renderPassageText(passage)).not.toContain('Referências');
    });

    it('without verse numbers, the balloon comes before the text of the verse', () => {
        const html = renderPassageHtml(build({ verseNumbers: false, parenthesesReference: false }));
        expect(html).toMatch(/<div class="verse-text"><button [^>]*cross-references-button[^>]*><svg.*?<\/svg><\/button> No princípio\./);
    });
});
