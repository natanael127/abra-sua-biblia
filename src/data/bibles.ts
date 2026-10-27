import { type EbfDocument, validateEbf } from '../core/ebf';

/** Pasta pública com o índice e as Bíblias EBF1, servida sem transformações. */
export const DATA_PATH = '/assets/data/';

export type BibleType = 'catholic' | 'protestant' | 'other';

export interface BibleIndexEntry {
    name: string;
    /** Identificador da Bíblia na URL, ex.: "ave-maria" em /ave-maria/jo/3,16. */
    slug: string;
    /** Caminho relativo a DATA_PATH, ex.: "bibles/por_ave_maria.ebf1.json". */
    path: string;
    type?: BibleType;
    default?: boolean;
}

export async function getAvailableBibles(fetchFn: typeof fetch = fetch): Promise<BibleIndexEntry[]> {
    try {
        const response = await fetchFn(`${DATA_PATH}index.json`);
        if (!response.ok) {
            return [];
        }
        return (await response.json()) as BibleIndexEntry[];
    } catch (error) {
        console.error('Erro ao carregar lista de Bíblias:', error);
        return [];
    }
}

export async function loadBibleFromPath(biblePath: string, fetchFn: typeof fetch = fetch): Promise<EbfDocument | null> {
    try {
        const response = await fetchFn(`${DATA_PATH}${biblePath}`);
        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo: ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as EbfDocument;
    } catch (error) {
        console.error('Erro ao carregar a Bíblia:', error);
        return null;
    }
}

/** Interpreta um arquivo EBF1 enviado pelo usuário; lança erro se não for válido. */
export function parseEbfJson(content: string): EbfDocument {
    const data: unknown = JSON.parse(content);
    const errors = validateEbf(data);
    if (errors.length > 0) {
        throw new Error(`Arquivo EBF1 inválido: ${errors.slice(0, 5).join('; ')}`);
    }
    return data as EbfDocument;
}
