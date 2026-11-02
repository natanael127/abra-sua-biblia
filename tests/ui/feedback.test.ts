// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, showTemporaryMessage } from '../../src/ui/feedback';

const toasts = () => Array.from(document.querySelectorAll<HTMLElement>('.temporary-message'));

describe('showTemporaryMessage', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the message as text, without interpreting HTML', () => {
        showTemporaryMessage('<img src=x onerror=alert(1)> copiado');
        const [toast] = toasts();
        expect(toast?.textContent).toBe('<img src=x onerror=alert(1)> copiado');
        expect(toast?.querySelector('img')).toBeNull();
    });

    it('shows one message at a time', () => {
        showTemporaryMessage('Primeira');
        showTemporaryMessage('Segunda');
        const visible = toasts().filter((toast) => !toast.classList.contains('notyf__toast--disappear'));
        expect(visible.map((toast) => toast.textContent)).toEqual(['Segunda']);
    });

    it('announces the message to screen readers', () => {
        vi.useFakeTimers();
        showTemporaryMessage('Link copiado');
        // Notyf waits 100 ms before announcing, for screen reader compatibility
        vi.advanceTimersByTime(100);
        const announcer = document.querySelector('[aria-live]');
        expect(announcer?.textContent).toContain('Link copiado');
    });

    it('disappears after 3 seconds', () => {
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

    it('uses the Clipboard API when available', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        setClipboard({ writeText });
        const execCommand = setExecCommand(true);
        await copyTextToClipboard('Jo 3,16');
        expect(writeText).toHaveBeenCalledWith('Jo 3,16');
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('without the Clipboard API, copies with execCommand and removes the temporary element', async () => {
        const execCommand = setExecCommand(true);
        const children = document.body.childElementCount;
        await copyTextToClipboard('texto');
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.body.childElementCount).toBe(children);
    });

    it('if the Clipboard API refuses, tries execCommand', async () => {
        setClipboard({ writeText: () => Promise.reject(new Error('no permission')) });
        const execCommand = setExecCommand(true);
        await copyTextToClipboard('texto');
        expect(execCommand).toHaveBeenCalledWith('copy');
    });

    it('fails if neither can copy', async () => {
        setExecCommand(false);
        await expect(copyTextToClipboard('texto')).rejects.toThrow();
    });
});
