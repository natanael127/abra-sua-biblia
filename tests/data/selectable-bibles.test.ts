import { describe, expect, it } from 'vitest';
import { type BibleIndexEntry, selectableBibles } from '../../src/data/bibles';

const bible = (language: string, slug: string): BibleIndexEntry => ({
    name: `${language} ${slug}`,
    language,
    slug,
    url: `https://example.com/${language}_${slug}.ebf1.json`,
});

const bibles = [bible('por', 'ave-maria'), bible('por', 'cnbb'), bible('eng', 'kjv'), bible('eng', 'nabre'), bible('lat', 'vulgata')];

const keys = (list: BibleIndexEntry[]) => list.map((entry) => `${entry.language}/${entry.slug}`);

describe('selectableBibles', () => {
    it('offers only the Bibles of the language', () => {
        expect(keys(selectableBibles(bibles, 'eng', 'eng/kjv'))).toEqual(['eng/kjv', 'eng/nabre']);
    });

    it('keeps the order of the index', () => {
        expect(keys(selectableBibles(bibles, 'por', ''))).toEqual(['por/ave-maria', 'por/cnbb']);
    });

    it('also offers the current Bible when it is of another language', () => {
        expect(keys(selectableBibles(bibles, 'eng', 'lat/vulgata'))).toEqual(['eng/kjv', 'eng/nabre', 'lat/vulgata']);
    });

    it('with no current Bible (or the upload), only the language ones', () => {
        expect(keys(selectableBibles(bibles, 'lat', ''))).toEqual(['lat/vulgata']);
        expect(keys(selectableBibles(bibles, 'lat', 'upload'))).toEqual(['lat/vulgata']);
    });

    it('offers nothing of a language that has no Bibles, apart from the current one', () => {
        expect(selectableBibles(bibles, 'xxx', '')).toEqual([]);
        expect(keys(selectableBibles(bibles, 'xxx', 'por/cnbb'))).toEqual(['por/cnbb']);
    });
});
