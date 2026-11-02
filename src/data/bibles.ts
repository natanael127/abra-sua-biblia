import { type EbfDocument, validateEbf } from '../core/ebf';

/** Public folder with the index and the EBF1 Bibles, served untransformed. */
export const DATA_PATH = '/assets/data/';

export type BibleType = 'catholic' | 'protestant' | 'other';

export interface BibleIndexEntry {
    name: string;
    /** ISO 639-3 language, e.g.: "por" em /por/ave-maria/jo/3,16. */
    language: string;
    /** Identifier of the Bible within the language, e.g.: "ave-maria" em /por/ave-maria/jo/3,16. */
    slug: string;
    /** Path relative to DATA_PATH, e.g.: "bibles/por_ave_maria.ebf1.json". */
    path: string;
    type?: BibleType;
    default?: boolean;
}

/** Identifier of the Bible in the URL and in preferences: language and slug, e.g.: "por/ave-maria". */
export const bibleKey = (entry: BibleIndexEntry): string => `${entry.language}/${entry.slug}`;

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

export async function loadBibleFromPath(biblePath: string, fetchFn: typeof fetch = fetch): Promise<EbfDocument | null> {
    try {
        const response = await fetchFn(`${DATA_PATH}${biblePath}`);
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
