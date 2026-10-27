/**
 * O legacy-expected.json foi gerado executando o conversor anterior
 * (assets/js/xmlBibles.js) sobre os mesmos arquivos de exemplo. A única
 * diferença intencional é bible.language, agora em ISO 639-3.
 *
 * O edge-expected.json foi gerado pela versão com o DOMParser do navegador,
 * antes da troca pelo fast-xml-parser: entidades, referências numéricas,
 * CDATA, comentários, notas e espaços. Os testes rodam no Node, sem DOM.
 */
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import ebf1Schema from 'easy-bible-format/ebf1-schema.json';
import { type EbfDocument, validateEbf } from '../../src/core/ebf';
import { convertOsisToEbf, convertUsfxToEbf, convertXmlToEbf, detectXmlFormat } from '../../src/core/xml';
import { readFixture } from '../helpers';

const legacy = JSON.parse(readFixture('xml/legacy-expected.json')) as Record<string, { ok?: unknown; error?: string }>;
const xml = (name: string) => readFixture(`xml/${name}`);
const validateSchema = new Ajv({ allErrors: true }).compile(ebf1Schema);

/** Saída do conversor legado com o idioma em ISO 639-3. */
const expected = (file: string, language: string) => {
    const legacyEbf = structuredClone(legacy[file]?.ok) as EbfDocument;
    return { bible: { name: legacyEbf.bible.name, language, books: legacyEbf.bible.books } };
};

describe('detectXmlFormat', () => {
    it.each([
        ['sample.osis.xml', 'osis'],
        ['sample.usfx.xml', 'usfx'],
        ['unknown.xml', 'unknown'],
        ['broken.xml', 'unknown'],
    ])('%s -> %s', (file, format) => {
        expect(detectXmlFormat(xml(file))).toBe(format);
    });
});

describe('convertXmlToEbf', () => {
    it.each(['sample.osis.xml', 'sample.usfx.xml'])('%s: igual ao conversor legado, com idioma ISO 639-3', (file) => {
        const ebf = convertXmlToEbf(xml(file));
        expect(ebf).toEqual(expected(file, 'por'));
        expect(validateEbf(ebf)).toEqual([]);
    });

    it('USFX convertido segue o schema oficial', () => {
        validateSchema(convertXmlToEbf(xml('sample.usfx.xml')));
        expect(validateSchema.errors ?? []).toEqual([]);
    });

    it('OSIS convertido só diverge do schema no livro sem código USFM', () => {
        validateSchema(convertXmlToEbf(xml('sample.osis.xml')));
        expect(validateSchema.errors?.map((e) => e.instancePath)).toEqual(['/bible/books/2/usfm_id']);
    });

    it.each(['unknown.xml', 'broken.xml'])('%s: rejeita formato não suportado', (file) => {
        expect(() => convertXmlToEbf(xml(file))).toThrow(legacy[file]?.error);
    });
});

describe('casos de borda (igual ao DOMParser)', () => {
    const edge = JSON.parse(readFixture('xml/edge-expected.json')) as Record<string, EbfDocument>;

    it.each(['edge.osis.xml', 'edge.usfx.xml'])('%s', (file) => {
        expect(convertXmlToEbf(xml(file))).toEqual(edge[file]);
    });
});

describe('conversores específicos', () => {
    it('OSIS sem osisText', () => {
        expect(() => convertOsisToEbf('<osis><div type="book" osisID="Gen"/></osis>')).toThrow(
            'Invalid OSIS format: osisText element not found',
        );
    });

    it('OSIS sem título usa nome padrão e, sem xml:lang, idioma indeterminado', () => {
        const { bible } = convertOsisToEbf('<osis><osisText/></osis>');
        expect(bible.name).toBe('imported');
        expect(bible.language).toBe('und');
    });

    it('OSIS com xml:lang regional', () => {
        expect(convertOsisToEbf('<osis><osisText xml:lang="en-US"/></osis>').bible.language).toBe('eng');
    });

    it('XML malformado gera erro de parsing', () => {
        expect(() => convertUsfxToEbf('<usfx><book')).toThrow(/XML parsing error/);
        expect(() => convertOsisToEbf('<osis><osisText></osis>')).toThrow(/XML parsing error/);
    });

    it('USFX sem languageCode usa "und"', () => {
        expect(convertUsfxToEbf('<usfx><book id="GEN"/></usfx>').bible.language).toBe('und');
    });
});
