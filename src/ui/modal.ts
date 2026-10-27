export interface ModalOptions {
    id: string;
    title: string;
    /** HTML estático do conteúdo (nunca dados vindos do usuário). */
    contentHtml?: string;
    className?: string;
}

/**
 * Retorna o modal com o id informado, criando-o na primeira chamada.
 * Usa <dialog>, que já trata a tecla Esc, o foco e o fundo escurecido.
 */
export function getOrCreateModal(options: ModalOptions): HTMLDialogElement {
    const existing = document.getElementById(options.id);
    if (existing instanceof HTMLDialogElement) {
        return existing;
    }

    const modal = document.createElement('dialog');
    modal.id = options.id;
    modal.className = 'app-modal';
    if (options.className) {
        modal.classList.add(options.className);
    }

    const header = document.createElement('div');
    header.className = 'app-modal-header';

    const title = document.createElement('h3');
    title.className = 'app-modal-title';
    title.textContent = options.title;

    const closeButton = document.createElement('button');
    closeButton.className = 'close-modal';
    closeButton.title = 'Fechar';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
        modal.close();
    });

    const content = document.createElement('div');
    content.className = 'help-content';
    content.innerHTML = options.contentHtml ?? '';

    header.append(title, closeButton);
    modal.append(header, content);

    // Clique fora da caixa (no fundo escurecido) fecha o modal
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.close();
        }
    });

    document.body.appendChild(modal);
    return modal;
}

export function getModalContent(modal: HTMLDialogElement): HTMLElement {
    const content = modal.querySelector<HTMLElement>('.help-content');
    if (!content) {
        throw new Error(`Modal #${modal.id} sem conteúdo`);
    }
    return content;
}
