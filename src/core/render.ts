/**
 * Renderers of a passage (see ./passage): HTML for reading and plain text for
 * copying. Each one decides the layout of its format on its own.
 */
import type { EbfDocument } from './ebf';
import { buildPassage, type DisplayOptions, type Passage, type PassageElement } from './passage';
import { escapeHtml, toSuperscript } from './text';

export interface RenderResult {
    error: boolean;
    html: string;
    /** The passage displayed; absent on error. */
    passage?: Passage;
}

/**
 * Where the quotes that wrap the passage go: the opening one before the first
 * verse (after its section title, if it has one), the closing one after the
 * last verse. -1 when the passage is not quoted or has no verse.
 */
function quotePositions(passage: Passage): { open: number; close: number } {
    const { elements } = passage;
    const first = elements.findIndex((element) => element.type === 'verse');
    if (!passage.quoted || first < 0) {
        return { open: -1, close: -1 };
    }
    const close = elements.findLastIndex((element) => element.type === 'verse');
    return { open: first, close };
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
            case 'resulting-reference':
                // The class keeps its old name ("verse-reference"), used by the style
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

/**
 * Plain text of the passage, for the clipboard: verse numbers in superscript
 * and each section title in a paragraph of its own, separated by blank lines
 * from what comes before and after it.
 */
export function renderPassageText(passage: Passage): string {
    const { open, close } = quotePositions(passage);
    const separator = passage.lineBreaks ? '\n' : ' ';

    let text = '';
    /** The next element starts a paragraph: no separator before it. */
    let paragraphStart = true;
    passage.elements.forEach((element, index) => {
        let rendered: string;
        switch (element.type) {
            case 'title':
                rendered = element.text;
                break;
            case 'verse':
                rendered = element.number === undefined ? element.text : `${toSuperscript(element.number)} ${element.text}`;
                break;
            case 'omission':
                rendered = element.text;
                break;
            case 'resulting-reference':
                rendered = `(${element.text})`;
                break;
        }
        if (index === open) rendered = `"${rendered}`;
        if (index === close) rendered = `${rendered}"`;

        if (element.type === 'title') {
            text += `${text ? '\n\n' : ''}${rendered}\n\n`;
            paragraphStart = true;
        } else {
            text += `${paragraphStart ? '' : separator}${rendered}`;
            paragraphStart = false;
        }
    });

    return text;
}

/**
 * Generates the HTML of the Bible passage asked for by the input reference.
 * `instructionsHtml` is shown when the input reference cannot be parsed. The
 * resulting reference is in `passage.resultingReference`.
 */
export function renderInputReference(
    inputReference: string,
    ebf: EbfDocument | null,
    displayOpt: DisplayOptions,
    instructionsHtml: string,
): RenderResult {
    const result = buildPassage(inputReference, ebf, displayOpt);
    switch (result.kind) {
        case 'invalid-input-reference':
            return { error: true, html: instructionsHtml };
        case 'error':
            return { error: true, html: result.html };
        case 'passage':
            return { error: false, html: renderPassageHtml(result.passage), passage: result.passage };
    }
}
