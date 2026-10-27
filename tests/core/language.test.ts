import { describe, expect, it } from 'vitest';
import { toIso6393 } from '../../src/core/language';

describe('toIso6393', () => {
    it.each([
        ['pt', 'por'],
        ['PT', 'por'],
        ['pt-BR', 'por'],
        ['pt_BR', 'por'],
        ['por', 'por'],
        ['en', 'eng'],
        ['zh-Hans', 'zho'],
        ['ger', 'deu'],
        ['chi', 'zho'],
        ['grc', 'grc'],
        ['hbo', 'hbo'],
        ['zz', 'und'],
        ['', 'und'],
        [null, 'und'],
        [undefined, 'und'],
        ['portuguese', 'und'],
    ])('%j -> %s', (code, expected) => {
        expect(toIso6393(code)).toBe(expected);
    });
});
