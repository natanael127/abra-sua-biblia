import type { EbfBook, EbfChapter, EbfDocument, EbfVerseObject } from '../ebf';
import { toIso6393 } from '../language';
import { descendants, nextSiblings, parseXml, textContent, type XmlElement } from './parse';

export function isUsfx(xmlDoc: XmlElement): boolean {
    return descendants(xmlDoc, 'usfx').length > 0 || descendants(xmlDoc, 'book').some((el) => el.attributes.id);
}

/** <p> elements following the chapter, up to the next <c> or the end of the book. */
function getFollowingParagraphs(chapterElement: XmlElement): XmlElement[] {
    const paragraphs: XmlElement[] = [];
    for (const node of nextSiblings(chapterElement)) {
        if (node.type !== 'element') continue;
        if (node.name === 'c') break;
        if (node.name === 'p') {
            paragraphs.push(node);
        }
    }
    return paragraphs;
}

/** Text after the <v> marker, up to <ve/> or the next <v>, without footnotes (<f>). */
function getVerseContent(verseElement: XmlElement): string {
    let text = '';
    for (const node of nextSiblings(verseElement)) {
        if (node.type === 'element' && (node.name === 've' || node.name === 'v')) break;
        // Loose text and elements, except notes; stray CDATA is left out, as before
        if (node.type === 'text' || (node.type === 'element' && node.name !== 'f')) {
            text += textContent(node);
        }
    }
    return text;
}

function convertBook(bookElement: XmlElement): EbfBook {
    const bookId = bookElement.attributes.id ?? '';

    // Names come from the <toc> elements; level 3 is the abbreviation
    const names: string[] = [];
    let abbreviation = bookId;
    for (const tocElement of descendants(bookElement, 'toc')) {
        const tocText = textContent(tocElement).trim();
        if (tocElement.attributes.level === '3') {
            abbreviation = tocText;
        } else if (tocText && !names.includes(tocText)) {
            names.push(tocText);
        }
    }

    const chapters: EbfChapter[] = descendants(bookElement, 'c').map((chapterElement) => {
        const verses: EbfVerseObject[] = [];
        for (const paragraph of getFollowingParagraphs(chapterElement)) {
            for (const verseElement of descendants(paragraph, 'v')) {
                verses.push({ text: getVerseContent(verseElement).trim() });
            }
        }
        return { verses };
    });

    return { names, abbreviation, usfm_id: bookId, chapters };
}

export function convertUsfxToEbf(xmlContent: string): EbfDocument {
    const xmlDoc = parseXml(xmlContent);

    const languageElement = descendants(xmlDoc, 'languageCode')[0];
    const languageCode = toIso6393(languageElement && textContent(languageElement));

    // Bible name: first book's id as a fallback
    const books = descendants(xmlDoc, 'book');
    const firstBookIdElement = books[0] && descendants(books[0], 'id')[0];
    const bibleName = (firstBookIdElement && textContent(firstBookIdElement).trim()) || 'USFX Bible';

    return { bible: { name: bibleName, language: languageCode, books: books.map(convertBook) } };
}
