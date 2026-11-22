import { type EbfDocument, validateEbf } from '../core/ebf';

/** Public folder with the index of the Bibles (the Bibles themselves are in the Blob store). */
export const DATA_PATH = '/assets/data/';

export type BibleType = 'catholic' | 'protestant' | 'other';

export interface BibleIndexEntry {
    name: string;
    /** ISO 639-3 language, e.g.: "por" em /por/ave-maria/jo/3,16. */
    language: string;
    /** Identifier of the Bible within the language, e.g.: "ave-maria" em /por/ave-maria/jo/3,16. */
    slug: string;
    /** Absolute URL of the EBF1 file, in the Blob store, e.g.: "https://.../por_ave_maria.ebf1.json?v=0a1b2c3d4e5f". */
    url: string;
    type?: BibleType;
    default?: boolean;
}

/** Identifier of the Bible in the URL and in preferences: language and slug, e.g.: "por/ave-maria". */
export const bibleKey = (entry: BibleIndexEntry): string => `${entry.language}/${entry.slug}`;

/**
 * Bibles offered in the translation list: the ones of the language (that of the
 * interface) and, if it is of another one, the Bible currently open, so that the
 * list always reflects what is on the screen (e.g. a link to another language).
 */
export function selectableBibles(
    bibles: readonly BibleIndexEntry[],
    language: string,
    currentKey: string,
): BibleIndexEntry[] {
    return bibles.filter((bible) => bible.language === language || bibleKey(bible) === currentKey);
}

/** Sections of the translation menu, in order: the favorites, then one per type of Bible. */
export type BibleMenuSection = 'favorites' | BibleType;

const BIBLE_TYPE_ORDER: readonly BibleType[] = ['catholic', 'protestant', 'other'];

/**
 * Sections of the translation menu, without the empty ones. The favorites come first and are
 * always there, whatever the language; the others are the selectable Bibles (see
 * `selectableBibles`) grouped by type, without repeating the favorites. Keys of favorites that
 * are not in the index are ignored.
 */
export function bibleMenuSections(
    bibles: readonly BibleIndexEntry[],
    language: string,
    currentKey: string,
    favoriteKeys: readonly string[],
): { section: BibleMenuSection; bibles: BibleIndexEntry[] }[] {
    const favorites = new Set(favoriteKeys);
    const isFavorite = (bible: BibleIndexEntry) => favorites.has(bibleKey(bible));
    const others = selectableBibles(bibles, language, currentKey).filter((bible) => !isFavorite(bible));
    const sections: { section: BibleMenuSection; bibles: BibleIndexEntry[] }[] = [
        { section: 'favorites', bibles: bibles.filter(isFavorite) },
        ...BIBLE_TYPE_ORDER.map((type) => ({
            section: type,
            bibles: others.filter((bible) => (bible.type ?? 'other') === type),
        })),
    ];
    return sections.filter((section) => section.bibles.length > 0);
}

export async function getAvailableBibles(fetchFn: typeof fetch = fetch): Promise<BibleIndexEntry[]> {
    try {
        const response = await fetchFn(`${DATA_PATH}index.json`);
        if (!response.ok) {
            return [];
        }
        return (await response.json()) as BibleIndexEntry[];
    } catch (error) {
        console.error('Error loading the Bible list:', error);
        return [];
    }
}

export async function loadBibleFromUrl(url: string, fetchFn: typeof fetch = fetch): Promise<EbfDocument | null> {
    try {
        const response = await fetchFn(url);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as EbfDocument;
    } catch (error) {
        console.error('Error loading the Bible:', error);
        return null;
    }
}

/** Parses an EBF1 file uploaded by the user; throws if it is not valid. */
export function parseEbfJson(content: string): EbfDocument {
    const data: unknown = JSON.parse(content);
    const errors = validateEbf(data);
    if (errors.length > 0) {
        throw new Error(`Invalid EBF1 file: ${errors.slice(0, 5).join('; ')}`);
    }
    return data as EbfDocument;
}
