import { debounce } from 'es-toolkit';
import type { EbfDocument } from '../core/ebf';
import {
    highlightMatches,
    highlightTerms,
    isSearchIndexReady,
    MIN_QUERY_LENGTH,
    prepareSearchIndex,
    type SearchResponse,
    type SearchOrder,
    searchVerses,
} from '../core/search';
import { t } from '../i18n';
import { getModalContent, getOrCreateModal } from './modal';
import { getSearchOrder, saveSearchOrder } from './storage';

/** Called when the user picks a reference in one of the modals. */
export type SelectReference = (reference: string) => void;

export function showHistoryModal(history: readonly string[], onSelect: SelectReference): void {
    const modal = getOrCreateModal({
        id: 'history-modal',
        title: t('modals.history.title'),
        contentHtml: '<ul class="history-list"></ul>',
    });

    const historyList = getModalContent(modal).querySelector('.history-list');
    if (!historyList) return;
    historyList.replaceChildren();

    if (history.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'history-list-item';
        emptyItem.textContent = t('modals.history.empty');
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
        title: t('modals.referenceHelp.title'),
        contentHtml: instructionsHtml,
    }).showModal();
}

const link = (href: string, text: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

/** Built on each opening, so that it follows the interface language. */
const fileHelpHtml = () => `
    <strong>${t('modals.fileHelp.formats')}</strong>
    <ul>
        <li>
            <strong>EBF/JSON</strong><br>
            ${link('https://github.com/natanael127/easy-bible-format', 'Easy Bible Format')}
        </li>
        <li>
            <strong>OSIS/XML</strong><br>
            ${link('https://crosswire.org/osis/', 'Open Scripture Information Standard')}
        </li>
        <li>
            <strong>USFX/XML</strong><br>
            ${link('https://ebible.org/usfx/', 'Unified Scripture Format XML')}
        </li>
    </ul>
    <strong>${t('modals.fileHelp.repositories')}</strong>
    <ul>
        <li>${link('https://ebible.org/find/', 'eBible')}</li>
        <li>${link('https://github.com/natanael127/ebf-converted-bibles', t('modals.fileHelp.convertedBibles'))}</li>
        <li>${link('https://github.com/gratis-bible/bible', t('modals.fileHelp.osisBibles'))}</li>
    </ul>
`;

export function showFileHelpModal(): void {
    getOrCreateModal({
        id: 'file-help-modal',
        title: t('modals.fileHelp.title'),
        contentHtml: fileHelpHtml(),
    }).showModal();
}

const TEXT_SEARCH_ID = 'text-search-modal';

/** Set when the search modal is created (there is only one). */
let onSearchOpened: (() => void) | undefined;

function createTextSearchModal(getBible: () => EbfDocument | null, onSelect: SelectReference): HTMLDialogElement {
    const modal = getOrCreateModal({ id: TEXT_SEARCH_ID, title: t('modals.textSearch.title'), className: 'text-search-modal' });

    const content = getModalContent(modal);
    content.style.padding = '0';
    content.style.maxHeight = 'none';

    const inputRow = document.createElement('div');
    inputRow.className = 'text-search-input-row';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'text-search-input';
    searchInput.placeholder = t('modals.textSearch.placeholder', { min: MIN_QUERY_LENGTH });
    inputRow.appendChild(searchInput);

    const countEl = document.createElement('div');
    countEl.className = 'text-search-count';

    // Index state (data-ranked: relevance search ready) and choice of result order
    const optionsRow = document.createElement('div');
    optionsRow.className = 'text-search-options';
    const statusEl = document.createElement('div');
    statusEl.className = 'text-search-status';

    // Segmented control showing both orders at once
    const orderGroup = document.createElement('div');
    orderGroup.className = 'text-search-order';
    orderGroup.setAttribute('role', 'radiogroup');
    orderGroup.setAttribute('aria-label', t('modals.textSearch.orderLabel'));
    const orderButtons = new Map<SearchOrder, HTMLButtonElement>();
    for (const [order, label] of [
        ['relevance', t('modals.textSearch.relevance')],
        ['book', t('modals.textSearch.byBook')],
    ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-search-order-option';
        button.setAttribute('role', 'radio');
        button.dataset.order = order;
        button.textContent = label;
        orderButtons.set(order, button);
        orderGroup.appendChild(button);
    }

    let order: SearchOrder = getSearchOrder();
    const setOrder = (value: SearchOrder) => {
        order = value;
        for (const [key, button] of orderButtons) {
            button.setAttribute('aria-checked', String(key === order));
            button.tabIndex = key === order ? 0 : -1;
        }
    };
    setOrder(order);
    optionsRow.append(statusEl, orderGroup);


    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'text-search-results';

    content.append(inputRow, countEl, optionsRow, resultsContainer);

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
        statusEl.textContent = !ranked
            ? t('modals.textSearch.preparing')
            : order === 'book'
              ? t('modals.textSearch.bibleOrder')
              : t('modals.textSearch.byRelevance');
    };

    const describeCount = ({ results, total, ranked }: SearchResponse) => {
        if (total > results.length) {
            return t(ranked ? 'modals.textSearch.mostRelevant' : 'modals.textSearch.firstResults', {
                shown: results.length,
                total,
            });
        }
        return t('modals.textSearch.results', { count: total });
    };

    const performSearch = (query: string) => {
        selectedIndex = -1;
        const bible = getBible();
        showStatus(bible);

        if (!bible) {
            showMessage(t('modals.textSearch.noBible'));
            return;
        }
        if (query.length < MIN_QUERY_LENGTH) {
            resultsContainer.replaceChildren();
            countEl.textContent = '';
            return;
        }

        const response = searchVerses(bible, query, undefined, order);
        if (response.results.length === 0) {
            showMessage(t('modals.textSearch.noResults'));
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

    /** Shows the index state and, once it is ready, redoes the open search by relevance. */
    onSearchOpened = () => {
        const bible = getBible();
        showStatus(bible);
        if (!bible || isSearchIndexReady(bible)) return;
        void prepareSearchIndex(bible).then(() => {
            if (!modal.open || getBible() !== bible) return;
            // Keep selected the verse the user was choosing with the arrow keys
            const selected = resultItems()[selectedIndex]?.dataset.reference;
            performSearch(searchInput.value.trim());
            if (selected) {
                selectItem(resultItems().findIndex((item) => item.dataset.reference === selected));
            }
        });
    };

    const chooseOrder = (value: SearchOrder) => {
        if (value === order) return;
        setOrder(value);
        saveSearchOrder(order);
        performSearch(searchInput.value.trim());
    };
    for (const [value, button] of orderButtons) {
        button.addEventListener('click', () => {
            chooseOrder(value);
        });
    }
    // Arrow keys switch between the options, as in a radio group
    orderGroup.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const next = order === 'book' ? 'relevance' : 'book';
        chooseOrder(next);
        orderButtons.get(next)?.focus();
    });

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

    // The index started being built when the Bible loaded; once ready, redo the search
    onSearchOpened?.();
}
