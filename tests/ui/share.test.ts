// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink } from '../../src/ui/share';

const data = { title: 'Jo 3,16 (Ave-Maria)', url: 'https://www.abrasuabiblia.com.br/por/ave-maria/jo/3,16' };

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
    it('uses the Web Share API, with the title also as text', async () => {
        const share = vi.fn(() => Promise.resolve());
        setNavigator('share', share);
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('shared');
        expect(share).toHaveBeenCalledWith({ title: data.title, text: data.title, url: data.url });
        expect(writeText).not.toHaveBeenCalled();
    });

    it('copies nothing if the user closes the share sheet', async () => {
        setNavigator('share', () => Promise.reject(new DOMException('cancelled', 'AbortError')));
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('cancelled');
        expect(writeText).not.toHaveBeenCalled();
    });

    it('if the Web Share API refuses, copies the link', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        setNavigator('share', () => Promise.reject(new DOMException('no permission', 'NotAllowedError')));
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('copied');
        expect(writeText).toHaveBeenCalledWith(data.url);
    });

    it('without the Web Share API, copies the link', async () => {
        expect('share' in navigator).toBe(false);
        const writeText = mockClipboard();

        await expect(shareLink(data)).resolves.toBe('copied');
        expect(writeText).toHaveBeenCalledWith(data.url);
    });

    it('rejects if even copying fails', async () => {
        Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
        await expect(shareLink(data)).rejects.toThrow();
    });
});
