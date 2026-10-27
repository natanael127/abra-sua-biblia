// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showTemporaryMessage } from '../../src/ui/feedback';

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
