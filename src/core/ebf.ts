/**
 * Easy Bible Format, versão 1 (EBF1).
 * https://github.com/natanael127/easy-bible-format
 *
 * As Bíblias em public/assets/data/bibles seguem este formato e são publicadas
 * sem nenhuma transformação, para que possam ser baixadas e usadas em outros
 * projetos. Estes tipos descrevem o formato; não o alteram.
 */

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

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';

/**
 * Valida a estrutura de um documento EBF1. Retorna a lista de problemas
 * encontrados (vazia quando o documento é válido), cada um com o caminho do campo.
 */
export function validateEbf(data: unknown): string[] {
    const errors: string[] = [];

    if (!isObject(data) || !isObject(data.bible)) {
        return ['bible: objeto ausente'];
    }
    const bible = data.bible;
    if (typeof bible.name !== 'string') errors.push('bible.name: deve ser texto');
    if (!isOptionalString(bible.language)) errors.push('bible.language: deve ser texto');
    if (data.metadata !== undefined && !isObject(data.metadata)) errors.push('metadata: deve ser objeto');
    if (!Array.isArray(bible.books)) {
        errors.push('bible.books: deve ser lista');
        return errors;
    }

    bible.books.forEach((book: unknown, b) => {
        const bookPath = `bible.books[${b}]`;
        if (!isObject(book)) {
            errors.push(`${bookPath}: deve ser objeto`);
            return;
        }
        if (!Array.isArray(book.names) || !book.names.every((n) => typeof n === 'string')) {
            errors.push(`${bookPath}.names: deve ser lista de textos`);
        }
        if (!isOptionalString(book.abbreviation)) errors.push(`${bookPath}.abbreviation: deve ser texto`);
        if (!isOptionalString(book.usfm_id)) errors.push(`${bookPath}.usfm_id: deve ser texto`);
        if (!Array.isArray(book.chapters)) {
            errors.push(`${bookPath}.chapters: deve ser lista`);
            return;
        }

        book.chapters.forEach((chapter: unknown, c) => {
            const chapterPath = `${bookPath}.chapters[${c}]`;
            if (!isObject(chapter)) {
                errors.push(`${chapterPath}: deve ser objeto`);
                return;
            }
            if (!isOptionalString(chapter.title)) errors.push(`${chapterPath}.title: deve ser texto`);
            if (!isOptionalString(chapter.comment)) errors.push(`${chapterPath}.comment: deve ser texto`);
            if (!Array.isArray(chapter.verses)) {
                errors.push(`${chapterPath}.verses: deve ser lista`);
                return;
            }

            chapter.verses.forEach((verse: unknown, v) => {
                const versePath = `${chapterPath}.verses[${v}]`;
                if (typeof verse === 'string') return;
                if (!isObject(verse)) {
                    errors.push(`${versePath}: deve ser objeto ou texto`);
                    return;
                }
                if (typeof verse.text !== 'string') errors.push(`${versePath}.text: deve ser texto`);
                if (!isOptionalString(verse.title)) errors.push(`${versePath}.title: deve ser texto`);
                if (!isOptionalString(verse.comment)) errors.push(`${versePath}.comment: deve ser texto`);
                if (verse.references !== undefined) {
                    const valid =
                        Array.isArray(verse.references) &&
                        verse.references.every(
                            (r) =>
                                isObject(r) &&
                                typeof r.usfm_id === 'string' &&
                                typeof r.chapter === 'number' &&
                                typeof r.verse === 'number',
                        );
                    if (!valid) errors.push(`${versePath}.references: deve ser lista de {usfm_id, chapter, verse}`);
                }
            });
        });
    });

    return errors;
}

export function isEbfDocument(data: unknown): data is EbfDocument {
    return validateEbf(data).length === 0;
}
