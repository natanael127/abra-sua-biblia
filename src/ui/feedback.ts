/** Mostra uma mensagem curta na parte de baixo da tela por 3 segundos. */
export function showTemporaryMessage(message: string): void {
    document.querySelector('.temporary-message')?.remove();

    const messageElement = document.createElement('div');
    messageElement.className = 'temporary-message';
    messageElement.setAttribute('role', 'status');
    messageElement.textContent = message;
    document.body.appendChild(messageElement);

    // Mostrar com animação
    setTimeout(() => {
        messageElement.classList.add('show');
    }, 10);

    setTimeout(() => {
        messageElement.classList.remove('show');
        // Esperar a animação de fade-out
        setTimeout(() => {
            messageElement.remove();
        }, 500);
    }, 3000);
}

export async function copyTextToClipboard(text: string): Promise<void> {
    // Clipboard API (mais moderna; ausente fora de contextos seguros)
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard) {
        await clipboard.writeText(text);
        return;
    }

    // Elemento temporário + execCommand (funciona melhor em dispositivos móveis antigos)
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.left = '-999999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- alternativa para navegadores sem Clipboard API
    const successful = document.execCommand('copy');
    textArea.remove();
    if (!successful) {
        throw new Error('Falha ao copiar texto com execCommand');
    }
}

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
