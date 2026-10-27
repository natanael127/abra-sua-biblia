import { debounce } from 'es-toolkit';
import type { EbfDocument } from '../core/ebf';
import {
    highlightMatches,
    highlightTerms,
    isSearchIndexReady,
    MIN_QUERY_LENGTH,
    prepareSearchIndex,
    type SearchResponse,
    searchVerses,
} from '../core/search';
import { getModalContent, getOrCreateModal } from './modal';

/** Chamado quando o usuário escolhe uma referência num dos modais. */
export type SelectReference = (reference: string) => void;

export function showHistoryModal(history: readonly string[], onSelect: SelectReference): void {
    const modal = getOrCreateModal({
        id: 'history-modal',
        title: 'Histórico de buscas',
        contentHtml: '<ul class="history-list"></ul>',
    });

    const historyList = getModalContent(modal).querySelector('.history-list');
    if (!historyList) return;
    historyList.replaceChildren();

    if (history.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'history-list-item';
        emptyItem.textContent = 'Nenhuma busca recente';
        historyList.appendChild(emptyItem);
    }

    for (const item of history) {
        const listItem = document.createElement('li');
        listItem.className = 'history-list-item';
        listItem.textContent = item;
        listItem.addEventListener('click', () => {
            modal.close();
            onSelect(item);
        });
        historyList.appendChild(listItem);
    }

    modal.showModal();
}

export function showReferenceHelpModal(instructionsHtml: string): void {
    getOrCreateModal({
        id: 'reference-help-modal',
        title: 'Referência bíblica',
        contentHtml: instructionsHtml,
    }).showModal();
}

const FILE_HELP_HTML = `
    <strong>Formatos suportados:</strong>
    <ul>
        <li>
            <strong>EBF/JSON</strong><br>
            <a href="https://github.com/natanael127/easy-bible-format" target="_blank" rel="noopener noreferrer">Easy Bible Format</a>
        </li>
        <li>
            <strong>OSIS/XML</strong><br>
            <a href="https://crosswire.org/osis/" target="_blank" rel="noopener noreferrer">Open Scripture Information Standard</a>
        </li>
        <li>
            <strong>USFX/XML</strong><br>
            <a href="https://ebible.org/usfx/" target="_blank" rel="noopener noreferrer">Unified Scripture Format XML</a>
        </li>
    </ul>
    <strong>Repositórios de Bíblias:</strong>
    <ul>
        <li>
            <a href="https://ebible.org/find/" target="_blank" rel="noopener noreferrer">eBible</a>
        </li>
        <li>
            <a href="https://github.com/natanael127/ebf-converted-bibles" target="_blank" rel="noopener noreferrer">Bíblias convertidas para EBF</a>
        </li>
        <li>
            <a href="https://github.com/gratis-bible/bible" target="_blank" rel="noopener noreferrer">Bíblias no formato OSIS</a>
        </li>
    </ul>
`;

export function showFileHelpModal(): void {
    getOrCreateModal({ id: 'file-help-modal', title: 'Upload de arquivos', contentHtml: FILE_HELP_HTML }).showModal();
}

const TEXT_SEARCH_ID = 'text-search-modal';

/** Definido ao criar o modal de busca (há um só). */
let onSearchOpened: (() => void) | undefined;

