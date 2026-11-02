import { describe, expect, it } from 'vitest';
import { decodeEntities, descendants, nextSiblings, parseXml, textContent } from '../../src/core/xml/parse';

describe('decodeEntities', () => {
    it('decodes XML entities and numeric references', () => {
        expect(decodeEntities('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;')).toBe(`<a> & "b" 'c'`);
        expect(decodeEntities('Jos&#233; &#xE9; &#X1F4D6;')).toBe('José é 📖');
    });

    it('decodes in a single pass (&amp;#233; becomes the text "&#233;")', () => {
        expect(decodeEntities('&amp;#233;')).toBe('&#233;');
    });

    it('keeps unknown entities and out-of-Unicode code points', () => {
        expect(decodeEntities('&nbsp; &#x110000; &')).toBe('&nbsp; &#x110000; &');
    });
});

describe('parseXml', () => {
    const doc = parseXml('<r a="x &amp; y"><!-- c --><p>um <b>dois</b><![CDATA[ <três>]]></p><q/>fim</r>');
    const [root] = descendants(doc, 'r');

    it('keeps the node order, separates CDATA and discards comments', () => {
        expect(root?.children.map((node) => (node.type === 'element' ? node.name : node.type))).toEqual([
            'p',
            'q',
            'text',
        ]);
        expect(descendants(doc, 'p')[0]?.children.map((node) => node.type)).toEqual(['text', 'element', 'cdata']);
    });

    it('decodes the attributes', () => {
        expect(root?.attributes).toEqual({ a: 'x & y' });
    });

    it('textContent includes CDATA and descendants', () => {
        expect(textContent(root!)).toBe('um dois <três>fim');
    });

    it('nextSiblings walks the following siblings', () => {
        const p = descendants(doc, 'p')[0]!;
        expect([...nextSiblings(p)].map((node) => (node.type === 'element' ? node.name : textContent(node)))).toEqual([
            'q',
            'fim',
        ]);
        expect([...nextSiblings(doc)]).toEqual([]);
    });

    it('rejects malformed XML with the error position', () => {
        expect(() => parseXml('<a><b></a>')).toThrow(/XML parsing error/);
    });
});
