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
                        comment: 'Comentário do capítulo.',
                        verses: [
                            { text: 'No princípio.', references: [{ usfm_id: 'JHN', chapter: 1, verse: 1 }] },
                            'Sem referências.',
                            { text: 'Só comentário.', comment: 'Comentário do versículo.\nSegunda linha.' },
                            { text: 'Ambos.', comment: 'Comentário e referências.', references: [{ usfm_id: 'JHN', chapter: 1, verse: 2 }] },
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

describe('notes (comments and cross-references) in the passage', () => {
    const build = (overrides = {}) => {
        const result = buildPassage('Gn 1', ebf, { ...DEFAULT_DISPLAY_OPTIONS, ...overrides });
        if (result.kind !== 'passage') throw new Error(result.kind);
        return result.passage;
    };

    it('only verses with cross-references or a comment carry notes, with the reference of the verse', () => {
        const notes = build()
            .elements.filter((element) => element.type === 'verse')
            .map((element) => element.notes);
        expect(notes).toEqual([
            { source: 'Gn 1,1', references: [{ usfm_id: 'JHN', chapter: 1, verse: 1 }] },
            undefined,
            { source: 'Gn 1,3', comment: 'Comentário do versículo.\nSegunda linha.' },
            { source: 'Gn 1,4', comment: 'Comentário e referências.', references: [{ usfm_id: 'JHN', chapter: 1, verse: 2 }] },
        ]);
    });

    it('the comment of the chapter is in the passage, with the reference of the chapter', () => {
        expect(build().chapterNotes).toEqual({ source: 'Gn 1', comment: 'Comentário do capítulo.' });
    });

    it('a balloon between the verse number and its text in the HTML, not in the copied text', () => {
        const passage = build({ quotes: true, parenthesesReference: false });
        const html = renderPassageHtml(passage);
        expect(html.match(/class="notes-button" data-element/g)).toHaveLength(3);
        expect(html).toMatch(
            /"<sup>1<\/sup><button type="button" class="notes-button" data-element="0"[^>]*><svg.*?<\/svg><\/button> No princípio\./,
        );
        expect(html).toContain('title="Referências cruzadas e comentários de Gn 1,1"');
        expect(renderPassageText(passage)).not.toMatch(/Referências|Comentário/);
    });

    it('without verse numbers, the balloon comes before the text of the verse', () => {
        const html = renderPassageHtml(build({ verseNumbers: false, parenthesesReference: false }));
        expect(html).toMatch(/<div class="verse-text"><button [^>]*notes-button[^>]*><svg.*?<\/svg><\/button> No princípio\./);
    });

    it('the balloon of the chapter comment comes before the heading', () => {
        const html = renderPassageHtml(build());
        expect(html).toMatch(
            /<div class="passage-heading"><button type="button" class="notes-button" data-chapter title="Comentários de Gn 1"[^>]*><svg.*?<\/svg><\/button> Gênesis 1 \(Teste\)<\/div>/,
        );
    });

    it('a chapter without a comment has no balloon in the heading', () => {
        const result = buildPassage('Jo 1', ebf, DEFAULT_DISPLAY_OPTIONS);
        if (result.kind !== 'passage') throw new Error(result.kind);
        expect(result.passage).not.toHaveProperty('chapterNotes');
        expect(renderPassageHtml(result.passage)).not.toContain('data-chapter');
    });
});
