import { describe, expect, it } from 'vitest';
import { resolveUiLanguage, uiLanguageOfTag } from '../../src/i18n/detect';

describe('uiLanguageOfTag', () => {
    it.each([
        ['pt-BR', 'por'],
        ['pt', 'por'],
        ['en-US', 'eng'],
        ['zh-CN', 'zho'],
        ['zh-Hant-TW', 'zho'],
        ['cmn-Hans-CN', 'zho'],
        ['ar-EG', 'arb'],
        ['el', 'ell'],
        ['grc', 'grc'],
        ['la', 'lat'],
        ['hi-IN', 'hin'],
        ['ja', 'jpn'],
        ['bn-BD', 'ben'],
        ['id', 'ind'],
        ['ur-PK', 'urd'],
        ['de-AT', 'deu'],
    ])('%s -> %s', (tag, code) => {
        expect(uiLanguageOfTag(tag)?.code).toBe(code);
    });

    it('has nothing for languages with no translation', () => {
        expect(uiLanguageOfTag('ko-KR')).toBeUndefined();
        expect(uiLanguageOfTag('')).toBeUndefined();
        expect(uiLanguageOfTag('xx')).toBeUndefined();
    });
});

describe('resolveUiLanguage', () => {
    it('1. prefers the language the user chose and saved', () => {
        expect(resolveUiLanguage('deu', ['fr-FR', 'en'], 'por').code).toBe('deu');
    });

    it('2. without a saved choice, uses the first browser language that has a translation', () => {
        expect(resolveUiLanguage(null, ['fr-FR', 'en'], 'por').code).toBe('fra');
        expect(resolveUiLanguage(null, ['ko-KR', 'ru', 'en'], 'por').code).toBe('rus');
    });

    it('3. without either, uses the default language of the settings', () => {
        expect(resolveUiLanguage(null, ['ko-KR'], 'por').code).toBe('por');
        expect(resolveUiLanguage(null, [], 'eng').code).toBe('eng');
        expect(resolveUiLanguage(null, ['ko-KR'], 'lat').code).toBe('lat');
    });

    it('ignores a saved value that is not a supported language', () => {
        expect(resolveUiLanguage('xxx', ['it'], 'por').code).toBe('ita');
        expect(resolveUiLanguage('', [], 'por').code).toBe('por');
    });

    it('fails with a default language that does not exist', () => {
        expect(() => resolveUiLanguage(null, [], 'xxx')).toThrow('Unknown default interface language');
    });
});
