// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink } from '../../src/ui/share';

const data = { title: 'Jo 3,16 (Ave-Maria)', url: 'https://www.abrasuabiblia.com.br/ave-maria/jo/3,16' };

const setNavigator = (name: 'share' | 'clipboard', value: unknown) => {
    Object.defineProperty(navigator, name, { value, configurable: true });
};

function mockClipboard() {
    const writeText = vi.fn(() => Promise.resolve());
    setNavigator('clipboard', { writeText });
    return writeText;
}

afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
    setNavigator('clipboard', undefined);
    vi.restoreAllMocks();
});

describe('shareLink', () => {
    it('usa a Web Share API, com o título também como texto', async () => {
        const share = vi.fn(() => Promise.resolve());
        setNavigator('share', share);
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('shared');
        expect(share).toHaveBeenCalledWith({ title: data.title, text: data.title, url: data.url });
        expect(writeText).not.toHaveBeenCalled();
    });

    it('não copia nada se o usuário fechar a folha de compartilhamento', async () => {
        setNavigator('share', () => Promise.reject(new DOMException('cancelado', 'AbortError')));
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('cancelled');
        expect(writeText).not.toHaveBeenCalled();
    });

    it('se a Web Share API recusar, copia o link', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        setNavigator('share', () => Promise.reject(new DOMException('sem permissão', 'NotAllowedError')));
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('copied');
        expect(writeText).toHaveBeenCalledWith(data.url);
    });

    it('sem a Web Share API, copia o link', async () => {
        expect('share' in navigator).toBe(false);
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('copied');
        expect(writeText).toHaveBeenCalledWith(data.url);
    });

    it('rejeita se nem a cópia funcionar', async () => {
        Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
        await expect(shareLink(data)).rejects.toThrow();
    });
});
