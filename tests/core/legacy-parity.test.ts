/**
 * Paridade com a implementação JavaScript anterior à migração para TypeScript.
 *
 * O fixture legacy-render.json foi gerado executando o código antigo
 * (assets/js/bibleUtils.js e bibleManager.js) sobre as Bíblias publicadas, com
 * dezenas de referências e combinações de opções de exibição. Mudanças
 * intencionais de comportamento devem atualizar o fixture explicitamente.
 */
import { describe, expect, it } from 'vitest';
import type { DisplayOptions } from '../../src/core/render';
import { renderReference } from '../../src/core/render';
import { formatVerseRanges, parseReference } from '../../src/core/reference';
import { loadBible, readFixture } from '../helpers';

interface LegacyFixture {
    instructions: string;
    optionSets: DisplayOptions[];
    cases: { bible: string | null; reference: string; options: number; error: boolean; html: string }[];
    parse: { reference: string; parsed: unknown }[];
    effective: { verses: number[]; output: string }[];
}

const fixture = JSON.parse(readFixture('legacy-render.json')) as LegacyFixture;

describe('paridade com a implementação legada', () => {
    it.each(fixture.parse)('parseReference($reference)', ({ reference, parsed }) => {
        expect(parseReference(reference)).toEqual(parsed);
    });

    it.each(fixture.effective)('formatVerseRanges($verses)', ({ verses, output }) => {
        expect(formatVerseRanges(verses)).toBe(output);
    });

    const withBible = fixture.cases.filter((c) => c.bible !== null);
    it(`renderiza ${withBible.length} casos idênticos ao legado`, () => {
        for (const c of withBible) {
            const options = fixture.optionSets[c.options];
            if (!options) throw new Error(`conjunto de opções ${c.options} inexistente`);
            const result = renderReference(c.reference, loadBible(c.bible ?? ''), { ...options }, fixture.instructions);
            expect(result, `${c.bible} | ${c.reference} | opções ${c.options}`).toEqual({ error: c.error, html: c.html });
        }
    });

    it('sem Bíblia carregada', () => {
        for (const c of fixture.cases.filter((c) => c.bible === null)) {
            const options = fixture.optionSets[0];
            if (!options) throw new Error('conjunto de opções 0 inexistente');
            expect(renderReference(c.reference, null, options, 'X')).toEqual({ error: c.error, html: c.html });
        }
    });
});
