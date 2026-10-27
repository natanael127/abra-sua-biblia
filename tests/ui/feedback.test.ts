// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, showTemporaryMessage } from '../../src/ui/feedback';

const toasts = () => Array.from(document.querySelectorAll<HTMLElement>('.temporary-message'));

describe('showTemporaryMessage', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('mostra a mensagem como texto, sem interpretar HTML', () => {
        showTemporaryMessage('<img src=x onerror=alert(1)> copiado');
        const [toast] = toasts();
        expect(toast?.textContent).toBe('<img src=x onerror=alert(1)> copiado');
        expect(toast?.querySelector('img')).toBeNull();
    });

    it('mostra uma mensagem de cada vez', () => {
        showTemporaryMessage('Primeira');
        showTemporaryMessage('Segunda');
        const visible = toasts().filter((toast) => !toast.classList.contains('notyf__toast--disappear'));
        expect(visible.map((toast) => toast.textContent)).toEqual(['Segunda']);
    });

    it('anuncia a mensagem aos leitores de tela', () => {
        vi.useFakeTimers();
        showTemporaryMessage('Link copiado');
        // O Notyf espera 100 ms antes de anunciar, por compatibilidade com leitores de tela
        vi.advanceTimersByTime(100);
        const announcer = document.querySelector('[aria-live]');
        expect(announcer?.textContent).toContain('Link copiado');
    });

    it('some depois de 3 segundos', () => {
        vi.useFakeTimers();
        showTemporaryMessage('Texto copiado');
        const toast = toasts().at(-1);
        expect(toast?.classList.contains('notyf__toast--disappear')).toBe(false);
        vi.advanceTimersByTime(3000);
        expect(toast?.classList.contains('notyf__toast--disappear')).toBe(true);
    });
});

describe('copyTextToClipboard', () => {
    const setClipboard = (clipboard: Partial<Clipboard> | undefined) => {
        Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    };
    const setExecCommand = (result: boolean) => {
        const execCommand = vi.fn(() => result);
        Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
        return execCommand;
    };

    afterEach(() => {
        setClipboard(undefined);
    });

    it('usa a Clipboard API quando disponível', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        setClipboard({ writeText });
        const execCommand = setExecCommand(true);
        await copyTextToClipboard('Jo 3,16');
        expect(writeText).toHaveBeenCalledWith('Jo 3,16');
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('sem a Clipboard API, copia com execCommand e remove o elemento temporário', async () => {
        const execCommand = setExecCommand(true);
        const children = document.body.childElementCount;
        await copyTextToClipboard('texto');
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.body.childElementCount).toBe(children);
    });

    it('se a Clipboard API recusar, tenta o execCommand', async () => {
        setClipboard({ writeText: () => Promise.reject(new Error('sem permissão')) });
        const execCommand = setExecCommand(true);
        await copyTextToClipboard('texto');
        expect(execCommand).toHaveBeenCalledWith('copy');
    });

    it('falha se nenhum dos dois conseguir copiar', async () => {
        setExecCommand(false);
        await expect(copyTextToClipboard('texto')).rejects.toThrow();
    });
});
