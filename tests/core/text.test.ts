import { describe, expect, it } from 'vitest';
import { escapeHtml, toSingleQuotes } from '../../src/core/text';

describe('escapeHtml', () => {
    it('escapa os caracteres especiais de HTML', () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    });
});

describe('toSingleQuotes', () => {
    it.each(['"', '&quot;', '“', '”', '„', '‟', '«', '»'])(
        'troca %s por aspas simples',
        (quote) => {
            expect(toSingleQuotes(`${quote}texto${quote}`)).toBe("'texto'");
        },
    );
});
