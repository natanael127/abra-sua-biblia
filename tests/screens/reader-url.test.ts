import { describe, expect, it } from 'vitest';
import { matchPath } from '../../src/router/path';
import { parseLegacyLink, READER_PATTERN, readerPath, referenceFromPath } from '../../src/screens/reader/url';

describe('readerPath', () => {
    it('usa o livro em minúsculas e o trecho na notação da referência', () => {
        expect(readerPath('ave-maria', 'Mt 5,3-12.21-38')).toBe('/ave-maria/mt/5,3-12.21-38');
        expect(readerPath('ave-maria', '1Cor 13')).toBe('/ave-maria/1cor/13');
        expect(readerPath('cnbb', 'Êx 20,1-17')).toBe('/cnbb/%C3%AAx/20,1-17');
    });

    it('sem referência completa, aponta só para a Bíblia', () => {
        expect(readerPath('ave-maria')).toBe('/ave-maria');
        expect(readerPath('ave-maria', null)).toBe('/ave-maria');
        expect(readerPath('ave-maria', '  ')).toBe('/ave-maria');
        expect(readerPath('ave-maria', 'Mt')).toBe('/ave-maria');
        expect(readerPath('ave-maria', ' Mt  ')).toBe('/ave-maria');
    });
});

describe('referenceFromPath', () => {
    it('monta a referência a partir dos parâmetros da URL', () => {
        expect(referenceFromPath('mt', '5,3-12')).toBe('mt 5,3-12');
        expect(referenceFromPath()).toBe('');
    });

    it('só o livro abre o capítulo 1', () => {
        expect(referenceFromPath('mt')).toBe('mt 1');
    });

    it('ida e volta pela URL preserva a referência', () => {
        for (const reference of ['Mt 5,3-12.21-38', 'Jo 3', 'Sl 119,1-', 'Êx 20,1.3.5-7']) {
            const params = matchPath(READER_PATTERN, readerPath('ave-maria', reference))!;
            expect(referenceFromPath(params.book, params.passage)).toBe(reference.toLowerCase());
        }
    });
});

describe('parseLegacyLink', () => {
    it('lê os links da versão anterior', () => {
        expect(parseLegacyLink('?bible=Ave-Maria&quote=Jo%203%2C16')).toEqual({ bible: 'Ave-Maria', reference: 'Jo 3,16' });
        expect(parseLegacyLink('?bible=Edi%C3%A7%C3%A3o%20Pastoral&quote=Sl+23%2C1')).toEqual({
            bible: 'Edição Pastoral',
            reference: 'Sl 23,1',
        });
    });

    it('aceita só um dos parâmetros', () => {
        expect(parseLegacyLink('?quote=Mt%205')).toEqual({ bible: undefined, reference: 'Mt 5' });
        expect(parseLegacyLink('?bible=CNBB')).toEqual({ bible: 'CNBB', reference: undefined });
    });

    it('ignora URLs sem os parâmetros ou com eles vazios', () => {
        expect(parseLegacyLink('')).toBeNull();
        expect(parseLegacyLink('?utm_source=x')).toBeNull();
        expect(parseLegacyLink('?bible=&quote=%20')).toBeNull();
    });
});
