import {
    type EbfDocument,
    type EbfVerse,
    findBook,
    getBookAbbreviation,
    getBookName,
    getVerseText,
    getVerseTitle,
} from './ebf';
import { formatVerseRanges, parseReference, resolveVerseIndexes } from './reference';
import { escapeHtml, toSingleQuotes } from './text';

export interface DisplayOptions {
    quotes: boolean;
    verseNumbers: boolean;
    lineBreaks: boolean;
    ellipsis: boolean;
    parenthesesCitation: boolean;
    sectionTitles: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: Readonly<DisplayOptions> = {
    quotes: false,
    verseNumbers: true,
    lineBreaks: true,
    ellipsis: true,
    parenthesesCitation: true,
    sectionTitles: true,
};

export interface RenderResult {
    error: boolean;
    html: string;
}

/** Monta o HTML de cada versículo selecionado, com as marcações de exibição escolhidas. */
export function formatVerseTexts(
    verseIndexes: readonly number[],
    chapterVerses: readonly EbfVerse[],
    displayOpt: DisplayOptions,
): string[] {
    const verseTexts: string[] = [];

    let previousVerse = -1;
    verseIndexes.forEach((verseIndex, position) => {
        // Lacuna entre versículos: marcador de omissão
        if (previousVerse >= 0 && verseIndex > previousVerse + 1 && displayOpt.ellipsis) {
            verseTexts.push('[...]');
        }

        const verse = chapterVerses[verseIndex];
        const rawText = getVerseText(verse);
        const rawTitle = getVerseTitle(verse);
        // Escape HTML to prevent injection
        let verseText = rawText === undefined ? undefined : escapeHtml(rawText);
        let verseTitle = rawTitle === undefined ? undefined : escapeHtml(rawTitle);

        // Replace all kind of double quotes with single quotes, so they do not
        // clash with the ones that wrap the citation. Done before building the
        // HTML, otherwise the quotes of the tag attributes would be replaced too.
        if (displayOpt.quotes) {
            verseText = verseText === undefined ? undefined : toSingleQuotes(verseText);
            verseTitle = verseTitle === undefined ? undefined : toSingleQuotes(verseTitle);
        }

        if (verseText) {
            let formattedVerse = verseText;

            if (displayOpt.verseNumbers) {
                formattedVerse = `<sup>${verseIndex + 1}</sup> ${formattedVerse}`;
            }

            // Prepend the title to avoid a double line break
            if (displayOpt.sectionTitles && verseTitle) {
                formattedVerse = `<span class="section-title">${verseTitle}</span>${formattedVerse}`;
            }

            if (displayOpt.quotes) {
                // Quote the first and last verse
                if (position === 0) {
                    formattedVerse = `"${formattedVerse}`;
                }
                if (position === verseIndexes.length - 1) {
                    formattedVerse = `${formattedVerse}"`;
                }
            }

            verseTexts.push(formattedVerse);
        }

        previousVerse = verseIndex;
    });

    return verseTexts;
}

const errorHtml = (message: string): RenderResult => ({
    error: true,
    html: `<span class="error">${message}</span>`,
});

/**
 * Gera o HTML do trecho bíblico indicado pela referência.
 * `instructionsHtml` é exibido quando a referência não pode ser interpretada.
 */
export function renderReference(
    reference: string,
    ebf: EbfDocument | null,
    displayOpt: DisplayOptions,
    instructionsHtml: string,
): RenderResult {
    if (!ebf) {
        return errorHtml('Nenhum arquivo de Bíblia foi carregado.');
    }

    try {
        return render(reference, ebf, displayOpt, instructionsHtml);
    } catch (error) {
        console.error('Erro ao processar o JSON da Bíblia:', error);
        return errorHtml('Arquivo de Bíblia inválido ou corrompido.');
    }
}

function render(
    reference: string,
    ebf: EbfDocument,
    displayOpt: DisplayOptions,
    instructionsHtml: string,
): RenderResult {
    const parsedRef = parseReference(reference);
    if (parsedRef === null) {
        return { error: true, html: instructionsHtml };
    }

    const book = findBook(ebf, parsedRef.book);
    if (!book) {
        return errorHtml(`Livro "${escapeHtml(parsedRef.book)}" não encontrado.`);
    }

    const chapter = book.chapters[parsedRef.chapter - 1];
    if (!chapter) {
        return errorHtml(`Capítulo ${parsedRef.chapter} não encontrado em ${escapeHtml(getBookName(book))}.`);
    }

    // Escape HTML to prevent injection
    let headerText = `${escapeHtml(getBookName(book))} ${parsedRef.chapter}`;
    if (chapter.title) {
        headerText += `: ${escapeHtml(chapter.title)}`;
    }
    if (ebf.bible.name) {
        headerText += ` (${escapeHtml(ebf.bible.name)})`;
    }

    const verseIndexes = resolveVerseIndexes(parsedRef, chapter.verses.length);
    const verseTexts = formatVerseTexts(verseIndexes, chapter.verses, displayOpt);

    if (displayOpt.parenthesesCitation) {
        let citation = `${escapeHtml(getBookAbbreviation(book))} ${parsedRef.chapter}`;
        if (!parsedRef.allVerses) {
            citation += formatVerseRanges(verseIndexes);
        }
        verseTexts.push(`<span class="verse-reference">(${citation})</span>`);
    }

    const joinedContent = verseTexts.join(displayOpt.lineBreaks ? '<br>' : ' ');

    return {
        error: false,
        html: `<div class="reference">${headerText}</div><div class="verse-text">${joinedContent}</div>`,
    };
}
