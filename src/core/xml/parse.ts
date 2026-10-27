/** Interpreta o XML com o parser nativo do navegador; lança erro se for inválido. */
export function parseXml(xmlContent: string): Document {
    const xmlDoc = new DOMParser().parseFromString(xmlContent, 'text/xml');

    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
        throw new Error('XML parsing error: ' + parseError.textContent);
    }

    return xmlDoc;
}

export const isElement = (node: Node | null, tagName: string): node is Element =>
    node?.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === tagName;