function createTextSearchModal(getBible: () => EbfDocument | null, onSelect: SelectReference): HTMLDialogElement {
    const modal = getOrCreateModal({ id: TEXT_SEARCH_ID, title: 'Busca textual', className: 'text-search-modal' });

    const content = getModalContent(modal);
    content.style.padding = '0';
    content.style.maxHeight = 'none';

    const inputRow = document.createElement('div');
    inputRow.className = 'text-search-input-row';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'text-search-input';
    searchInput.placeholder = `Digite pelo menos ${MIN_QUERY_LENGTH} caracteres...`;
    inputRow.appendChild(searchInput);

    const countEl = document.createElement('div');
    countEl.className = 'text-search-count';

    // Ordem dos resultados; data-ranked indica a busca por relevância
    const statusEl = document.createElement('div');
    statusEl.className = 'text-search-status';

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'text-search-results';

    content.append(inputRow, countEl, statusEl, resultsContainer);

    let selectedIndex = -1;

    const showMessage = (message: string) => {
        const element = document.createElement('div');
        element.className = 'text-search-no-results';
        element.textContent = message;
        resultsContainer.replaceChildren(element);
        countEl.textContent = '';
    };

    const showStatus = (bible: EbfDocument | null) => {
        const ranked = !!bible && isSearchIndexReady(bible);
        statusEl.dataset.ranked = String(ranked);
        statusEl.textContent = ranked ? 'Por relevância' : 'Preparando a busca por relevância…';
    };

    const describeCount = ({ results, total, ranked }: SearchResponse) => {
        if (total > results.length) {
            return ranked ? `${results.length} mais relevantes de ${total}` : `Primeiros ${results.length} de ${total}`;
        }
        return `${total} resultado${total > 1 ? 's' : ''}`;
    };

    const performSearch = (query: string) => {
        selectedIndex = -1;
        const bible = getBible();
        showStatus(bible);

        if (!bible) {
            showMessage('Nenhuma Bíblia carregada');
            return;
        }
        if (query.length < MIN_QUERY_LENGTH) {
            resultsContainer.replaceChildren();
            countEl.textContent = '';
            return;
        }

        const response = searchVerses(bible, query);
        if (response.results.length === 0) {
            showMessage('Nenhum versículo encontrado');
            return;
        }

        countEl.textContent = describeCount(response);

        const fragment = document.createDocumentFragment();
        for (const r of response.results) {
            const item = document.createElement('div');
            item.className = 'text-search-result-item';

            const textEl = document.createElement('div');
            textEl.className = 'text-search-result-text';
            textEl.innerHTML = r.terms ? highlightTerms(r.text, r.terms) : highlightMatches(r.text, query);

            const citeEl = document.createElement('div');
            citeEl.className = 'text-search-result-citation';
            citeEl.textContent = `${r.bookName} ${r.chapter},${r.verse}`;

            const reference = `${r.bookAbbr} ${r.chapter},${r.verse}`;
            item.dataset.reference = reference;
            item.append(textEl, citeEl);
            item.addEventListener('click', () => {
                modal.close();
                onSelect(reference);
            });
            fragment.appendChild(item);
        }
        resultsContainer.replaceChildren(fragment);
    };

    const resultItems = () => Array.from(resultsContainer.querySelectorAll<HTMLElement>('.text-search-result-item'));

    const selectItem = (index: number) => {
        const items = resultItems();
        selectedIndex = index;
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
        });
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    };

    /** Mostra o estado do índice e, quando ele fica pronto, refaz a busca aberta por relevância. */
    onSearchOpened = () => {
        const bible = getBible();
        showStatus(bible);
        if (!bible || isSearchIndexReady(bible)) return;
        void prepareSearchIndex(bible).then(() => {
            if (!modal.open || getBible() !== bible) return;
            // Mantém selecionado o versículo que o usuário escolhia com as setas
            const selected = resultItems()[selectedIndex]?.dataset.reference;
            performSearch(searchInput.value.trim());
            if (selected) {
                selectItem(resultItems().findIndex((item) => item.dataset.reference === selected));
            }
        });
    };

    searchInput.addEventListener(
        'input',
        debounce(() => {
            performSearch(searchInput.value.trim());
        }, 300),
    );

    searchInput.addEventListener('keydown', (event) => {
        const items = resultItems();
        if (items.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectItem(Math.min(selectedIndex + 1, items.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectItem(Math.max(selectedIndex - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            items[selectedIndex]?.click();
        }
    });

    modal.addEventListener('close', () => {
        searchInput.value = '';
        resultsContainer.replaceChildren();
        countEl.textContent = '';
        selectedIndex = -1;
    });

    return modal;
}

export function showTextSearchModal(getBible: () => EbfDocument | null, onSelect: SelectReference): void {
    const existing = document.getElementById(TEXT_SEARCH_ID);
    const modal =
        existing instanceof HTMLDialogElement ? existing : createTextSearchModal(getBible, onSelect);
    modal.showModal();
    modal.querySelector<HTMLInputElement>('.text-search-input')?.focus();

    // O índice já começou a ser montado na carga da Bíblia; ao ficar pronto, refaz a busca
    onSearchOpened?.();
}
