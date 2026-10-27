import type { EbfBook, EbfChapter, EbfDocument, EbfVerseObject } from '../ebf';
import { isElement, parseXml } from './parse';

export function isUsfx(xmlDoc: Document): boolean {
    return (
        xmlDoc.getElementsByTagName('usfx').length > 0 ||
        Array.from(xmlDoc.getElementsByTagName('book')).some((el) => el.getAttribute('id'))
    );
}

/** Elementos <p> que seguem o capítulo, até o próximo <c> ou o fim do livro. */
function getFollowingParagraphs(chapterElement: Element): Element[] {
    const paragraphs: Element[] = [];
    for (let node = chapterElement.nextSibling; node && !isElement(node, 'c'); node = node.nextSibling) {
        if (isElement(node, 'p')) {
            paragraphs.push(node);
        }
    }
    return paragraphs;
}

/** Texto após o marcador <v>, até <ve/> ou o próximo <v>, sem as notas de rodapé (<f>). */
function getVerseContent(verseElement: Element): string {
    let text = '';
    for (
        let node = verseElement.nextSibling;
        node && !isElement(node, 've') && !isElement(node, 'v');
        node = node.nextSibling
    ) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent ?? '';
        } else if (node.nodeType === Node.ELEMENT_NODE && !isElement(node, 'f')) {
            text += node.textContent ?? '';
        }
    }
    return text;
}

function convertBook(bookElement: Element): EbfBook {
    const bookId = bookElement.getAttribute('id') ?? '';

    // Nomes vêm dos elementos <toc>; o nível 3 é a abreviação
    const names: string[] = [];
    let abbreviation = bookId;
    for (const tocElement of bookElement.getElementsByTagName('toc')) {
        const tocText = tocElement.textContent.trim();
        if (tocElement.getAttribute('level') === '3') {
            abbreviation = tocText;
        } else if (tocText && !names.includes(tocText)) {
            names.push(tocText);
        }
    }

    const chapters: EbfChapter[] = Array.from(bookElement.getElementsByTagName('c')).map((chapterElement) => {
        const verses: EbfVerseObject[] = [];
        for (const paragraph of getFollowingParagraphs(chapterElement)) {
            for (const verseElement of paragraph.getElementsByTagName('v')) {
                verses.push({ text: getVerseContent(verseElement).trim() });
            }
        }
        return { verses };
    });

    return { names, abbreviation, usfm_id: bookId, chapters };
}

export function convertUsfxToEbf(xmlContent: string): EbfDocument {
    const xmlDoc = parseXml(xmlContent);

    const languageCode = xmlDoc.querySelector('languageCode')?.textContent || 'und';

    // Bible name: first book's id as a fallback
    const firstBookId = xmlDoc.querySelector('book')?.querySelector('id')?.textContent.trim();
    const bibleName = firstBookId || 'USFX Bible';

    const books = Array.from(xmlDoc.getElementsByTagName('book')).map(convertBook);

    return { bible: { name: bibleName, language: languageCode, books } };
}
