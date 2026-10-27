import { describe, expect, it } from 'vitest';
import { buildPath, encodePathSegment, matchPath } from '../../src/router/path';

describe('matchPath', () => {
    it('reconhece literais sem diferenciar maiúsculas', () => {
        expect(matchPath('/planos', '/planos')).toEqual({});
        expect(matchPath('/planos', '/Planos/')).toEqual({});
        expect(matchPath('/planos', '/outros')).toBeNull();
    });

    it('extrai parâmetros obrigatórios e opcionais', () => {
        const pattern = '/:bible?/:book?/:passage?';
        expect(matchPath(pattern, '/')).toEqual({});
        expect(matchPath(pattern, '/ave-maria')).toEqual({ bible: 'ave-maria' });
        expect(matchPath(pattern, '/ave-maria/mt/5,3-12.21-38')).toEqual({
            bible: 'ave-maria',
            book: 'mt',
            passage: '5,3-12.21-38',
        });
        expect(matchPath('/planos/:id', '/planos')).toBeNull();
        expect(matchPath('/planos/:id', '/planos/1')).toEqual({ id: '1' });
    });

    it('rejeita caminhos com segmentos a mais', () => {
        expect(matchPath('/:bible?/:book?/:passage?', '/a/b/c/d')).toBeNull();
    });

    it('decodifica os parâmetros e rejeita codificação inválida', () => {
        expect(matchPath('/:book', '/%C3%8Ax')).toEqual({ book: 'Êx' });
        expect(matchPath('/:book', '/5%2C3')).toEqual({ book: '5,3' });
        expect(matchPath('/:book', '/%E0%A4%A')).toBeNull();
    });

    it('não aceita parâmetro obrigatório depois de opcional', () => {
        expect(() => matchPath('/:a?/:b', '/x')).toThrow(/opcionais só no fim/);
    });
});

describe('buildPath', () => {
    it('monta o caminho omitindo segmentos vazios', () => {
        expect(buildPath()).toBe('/');
        expect(buildPath('ave-maria', undefined, '')).toBe('/ave-maria');
        expect(buildPath('ave-maria', 'mt', '5,3-12.21-')).toBe('/ave-maria/mt/5,3-12.21-');
    });

    it('codifica caracteres especiais, mantendo a vírgula legível', () => {
        expect(encodePathSegment('êx')).toBe('%C3%AAx');
        expect(encodePathSegment('a/b c')).toBe('a%2Fb%20c');
        expect(encodePathSegment('5,3')).toBe('5,3');
    });

    it('é o inverso de matchPath', () => {
        const segments = ['bíblia', '1 cor', '13,4-7.13'];
        expect(matchPath('/:a/:b/:c', buildPath(...segments))).toEqual({ a: segments[0], b: segments[1], c: segments[2] });
    });
});
