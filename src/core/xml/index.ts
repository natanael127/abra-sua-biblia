import type { EbfDocument } from '../ebf';
import { convertOsisToEbf, isOsis } from './osis';
import { parseXml, type XmlElement } from './parse';
import { convertUsfxToEbf, isUsfx } from './usfx';

export { convertOsisToEbf } from './osis';
export { convertUsfxToEbf } from './usfx';

export type XmlBibleFormat = 'osis' | 'usfx' | 'unknown';

export function detectXmlFormat(xmlContent: string): XmlBibleFormat {
    let xmlDoc: XmlElement;
    try {
        xmlDoc = parseXml(xmlContent);
    } catch {
        return 'unknown';
    }

    if (isOsis(xmlDoc)) return 'osis';
    if (isUsfx(xmlDoc)) return 'usfx';
    return 'unknown';
}

/** Converte XML OSIS ou USFX para EBF1, detectando o formato automaticamente. */
export function convertXmlToEbf(xmlContent: string): EbfDocument {
    switch (detectXmlFormat(xmlContent)) {
        case 'osis':
            return convertOsisToEbf(xmlContent);
        case 'usfx':
            return convertUsfxToEbf(xmlContent);
        default:
            throw new Error('Unsupported XML format. The XML provided is neither OSIS nor USFX format.');
    }
}
