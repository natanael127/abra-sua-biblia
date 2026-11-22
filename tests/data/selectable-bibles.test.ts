import { describe, expect, it } from 'vitest';
import { type BibleIndexEntry, bibleMenuSections, selectableBibles } from '../../src/data/bibles';

const bible = (language: string, slug: string, type?: BibleIndexEntry['type']): BibleIndexEntry => ({
    name: `${language} ${slug}`,
    type,
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

describe('bibleMenuSections', () => {
    const typed = [
        bible('por', 'ave-maria', 'catholic'),
        bible('por', 'almeida', 'protestant'),
        bible('por', 'cnbb', 'catholic'),
        bible('por', 'livre'),
        bible('eng', 'kjv', 'protestant'),
        bible('eng', 'nabre', 'catholic'),
    ];
    const sections = (language: string, current: string, favorites: string[]) =>
        bibleMenuSections(typed, language, current, favorites).map((section) => [section.section, keys(section.bibles)]);

    it('no favorites: no "favorites" section, in the order catholic, protestant, other', () => {
        expect(sections('por', 'por/ave-maria', [])).toEqual([
            ['catholic', ['por/ave-maria', 'por/cnbb']],
            ['protestant', ['por/almeida']],
            ['other', ['por/livre']],
        ]);
    });

    it('favorites come first, whatever the language, and do not repeat in the other sections', () => {
        expect(sections('por', 'por/ave-maria', ['eng/kjv', 'por/cnbb'])).toEqual([
            ['favorites', ['por/cnbb', 'eng/kjv']],
            ['catholic', ['por/ave-maria']],
            ['protestant', ['por/almeida']],
            ['other', ['por/livre']],
        ]);
    });

    it('a section left empty by the favorites disappears', () => {
        expect(sections('por', '', ['por/almeida', 'por/livre'])).toEqual([
            ['favorites', ['por/almeida', 'por/livre']],
            ['catholic', ['por/ave-maria', 'por/cnbb']],
        ]);
    });

    it('the current Bible of another language is listed once, even if it is a favorite', () => {
        expect(sections('por', 'eng/nabre', [])).toEqual([
            ['catholic', ['por/ave-maria', 'por/cnbb', 'eng/nabre']],
            ['protestant', ['por/almeida']],
            ['other', ['por/livre']],
        ]);
        expect(sections('por', 'eng/nabre', ['eng/nabre'])[0]).toEqual(['favorites', ['eng/nabre']]);
    });

    it('ignores favorites that are not in the index', () => {
        expect(sections('lat', '', ['xxx/yyy'])).toEqual([]);
    });
});
