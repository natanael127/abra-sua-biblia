// @vitest-environment jsdom
/**
 * O legacy-expected.json foi gerado executando o conversor anterior
 * (assets/js/xmlBibles.js) sobre os mesmos arquivos de exemplo.
 */
import { describe, expect, it } from 'vitest';
import { validateEbf } from '../../src/core/ebf';
import { convertOsisToEbf, convertUsfxToEbf, convertXmlToEbf, detectXmlFormat } from '../../src/core/xml';
import { readFixture } from '../helpers';

const legacy = JSON.parse(readFixture('xml/legacy-expected.json')) as Record<string, { ok?: unknown; error?: string }>;
const xml = (name: string) => readFixture(`xml/${name}`);

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
    it.each(['sample.osis.xml', 'sample.usfx.xml'])('%s: igual ao conversor legado e EBF1 válido', (file) => {
        const ebf = convertXmlToEbf(xml(file));
        expect(ebf).toEqual(legacy[file]?.ok);
        expect(validateEbf(ebf)).toEqual([]);
    });

    it.each(['unknown.xml', 'broken.xml'])('%s: rejeita formato não suportado', (file) => {
        expect(() => convertXmlToEbf(xml(file))).toThrow(legacy[file]?.error);
    });
});

describe('conversores específicos', () => {
    it('OSIS sem osisText', () => {
        expect(() => convertOsisToEbf('<osis><div type="book" osisID="Gen"/></osis>')).toThrow(
            'Invalid OSIS format: osisText element not found',
        );
    });

    it('OSIS sem título usa nome padrão', () => {
        expect(convertOsisToEbf('<osis><osisText/></osis>').bible.name).toBe('imported');
    });

    it('XML malformado gera erro de parsing', () => {
        expect(() => convertUsfxToEbf('<usfx><book')).toThrow(/XML parsing error/);
    });

    it('USFX sem languageCode usa "und"', () => {
        expect(convertUsfxToEbf('<usfx><book id="GEN"/></usfx>').bible.language).toBe('und');
    });
});
