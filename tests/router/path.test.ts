import { describe, expect, it } from 'vitest';
import { buildPath, encodePathSegment, matchPath } from '../../src/router/path';

describe('matchPath', () => {
    it('matches literals case-insensitively', () => {
        expect(matchPath('/planos', '/planos')).toEqual({});
        expect(matchPath('/planos', '/Planos/')).toEqual({});
        expect(matchPath('/planos', '/outros')).toBeNull();
    });

    it('extracts required and optional parameters', () => {
        const pattern = '/:bible?/:book?/:chapterVerses?';
        expect(matchPath(pattern, '/')).toEqual({});
        expect(matchPath(pattern, '/ave-maria')).toEqual({ bible: 'ave-maria' });
        expect(matchPath(pattern, '/ave-maria/mt/5,3-12.21-38')).toEqual({
            bible: 'ave-maria',
            book: 'mt',
            chapterVerses: '5,3-12.21-38',
        });
        expect(matchPath('/planos/:id', '/planos')).toBeNull();
        expect(matchPath('/planos/:id', '/planos/1')).toEqual({ id: '1' });
    });

    it('rejects paths with extra segments', () => {
        expect(matchPath('/:bible?/:book?/:chapterVerses?', '/a/b/c/d')).toBeNull();
    });

    it('decodes the parameters and rejects invalid encoding', () => {
        expect(matchPath('/:book', '/%C3%8Ax')).toEqual({ book: 'Êx' });
        expect(matchPath('/:book', '/5%2C3')).toEqual({ book: '5,3' });
        expect(matchPath('/:book', '/%E0%A4%A')).toBeNull();
    });

    it('does not accept a required parameter after an optional one', () => {
        expect(() => matchPath('/:a?/:b', '/x')).toThrow(/optional segments only at the end/);
    });
});

describe('buildPath', () => {
    it('builds the path omitting empty segments', () => {
        expect(buildPath()).toBe('/');
        expect(buildPath('ave-maria', undefined, '')).toBe('/ave-maria');
        expect(buildPath('ave-maria', 'mt', '5,3-12.21-')).toBe('/ave-maria/mt/5,3-12.21-');
    });

    it('encodes special characters, keeping the comma readable', () => {
        expect(encodePathSegment('êx')).toBe('%C3%AAx');
        expect(encodePathSegment('a/b c')).toBe('a%2Fb%20c');
        expect(encodePathSegment('5,3')).toBe('5,3');
    });

    it('is the inverse of matchPath', () => {
        const segments = ['bíblia', '1 cor', '13,4-7.13'];
        expect(matchPath('/:a/:b/:c', buildPath(...segments))).toEqual({ a: segments[0], b: segments[1], c: segments[2] });
    });
});
