import clipboardCopy from 'clipboard-copy';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import { escapeHtml } from '../core/text';

const MESSAGE_DURATION_MS = 3000;

let notyf: Notyf | undefined;

/** Created on the first message: Notyf inserts its containers into the <body>. */
function getNotyf(): Notyf {
    notyf ??= new Notyf({
        duration: MESSAGE_DURATION_MS,
        position: { x: 'center', y: 'bottom' },
        ripple: false,
        types: [
            {
                type: 'info',
                className: 'temporary-message',
                background: 'var(--button-active-bg)',
                icon: false,
            },
        ],
    });
    return notyf;
}

/** Shows a short message at the bottom of the screen, one at a time, announced to screen readers. */
export function showTemporaryMessage(message: string): void {
    const toasts = getNotyf();
    toasts.dismissAll();
    // Notyf inserts the message as HTML
    toasts.open({ type: 'info', message: escapeHtml(message) });
}

/**
 * Copies the text to the clipboard: Clipboard API and, if it is missing or
 * refuses (outside a secure context, no permission), execCommand('copy'),
 * for old browsers.
 */
export const copyTextToClipboard = (text: string): Promise<void> => clipboardCopy(text);

/**
 * Converts the displayed passage to plain text: <br> and the end of each <span>
 * (section titles and citation) become line breaks.
 */
export function toPlainText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach((br) => {
        br.replaceWith('\n');
    });
    clone.querySelectorAll('span').forEach((span) => {
        span.after('\n');
    });
    return clone.textContent;
}
