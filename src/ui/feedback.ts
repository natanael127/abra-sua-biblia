import clipboardCopy from 'clipboard-copy';
import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';
import { escapeHtml } from '../core/text';

const MESSAGE_DURATION_MS = 3000;

let notyf: Notyf | undefined;

/** Criado na primeira mensagem: o Notyf insere seus contêineres no <body>. */
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

/** Mostra uma mensagem curta na parte de baixo da tela, uma de cada vez, anunciada aos leitores de tela. */
export function showTemporaryMessage(message: string): void {
    const toasts = getNotyf();
    toasts.dismissAll();
    // O Notyf insere a mensagem como HTML
    toasts.open({ type: 'info', message: escapeHtml(message) });
}

/**
 * Copia o texto para a área de transferência: Clipboard API e, se ela não
 * existir ou recusar (fora de contexto seguro, sem permissão), o
 * execCommand('copy'), para navegadores antigos.
 */
export const copyTextToClipboard = (text: string): Promise<void> => clipboardCopy(text);

/**
 * Converte o trecho exibido em texto puro: <br> e o fim de cada <span>
 * (títulos de seção e citação) viram quebras de linha.
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
