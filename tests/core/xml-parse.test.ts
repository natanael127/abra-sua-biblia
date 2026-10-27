import { describe, expect, it } from 'vitest';
import { decodeEntities, descendants, nextSiblings, parseXml, textContent } from '../../src/core/xml/parse';

describe('decodeEntities', () => {
    it('decodifica as entidades do XML e as referências numéricas', () => {
        expect(decodeEntities('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;')).toBe(`<a> & "b" 'c'`);
        expect(decodeEntities('Jos&#233; &#xE9; &#X1F4D6;')).toBe('José é 📖');
    });

    it('decodifica numa única passada (&amp;#233; vira o texto "&#233;")', () => {
        expect(decodeEntities('&amp;#233;')).toBe('&#233;');
    });

    it('mantém entidades desconhecidas e códigos fora do Unicode', () => {
        expect(decodeEntities('&nbsp; &#x110000; &')).toBe('&nbsp; &#x110000; &');
    });
});

describe('parseXml', () => {
    const doc = parseXml('<r a="x &amp; y"><!-- c --><p>um <b>dois</b><![CDATA[ <três>]]></p><q/>fim</r>');
    const [root] = descendants(doc, 'r');

    it('mantém a ordem dos nós, separa o CDATA e descarta comentários', () => {
        expect(root?.children.map((node) => (node.type === 'element' ? node.name : node.type))).toEqual([
            'p',
            'q',
            'text',
        ]);
        expect(descendants(doc, 'p')[0]?.children.map((node) => node.type)).toEqual(['text', 'element', 'cdata']);
    });

    it('decodifica os atributos', () => {
        expect(root?.attributes).toEqual({ a: 'x & y' });
    });

    it('textContent inclui o CDATA e os descendentes', () => {
        expect(textContent(root!)).toBe('um dois <três>fim');
    });

    it('nextSiblings percorre os irmãos seguintes', () => {
        const p = descendants(doc, 'p')[0]!;
        expect([...nextSiblings(p)].map((node) => (node.type === 'element' ? node.name : textContent(node)))).toEqual([
            'q',
            'fim',
        ]);
        expect([...nextSiblings(doc)]).toEqual([]);
    });

    it('rejeita XML malformado com a posição do erro', () => {
        expect(() => parseXml('<a><b></a>')).toThrow(/XML parsing error/);
    });
});
