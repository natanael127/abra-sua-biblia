/**
 * URLs da tela de leitura: /{bíblia}/{livro}/{trecho}, ex.: /ave-maria/mt/5,3-12.21-38.
 * O livro é a abreviação da tradução, em minúsculas; o trecho segue a notação
 * da referência digitada.
 */
import { buildPath } from '../../router/path';

/** Padrão da rota da tela de leitura. */
export const READER_PATTERN = '/:bible?/:book?/:passage?';

/** Identificador, na URL, da Bíblia carregada por upload (não pode ser compartilhada). */
export const UPLOAD_SLUG = 'upload';

/** Caminho do trecho; sem referência válida, só o da Bíblia. */
export function readerPath(bibleSlug: string, reference?: string | null): string {
    const [book, ...rest] = (reference ?? '').trim().split(' ');
    const passage = rest.join(' ').trim();
    if (!book || !passage) {
        return buildPath(bibleSlug);
    }
    return buildPath(bibleSlug, book.toLowerCase(), passage);
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
