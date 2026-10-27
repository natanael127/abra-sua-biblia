import type { EbfDocument } from '../core/ebf';
import { highlightQuery, MAX_SEARCH_RESULTS, MIN_QUERY_LENGTH, searchVerses } from '../core/search';
import { escapeHtml } from '../core/text';
import { debounce } from './dom';
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

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'text-search-results';

    content.append(inputRow, countEl, resultsContainer);

    let selectedIndex = -1;

    const showMessage = (message: string) => {
        const element = document.createElement('div');
        element.className = 'text-search-no-results';
        element.textContent = message;
        resultsContainer.replaceChildren(element);
        countEl.textContent = '';
    };

    const performSearch = (query: string) => {
        selectedIndex = -1;
        const bible = getBible();

        if (!bible) {
            showMessage('Nenhuma Bíblia carregada');
            return;
        }
        if (query.length < MIN_QUERY_LENGTH) {
            resultsContainer.replaceChildren();
            countEl.textContent = '';
            return;
        }

        const results = searchVerses(bible, query);
        if (results.length === 0) {
            showMessage('Nenhum versículo encontrado');
            return;
        }

        countEl.textContent =
            results.length >= MAX_SEARCH_RESULTS
                ? `Primeiros ${MAX_SEARCH_RESULTS} resultados`
                : `${results.length} resultado${results.length > 1 ? 's' : ''}`;

        const fragment = document.createDocumentFragment();
        for (const r of results) {
            const item = document.createElement('div');
            item.className = 'text-search-result-item';

            const textEl = document.createElement('div');
            textEl.className = 'text-search-result-text';
            textEl.innerHTML = highlightQuery(escapeHtml(r.text), query);

            const citeEl = document.createElement('div');
            citeEl.className = 'text-search-result-citation';
            citeEl.textContent = `${r.bookName} ${r.chapter},${r.verse}`;

            item.append(textEl, citeEl);
            item.addEventListener('click', () => {
                modal.close();
                onSelect(`${r.bookAbbr} ${r.chapter},${r.verse}`);
            });
            fragment.appendChild(item);
        }
        resultsContainer.replaceChildren(fragment);
    };

    searchInput.addEventListener(
        'input',
        debounce(() => {
            performSearch(searchInput.value.trim());
        }, 300),
    );

    searchInput.addEventListener('keydown', (event) => {
        const items = resultsContainer.querySelectorAll<HTMLElement>('.text-search-result-item');
        if (items.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            items[selectedIndex]?.click();
            return;
        } else {
            return;
        }

        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
        });
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
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
}
