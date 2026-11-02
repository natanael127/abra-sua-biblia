/**
 * URLs da tela de leitura: /{idioma}/{bíblia}/{livro}/{trecho}, ex.:
 * /por/ave-maria/mt/5,3-12.21-38. O idioma é o código ISO 639-3 da tradução;
 * o livro é a abreviação da tradução, em minúsculas; o trecho segue a notação
 * da referência digitada. A Bíblia carregada por upload não tem idioma:
 * /upload/{livro}/{trecho}.
 */
import { buildPath, type PathParams } from '../../router/path';

/** Padrão da rota da tela de leitura. */
export const READER_PATTERN = '/:language?/:bible?/:book?/:passage?';

/** Identificador, na URL, da Bíblia carregada por upload (não pode ser compartilhada). */
export const UPLOAD_KEY = 'upload';

/** O que a URL da tela de leitura pede. */
export interface ReaderTarget {
    /** Idioma e slug ("por/ave-maria") ou UPLOAD_KEY; ausente se a URL não indica a Bíblia. */
    bibleKey?: string;
    /** Idioma, quando é a única parte da Bíblia na URL ("/por"). */
    language?: string;
    book?: string;
    passage?: string;
}

/** Interpreta os parâmetros de READER_PATTERN. */
export function parseReaderParams(params: PathParams): ReaderTarget {
    const language = params.language?.toLowerCase();
    if (language === UPLOAD_KEY) {
        return { bibleKey: UPLOAD_KEY, book: params.bible, passage: params.book };
    }
    if (!language || !params.bible) {
        return { language };
    }
    return { bibleKey: `${language}/${params.bible.toLowerCase()}`, book: params.book, passage: params.passage };
}

/** Caminho do trecho; sem referência válida, só o da Bíblia. `bibleKey`: "por/ave-maria" ou UPLOAD_KEY. */
export function readerPath(bibleKey: string, reference?: string | null): string {
    const bibleSegments = bibleKey.split('/');
    const [book, ...rest] = (reference ?? '').trim().split(' ');
    const passage = rest.join(' ').trim();
    if (!book || !passage) {
        return buildPath(...bibleSegments);
    }
    return buildPath(...bibleSegments, book.toLowerCase(), passage);
}

/** Referência a partir dos parâmetros da URL; só o livro abre o capítulo 1. */
export function referenceFromPath(book?: string, passage?: string): string {
    if (!book) return '';
    return `${book} ${passage ?? '1'}`;
}

export interface LegacyLink {
    /** Nome da Bíblia, ex.: "Ave-Maria". */
    bible?: string;
    reference?: string;
}

/**
 * Lê os links compartilhados pela versão anterior: /?bible=Ave-Maria&quote=Jo%203%2C16.
 * Retorna null se a URL não tem esses parâmetros.
 */
export function parseLegacyLink(search: string): LegacyLink | null {
    const params = new URLSearchParams(search);
    const bible = params.get('bible')?.trim() || undefined;
    const reference = params.get('quote')?.trim() || undefined;
    if (!bible && !reference) return null;
    return { bible, reference };
}
