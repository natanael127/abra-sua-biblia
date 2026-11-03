// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_OPTIONS } from '../../src/core/passage';
import { getSavedDisplayOptions, saveDisplayOptions } from '../../src/ui/storage';

const saveRaw = (value: unknown) => {
    localStorage.setItem('bibleDisplayOptions', JSON.stringify(value));
};

describe('getSavedDisplayOptions', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('nothing saved: the defaults', () => {
        expect(getSavedDisplayOptions()).toEqual(DEFAULT_DISPLAY_OPTIONS);
    });

    it('reads back what was saved', () => {
        const options = { ...DEFAULT_DISPLAY_OPTIONS, quotes: true, parenthesesReference: false };
        saveDisplayOptions(options);
        expect(getSavedDisplayOptions()).toEqual(options);
    });

    it('keeps an option saved under its old name (parenthesesCitation)', () => {
        saveRaw({ parenthesesCitation: false });
        expect(getSavedDisplayOptions().parenthesesReference).toBe(false);
    });

    it('the current name wins over the old one', () => {
        saveRaw({ parenthesesCitation: false, parenthesesReference: true });
        expect(getSavedDisplayOptions().parenthesesReference).toBe(true);
    });

    it('ignores values that are not booleans', () => {
        saveRaw({ quotes: 'yes', verseNumbers: false });
        expect(getSavedDisplayOptions()).toEqual({ ...DEFAULT_DISPLAY_OPTIONS, verseNumbers: false });
    });
});
