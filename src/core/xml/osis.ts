import type { EbfBook, EbfChapter, EbfDocument } from '../ebf';
import { toIso6393 } from '../language';
import { parseXml } from './parse';

// Bible book mapping from OSIS to USFM IDs
const OSIS_TO_USFM: Readonly<Record<string, string>> = {
    // Old Testament
    Gen: 'GEN',
    Exod: 'EXO',
    Lev: 'LEV',
    Num: 'NUM',
    Deut: 'DEU',
    Josh: 'JOS',
    Judg: 'JDG',
    Ruth: 'RUT',
    '1Sam': '1SA',
    '2Sam': '2SA',
    '1Kgs': '1KI',
    '2Kgs': '2KI',
    '1Chr': '1CH',
    '2Chr': '2CH',
    Ezra: 'EZR',
    Neh: 'NEH',
    Esth: 'EST',
    Job: 'JOB',
    Ps: 'PSA',
    Prov: 'PRO',
    Eccl: 'ECC',
    Song: 'SNG',
    Isa: 'ISA',
    Jer: 'JER',
    Lam: 'LAM',
    Ezek: 'EZK',
    Dan: 'DAN',
    Hos: 'HOS',
    Joel: 'JOL',
    Amos: 'AMO',
    Obad: 'OBA',
    Jonah: 'JON',
    Mic: 'MIC',
    Nah: 'NAM',
    Hab: 'HAB',
    Zeph: 'ZEP',
    Hag: 'HAG',
    Zech: 'ZEC',
    Mal: 'MAL',

    // New Testament
    Matt: 'MAT',
    Mark: 'MRK',
    Luke: 'LUK',
    John: 'JHN',
    Acts: 'ACT',
    Rom: 'ROM',
    '1Cor': '1CO',
    '2Cor': '2CO',
    Gal: 'GAL',
    Eph: 'EPH',
    Phil: 'PHP',
    Col: 'COL',
    '1Thess': '1TH',
    '2Thess': '2TH',
    '1Tim': '1TI',
    '2Tim': '2TI',
    Titus: 'TIT',
    Phlm: 'PHM',
    Heb: 'HEB',
    Jas: 'JAS',
    '1Pet': '1PE',
    '2Pet': '2PE',
    '1John': '1JN',
    '2John': '2JN',
    '3John': '3JN',
    Jude: 'JUD',
    Rev: 'REV',

    // Deuterocanonical books (for Catholic Bibles)
    Tob: 'TOB',
    Jdt: 'JDT',
    EpJer: 'LJE',
    Bar: 'BAR',
    Sus: 'SUS',
    Bel: 'BEL',
    '1Macc': '1MA',
    '2Macc': '2MA',
    '3Macc': '3MA',
    '4Macc': '4MA',
    Wis: 'WIS',
    Sir: 'SIR',
    PrMan: 'MAN',
    '1Esd': '1ES',
    '2Esd': '2ES',
    Ps151: 'PS2',
    AddEsth: 'ADE',
    AddDan: 'DAG',
};

/** Texto dos nós de texto e de elemento do versículo (ignora comentários e CDATA). */
function getVerseContent(verseElem: Element): string {
    let text = '';
    for (const node of verseElem.childNodes) {
        if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
            text += node.textContent ?? '';
        }
    }
    return text;
}

export function isOsis(xmlDoc: Document): boolean {
    return (
        xmlDoc.getElementsByTagName('osisText').length > 0 ||
        Array.from(xmlDoc.getElementsByTagName('div')).some((div) => div.getAttribute('type') === 'book')
    );
}

export function convertOsisToEbf(xmlContent: string): EbfDocument {
    const xmlDoc = parseXml(xmlContent);

    // Extract Bible name from header > work > title
    const title = xmlDoc
        .getElementsByTagName('header')[0]
        ?.getElementsByTagName('work')[0]
        ?.getElementsByTagName('title')[0];
    const bibleName = title?.textContent.trim() ?? 'imported';

    const osisText = xmlDoc.getElementsByTagName('osisText')[0];
    if (!osisText) {
        throw new Error('Invalid OSIS format: osisText element not found');
    }

    const books: EbfBook[] = Array.from(osisText.getElementsByTagName('div'))
        .filter((div) => div.getAttribute('type') === 'book')
        .map((bookDiv) => {
            const osisID = bookDiv.getAttribute('osisID') ?? '';

            const chapters: EbfChapter[] = Array.from(bookDiv.getElementsByTagName('chapter')).map((chapterElem) => ({
                verses: Array.from(chapterElem.getElementsByTagName('verse')).map((verseElem) => ({
                    text: getVerseContent(verseElem).trim(),
                })),
            }));

            return {
                names: [osisID],
                abbreviation: osisID,
                usfm_id: OSIS_TO_USFM[osisID] ?? osisID,
                chapters,
            };
        });

    return { bible: { name: bibleName, language: toIso6393(osisText.getAttribute('xml:lang')), books } };
}
