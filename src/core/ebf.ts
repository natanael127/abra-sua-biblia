/**
 * Easy Bible Format, versão 1 (EBF1).
 * https://github.com/natanael127/easy-bible-format
 *
 * As Bíblias em public/assets/data/bibles seguem este formato e são publicadas
 * sem nenhuma transformação, para que possam ser baixadas e usadas em outros
 * projetos. A conformidade delas com o schema oficial (ebf1-schema.json do
 * pacote easy-bible-format, fixado num commit) é verificada nos testes.
 *
 * Os tipos abaixo descrevem o que o site consegue ler, de forma mais tolerante
 * que o schema (abreviação, usfm_id e idioma opcionais, versículo só como
 * texto), porque também cobrem a saída dos conversores de XML. Os arquivos
 * JSON enviados pelo usuário precisam seguir o schema (validateEbf).
 */
import validateEbf1Schema from 'virtual:ebf1-validator';

export interface EbfCrossReference {
    usfm_id: string;
    chapter: number;
    verse: number;
}

export interface EbfVerseObject {
    text: string;
    title?: string;
    comment?: string;
    references?: EbfCrossReference[];
}

/** Um versículo pode ser um objeto ou apenas o texto. */
export type EbfVerse = EbfVerseObject | string;

export interface EbfChapter {
    verses: EbfVerse[];
    title?: string;
    comment?: string;
}

export interface EbfBook {
    names: string[];
    abbreviation?: string;
    usfm_id?: string;
    chapters: EbfChapter[];
}

export interface EbfBible {
    name: string;
    language?: string;
    books: EbfBook[];
}

export interface EbfDocument {
    bible: EbfBible;
    metadata?: Record<string, unknown>;
}

export function getVerseText(verse: EbfVerse | undefined): string | undefined {
    return typeof verse === 'string' ? verse : verse?.text;
}

export function getVerseTitle(verse: EbfVerse | undefined): string | undefined {
    return typeof verse === 'object' ? verse.title : undefined;
}

/** Nome principal do livro, com alternativas para arquivos incompletos. */
export function getBookName(book: EbfBook): string {
    return book.names[0] ?? book.abbreviation ?? book.usfm_id ?? '';
}

/** Abreviação usada nas referências, com alternativas para arquivos incompletos. */
export function getBookAbbreviation(book: EbfBook): string {
    return book.abbreviation || getBookName(book).substring(0, 3);
}

export function findBook(ebf: EbfDocument, bookString: string): EbfBook | undefined {
    const wanted = bookString.toLowerCase();
    return ebf.bible.books.find(
        (b) =>
            b.abbreviation?.toLowerCase() === wanted ||
            b.usfm_id?.toLowerCase() === wanted ||
            b.names.some((name) => name.toLowerCase() === wanted),
    );
}

export function getNumOfChapters(ebf: EbfDocument, bookString: string): number {
    return findBook(ebf, bookString)?.chapters.length ?? 0;
}

/**
 * Valida o documento contra o schema oficial do EBF1 (usado no upload de
 * arquivos JSON). Retorna a lista de problemas encontrados (vazia quando o
 * documento é válido), cada um com o caminho do campo.
 */
export function validateEbf(data: unknown): string[] {
    if (validateEbf1Schema(data)) return [];
    return (validateEbf1Schema.errors ?? []).map((error) => `${error.instancePath || '/'}: ${error.message ?? 'inválido'}`);
}

export function isEbfDocument(data: unknown): data is EbfDocument {
    return validateEbf1Schema(data);
}
