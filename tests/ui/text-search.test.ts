// @vitest-environment jsdom
/**
 * Modal de busca textual: transição da busca por trecho para a busca por
 * relevância quando o índice fica pronto. O índice é simulado para controlar
 * o momento exato em que fica pronto.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EbfDocument } from '../../src/core/ebf';
import type { SearchResponse, SearchResult } from '../../src/core/search';

const index = vi.hoisted(() => ({ ready: false, resolve: () => {} }));

vi.mock('../../src/core/search', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/core/search')>();
    return {
        ...actual,
        isSearchIndexReady: () => index.ready,
        prepareSearchIndex: () =>
            new Promise<void>((resolve) => {
                index.resolve = () => {
                    index.ready = true;
                    resolve();
                };
            }),
        searchVerses: (_ebf: EbfDocument, _query: string, _max?: number, order?: string): SearchResponse => {
            const verse = (v: number): SearchResult => ({ bookAbbr: 'Jo', bookName: 'João', chapter: 1, verse: v, text: `v${v}` });
            // Na ordem da Bíblia antes do índice; por relevância (ordem trocada) depois
            if (order === 'book') {
                return { results: [verse(1), verse(2), verse(3)].map((r) => ({ ...r, terms: [] })), total: 3, ranked: false };
            }
            return index.ready
                ? { results: [verse(3), verse(1), verse(2)].map((r) => ({ ...r, terms: [] })), total: 3, ranked: true }
                : { results: [verse(1), verse(2), verse(3)], total: 3, ranked: false };
        },
    };
});

const { showTextSearchModal } = await import('../../src/ui/dialogs');
const { getSearchOrder } = await import('../../src/ui/storage');

const bible = { bible: { name: 'Teste', books: [] } } as EbfDocument;
/** O modal é criado na primeira abertura e mantém este callback. */
const onSelect = vi.fn();
const modal = () => document.getElementById('text-search-modal') as HTMLDialogElement;
const input = () => modal().querySelector<HTMLInputElement>('.text-search-input')!;
const status = () => modal().querySelector<HTMLElement>('.text-search-status')!;
const citations = () => Array.from(modal().querySelectorAll('.text-search-result-citation'), (e) => e.textContent);
const selected = () => modal().querySelector('.text-search-result-item.selected .text-search-result-citation')?.textContent;
const orderOption = (order: string) => modal().querySelector<HTMLButtonElement>(`.text-search-order-option[data-order="${order}"]`)!;
const checkedOrder = () => modal().querySelector('.text-search-order-option[aria-checked="true"]')?.getAttribute('data-order');
const press = (key: string) => input().dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));

beforeAll(() => {
    // O jsdom não implementa <dialog> modal nem a rolagem
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
    };
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    index.ready = false;
    localStorage.clear();
    onSelect.mockClear();
});

async function typeQuery(query: string) {
    input().value = query;
    input().dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
        expect(citations()).toHaveLength(3);
    });
}

describe('modal de busca textual', () => {
    it('refaz a busca por relevância quando o índice fica pronto', async () => {
        showTextSearchModal(() => bible, onSelect);
        expect(status().dataset.ranked).toBe('false');
        expect(status().textContent).toBe('Preparando a busca por relevância…');

        await typeQuery('luz');
        expect(citations()).toEqual(['João 1,1', 'João 1,2', 'João 1,3']);

        index.resolve();
        await vi.waitFor(() => {
            expect(status().dataset.ranked).toBe('true');
        });
        expect(status().textContent).toBe('Por relevância');
        expect(citations()).toEqual(['João 1,3', 'João 1,1', 'João 1,2']);
        modal().close();
    });

    it('mantém o versículo selecionado com as setas quando a busca é refeita', async () => {
        showTextSearchModal(() => bible, onSelect);
        await typeQuery('luz');

        press('ArrowDown');
        press('ArrowDown');
        expect(selected()).toBe('João 1,2');

        index.resolve();
        await vi.waitFor(() => {
            expect(citations()[0]).toBe('João 1,3');
        });
        // Mesmo versículo, agora na 3ª posição
        expect(selected()).toBe('João 1,2');

        press('Enter');
        expect(onSelect).toHaveBeenCalledWith('Jo 1,2');
        expect(modal().open).toBe(false);
    });

    it('com o índice já pronto, mostra a ordem por relevância ao abrir', () => {
        index.ready = true;
        showTextSearchModal(() => bible, onSelect);
        expect(status().dataset.ranked).toBe('true');
        modal().close();
    });

    it('troca para a ordem por livro, refaz a busca e lembra a escolha', async () => {
        index.ready = true;
        showTextSearchModal(() => bible, onSelect);
        expect(checkedOrder()).toBe('relevance');
        await typeQuery('luz');
        expect(citations()).toEqual(['João 1,3', 'João 1,1', 'João 1,2']);

        orderOption('book').click();
        expect(checkedOrder()).toBe('book');
        expect(citations()).toEqual(['João 1,1', 'João 1,2', 'João 1,3']);
        expect(status().textContent).toBe('Na ordem da Bíblia');
        expect(localStorage.getItem('searchOrder')).toBe('book');
        modal().close();

        // O modal é recriado só uma vez; a escolha salva vale para novas sessões
        expect(getSearchOrder()).toBe('book');
    });
});
