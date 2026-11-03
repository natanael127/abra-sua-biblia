/**
 * Renderers of a passage (see ./passage): HTML for reading and plain text for
 * copying. Each one decides the layout of its format on its own.
 */
import type { EbfDocument } from './ebf';
import { buildPassage, type DisplayOptions, type Passage, type PassageElement } from './passage';
import { escapeHtml } from './text';

export interface RenderResult {
    error: boolean;
    html: string;
    /** The passage displayed; absent on error. */
    passage?: Passage;
}

/**
 * Where the quotes that wrap the passage go: the opening one before the first
 * verse (before its section title, if it has one), the closing one after the
 * last verse. -1 when the passage is not quoted or has no verse.
 */
function quotePositions(passage: Passage): { open: number; close: number } {
    const { elements } = passage;
    const first = elements.findIndex((element) => element.type === 'verse');
    if (!passage.quoted || first < 0) {
        return { open: -1, close: -1 };
    }
    const close = elements.findLastIndex((element) => element.type === 'verse');
    return { open: first > 0 && elements[first - 1]?.type === 'title' ? first - 1 : first, close };
}

/**
 * Groups the elements into the lines (or, without line breaks, the
 * space-separated chunks) of the passage: a section title stays with the verse
 * it introduces.
 */
function groupLines(elements: readonly PassageElement[], render: (element: PassageElement, index: number) => string): string[] {
    const lines: string[] = [];
    let pending = '';
    elements.forEach((element, index) => {
        const rendered = render(element, index);
        if (element.type === 'title') {
            pending += rendered;
        } else {
            lines.push(pending + rendered);
            pending = '';
        }
    });
    if (pending) lines.push(pending);
    return lines;
}

/** HTML of the passage, for the reading area. */
export function renderPassageHtml(passage: Passage): string {
    const { open, close } = quotePositions(passage);

    const lines = groupLines(passage.elements, (element, index) => {
        let html: string;
        switch (element.type) {
            case 'title':
                html = `<span class="section-title">${escapeHtml(element.text)}</span>`;
                break;
            case 'verse':
                html = escapeHtml(element.text);
                if (element.number !== undefined) {
                    html = `<sup>${element.number}</sup> ${html}`;
                }
                break;
            case 'omission':
                html = escapeHtml(element.text);
                break;
            case 'citation':
                html = `<span class="verse-reference">(${escapeHtml(element.text)})</span>`;
                break;
        }
        if (index === open) html = `"${html}`;
        if (index === close) html = `${html}"`;
        return html;
    });

    const content = lines.join(passage.lineBreaks ? '<br>' : ' ');
    return `<div class="reference">${escapeHtml(passage.heading)}</div><div class="verse-text">${content}</div>`;
}

/** Plain text of the passage, for the clipboard. */
export function renderPassageText(passage: Passage): string {
    const { open, close } = quotePositions(passage);

    const lines = groupLines(passage.elements, (element, index) => {
        let text: string;
        switch (element.type) {
            case 'title':
                text = `${element.text}\n`;
                break;
            case 'verse':
                text = element.number === undefined ? element.text : `${element.number} ${element.text}`;
                break;
            case 'omission':
                text = element.text;
                break;
            case 'citation':
                text = `(${element.text})\n`;
                break;
        }
        if (index === open) text = `"${text}`;
        if (index === close) text = `${text}"`;
        return text;
    });

    return lines.join(passage.lineBreaks ? '\n' : ' ');
}

/**
 * Generates the HTML of the Bible passage indicated by the reference.
 * `instructionsHtml` is shown when the reference cannot be parsed.
 */
export function renderReference(
    reference: string,
    ebf: EbfDocument | null,
    displayOpt: DisplayOptions,
    instructionsHtml: string,
): RenderResult {
    const result = buildPassage(reference, ebf, displayOpt);
    switch (result.kind) {
        case 'invalid-reference':
            return { error: true, html: instructionsHtml };
        case 'error':
            return { error: true, html: result.html };
        case 'passage':
            return { error: false, html: renderPassageHtml(result.passage), passage: result.passage };
    }
}
