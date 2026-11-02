/**
 * XML reading with fast-xml-parser, identical in the browser and in Node.
 *
 * The result is a simple tree, keeping the original order of the nodes (OSIS
 * and USFX mix text and elements) and a reference to the parent, to walk the
 * siblings. Text follows the DOM rules: entities decoded, CDATA kept apart
 * from regular text and comments discarded.
 */
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface XmlElement {
    type: 'element';
    name: string;
    attributes: Readonly<Record<string, string>>;
    children: XmlNode[];
    parent: XmlElement | null;
}

export interface XmlText {
    /** `cdata`: content of <![CDATA[...]]>. */
    type: 'text' | 'cdata';
    value: string;
    parent: XmlElement;
}

export type XmlNode = XmlElement | XmlText;

/** Node as fast-xml-parser returns it with preserveOrder. */
type RawNode = Record<string, unknown>;

const TEXT = '#text';
const CDATA = '#cdata';
const ATTRIBUTES = ':@';

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    // Entities are decoded by decodeEntities, in a single pass
    processEntities: false,
    cdataPropName: CDATA,
    ignoreDeclaration: true,
    ignorePiTags: true,
});

const XML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodes XML entities and numeric references (&#233; &#xE9;). */
export function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity: string, name: string) => {
        if (name.startsWith('#')) {
            const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
        }
        return XML_ENTITIES[name] ?? entity;
    });
}

function toNodes(raw: readonly RawNode[], parent: XmlElement): XmlNode[] {
    const nodes: XmlNode[] = [];
    for (const item of raw) {
        for (const [key, value] of Object.entries(item)) {
            if (key === ATTRIBUTES) continue;
            if (key === TEXT) {
                nodes.push({ type: 'text', value: decodeEntities(String(value)), parent });
            } else if (key === CDATA) {
                // CDATA content is literal: entities are not decoded
                const content = (value as { [TEXT]?: string }[]).map((text) => text[TEXT] ?? '').join('');
                nodes.push({ type: 'cdata', value: content, parent });
            } else {
                const attributes = Object.fromEntries(
                    Object.entries((item[ATTRIBUTES] ?? {}) as Record<string, unknown>).map(([name, attr]) => [
                        name,
                        decodeEntities(String(attr)),
                    ]),
                );
                const element: XmlElement = { type: 'element', name: key, attributes, children: [], parent };
                element.children = toNodes(value as RawNode[], element);
                nodes.push(element);
            }
        }
    }
    return nodes;
}

/** Parses the XML; throws if it is invalid. Returns the document root ("#document"). */
export function parseXml(xmlContent: string): XmlElement {
    // The recommended replacement (fast-xml-validator) adds ~40 KB gzip to the
    // bundle; this validator shares code with the parser and costs nothing extra.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const validation = XMLValidator.validate(xmlContent);
    if (validation !== true) {
        const { msg, line, col } = validation.err;
        throw new Error(`XML parsing error: ${msg} (line ${line}, column ${col})`);
    }

    const document: XmlElement = { type: 'element', name: '#document', attributes: {}, children: [], parent: null };
    document.children = toNodes(parser.parse(xmlContent) as RawNode[], document);
    return document;
}

/** Descendant elements with the given name, in document order (like getElementsByTagName). */
export function descendants(root: XmlElement, name: string): XmlElement[] {
    const found: XmlElement[] = [];
    const visit = (element: XmlElement) => {
        for (const child of element.children) {
            if (child.type === 'element') {
                if (child.name === name) found.push(child);
                visit(child);
            }
        }
    };
    visit(root);
    return found;
}

/** Text of a node and all its descendants, including CDATA (like textContent). */
export function textContent(node: XmlNode): string {
    return node.type === 'element' ? node.children.map(textContent).join('') : node.value;
}

/** Following siblings of the node, in order (like nextSibling). */
export function* nextSiblings(node: XmlNode): Generator<XmlNode> {
    const siblings = node.parent?.children ?? [];
    for (let i = siblings.indexOf(node) + 1; i < siblings.length; i++) {
        yield siblings[i] as XmlNode;
    }
}
