/**
 * Leitura de XML com o fast-xml-parser, igual no navegador e no Node.
 *
 * O resultado é uma árvore simples, com a ordem original dos nós (o OSIS e o
 * USFX misturam texto e elementos) e referência ao pai, para percorrer os
 * irmãos. O texto segue as regras do DOM: entidades decodificadas, CDATA
 * separado do texto comum e comentários descartados.
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
    /** `cdata`: conteúdo de <![CDATA[...]]>. */
    type: 'text' | 'cdata';
    value: string;
    parent: XmlElement;
}

export type XmlNode = XmlElement | XmlText;

/** Nó como o fast-xml-parser o devolve com preserveOrder. */
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
    // As entidades são decodificadas por decodeEntities, numa única passada
    processEntities: false,
    cdataPropName: CDATA,
    ignoreDeclaration: true,
    ignorePiTags: true,
});

const XML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodifica as entidades do XML e as referências numéricas (&#233; &#xE9;). */
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
                // O conteúdo do CDATA é literal: não decodifica entidades
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

/** Interpreta o XML; lança erro se for inválido. Devolve a raiz do documento ("#document"). */
export function parseXml(xmlContent: string): XmlElement {
    // O substituto recomendado (fast-xml-validator) soma ~40 KB gzip ao bundle;
    // este validador compartilha o código do parser e não custa nada a mais.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const validation = XMLValidator.validate(xmlContent);
    if (validation !== true) {
        const { msg, line, col } = validation.err;
        throw new Error(`XML parsing error: ${msg} (linha ${line}, coluna ${col})`);
    }

    const document: XmlElement = { type: 'element', name: '#document', attributes: {}, children: [], parent: null };
    document.children = toNodes(parser.parse(xmlContent) as RawNode[], document);
    return document;
}

/** Elementos descendentes com o nome, na ordem do documento (como getElementsByTagName). */
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

/** Texto de um nó e de todos os descendentes, inclusive CDATA (como textContent). */
export function textContent(node: XmlNode): string {
    return node.type === 'element' ? node.children.map(textContent).join('') : node.value;
}

/** Irmãos seguintes do nó, em ordem (como nextSibling). */
export function* nextSiblings(node: XmlNode): Generator<XmlNode> {
    const siblings = node.parent?.children ?? [];
    for (let i = siblings.indexOf(node) + 1; i < siblings.length; i++) {
        yield siblings[i] as XmlNode;
    }
}
