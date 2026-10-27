import { type EbfBook, type EbfDocument, getBookAbbreviation, getBookName, getNumOfChapters } from './core/ebf';
import { addToHistory } from './core/history';
import { parseReference } from './core/reference';
import { type DisplayOptions, renderReference } from './core/render';
import { convertXmlToEbf } from './core/xml';
import { type BibleIndexEntry, getAvailableBibles, loadBibleFromPath, parseEbfJson } from './data/bibles';
import { byId, debounce } from './ui/dom';
import { copyTextToClipboard, showTemporaryMessage, toPlainText } from './ui/feedback';
import { showFileHelpModal, showHistoryModal, showReferenceHelpModal, showTextSearchModal } from './ui/dialogs';
import * as storage from './ui/storage';
import { initializeTheme } from './ui/theme';

const UPLOAD_OPTION = 'upload';

const BIBLE_TYPE_LABELS: Record<string, string> = {
    catholic: 'Católicas',
    protestant: 'Evangélicas',
    other: 'Outras',
};
const BIBLE_TYPE_ORDER = ['catholic', 'protestant', 'other'];

/** Botões de formatação: id do botão -> opção de exibição. */
const FORMAT_BUTTONS: Record<string, keyof DisplayOptions> = {
    'display-quotes': 'quotes',
    'display-verse-numbers': 'verseNumbers',
    'display-line-breaks': 'lineBreaks',
    'display-ellipsis': 'ellipsis',
    'display-parentheses-citation': 'parenthesesCitation',
    'display-section-titles': 'sectionTitles',
};

/** Botões que só fazem sentido quando há um trecho exibido. */
const RESULT_BUTTONS = [
    'prev-chapter-button',
    'copy-button',
    'share-button',
    'next-chapter-button',
    'floating-prev-chapter-button',
    'floating-copy-button',
    'floating-share-button',
    'floating-next-chapter-button',
];

const state = {
    ebf: null as EbfDocument | null,
    instructionsHtml: '',
    displayOptions: storage.getSavedDisplayOptions(),
    /** Identifica a carga de Bíblia mais recente, para descartar respostas atrasadas. */
    loadToken: 0,
};

const referenceInput = () => byId('reference', HTMLInputElement);
const bibleSelect = () => byId('bible-select', HTMLSelectElement);

function showReference(): void {
    const reference = referenceInput().value.trim();
    storage.saveReference(reference);

    const result = renderReference(reference, state.ebf, state.displayOptions, state.instructionsHtml);

    for (const id of RESULT_BUTTONS) {
        byId(id).classList.toggle('hidden', result.error);
    }
    if (!result.error && reference) {
        storage.saveSearchHistory(addToHistory(storage.getSearchHistory(), reference));
    }

    byId('result').innerHTML = result.html;
    updateFloatingButtons();
}

function goToReference(reference: string): void {
    referenceInput().value = reference;
    storage.saveReference(reference);
    showReference();
}

function setBible(ebf: EbfDocument | null): void {
    state.ebf = ebf;
    populateBooks(ebf?.bible.books ?? []);
}

function populateBooks(books: readonly EbfBook[]): void {
    const bookList = byId('book-list');
    bookList.replaceChildren();

    for (const book of books) {
        const bookElement = document.createElement('div');
        bookElement.className = 'book-item';
        bookElement.textContent = getBookAbbreviation(book);
        bookElement.title = getBookName(book);
        bookElement.addEventListener('click', () => {
            referenceInput().value = `${getBookAbbreviation(book)} 1`;
            referenceInput().focus();
            showReference();
        });
        bookList.appendChild(bookElement);
    }

    const header = document.querySelector('.book-section .expandable-header');
    if (header) {
        header.innerHTML = `Livros (${books.length})<span class="expand-icon">▼</span>`;
    }
}

function populateBiblesSelect(biblesList: readonly BibleIndexEntry[], defaultBibleId: string | null): void {
    const select = bibleSelect();
    select.replaceChildren();

    for (const type of BIBLE_TYPE_ORDER) {
        const bibles = biblesList.filter((bible) => (bible.type || 'other') === type);
        if (bibles.length === 0) continue;

        const optgroup = document.createElement('optgroup');
        optgroup.label = BIBLE_TYPE_LABELS[type] ?? type;
        for (const bible of bibles) {
            const option = document.createElement('option');
            option.value = bible.name;
            option.textContent = bible.name;
            option.dataset.path = bible.path;
            optgroup.appendChild(option);
        }
        select.appendChild(optgroup);
    }

    const uploadOption = document.createElement('option');
    uploadOption.value = UPLOAD_OPTION;
    uploadOption.textContent = 'Fazer upload...';
    select.appendChild(uploadOption);

    const wanted = defaultBibleId?.toLowerCase();
    const index = Array.from(select.options).findIndex((option) => option.value.toLowerCase() === wanted);
    select.selectedIndex = Math.max(index, 0);

    select.dispatchEvent(new Event('change'));
}

function updateUploadVisibility(): void {
    const container = document.querySelector<HTMLElement>('.file-input-container');
    if (container) {
        container.style.display = bibleSelect().value === UPLOAD_OPTION ? 'block' : 'none';
    }
}

async function onBibleSelected(): Promise<void> {
    const select = bibleSelect();
    updateUploadVisibility();

    if (select.value === UPLOAD_OPTION) {
        await handleFileUpload(byId('bible-file', HTMLInputElement).files?.[0]);
        return;
    }
    if (!select.value) return;

    storage.saveBible(select.value);

    const token = ++state.loadToken;
    const biblePath = select.options[select.selectedIndex]?.dataset.path ?? '';
    const ebf = await loadBibleFromPath(biblePath);
    if (token !== state.loadToken) return;

    if (!ebf) {
        showTemporaryMessage('Erro ao carregar a Bíblia');
    }
    setBible(ebf);
    showReference();
}

async function handleFileUpload(file: File | undefined): Promise<void> {
    if (!file) return;

    const isJson = file.type === 'application/json' || file.name.endsWith('.json');
    const isXml = file.type === 'application/xml' || file.name.endsWith('.xml') || file.name.endsWith('.osis');
    if (!isJson && !isXml) {
        showTemporaryMessage('Formato de arquivo não suportado');
        return;
    }

    ++state.loadToken;
    const downloadButton = byId('download-ebf-button', HTMLButtonElement);
    try {
        const content = await file.text();
        setBible(isXml ? convertXmlToEbf(content) : parseEbfJson(content));
        downloadButton.disabled = false;
        downloadButton.dataset.filename = file.name;
    } catch (error) {
        console.error('Erro ao ler o arquivo da Bíblia:', error);
        downloadButton.disabled = true;
        delete downloadButton.dataset.filename;
        showTemporaryMessage('Arquivo de Bíblia inválido');
        return;
    }

    showReference();
}

/** Baixa a Bíblia carregada por upload, convertida para EBF1. */
function downloadEbfFile(): void {
    if (!state.ebf) return;

    const fileName = byId('download-ebf-button').dataset.filename ?? 'biblia';
    const lastDotIndex = fileName.lastIndexOf('.');
    const baseName = lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);

    const blob = new Blob([JSON.stringify(state.ebf, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.ebf1.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 100);
}

function navigateChapter(offset: -1 | 1): void {
    const parsedRef = parseReference(referenceInput().value.trim());
    if (!parsedRef || !state.ebf) return;

    const chapter = parsedRef.chapter + offset;
    if (chapter >= 1 && chapter <= getNumOfChapters(state.ebf, parsedRef.book)) {
        goToReference(`${parsedRef.book} ${chapter}`);
    }
}

function copyResult(): void {
    const verseText = document.querySelector<HTMLElement>('.verse-text');
    if (!verseText) return;

    copyTextToClipboard(toPlainText(verseText)).then(
        () => {
            showTemporaryMessage('Texto copiado');
        },
        (error: unknown) => {
            console.error('Erro ao copiar texto:', error);
            showTemporaryMessage('Erro ao copiar texto');
        },
    );
}

function shareCurrentReference(): void {
    const reference = referenceInput().value.trim();
    if (!reference) return;

    const selectedBibleId = bibleSelect().value;
    if (selectedBibleId === UPLOAD_OPTION) {
        alert('Não é possível compartilhar referências de Bíblias carregadas manualmente.');
        return;
    }

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?bible=${encodeURIComponent(selectedBibleId)}&quote=${encodeURIComponent(reference)}`;

    copyTextToClipboard(shareUrl).then(
        () => {
            showTemporaryMessage('Link copiado');
        },
        (error: unknown) => {
            console.error('Erro ao copiar link:', error);
            showTemporaryMessage('Erro ao copiar link');
        },
    );
}

/** Mostra os botões flutuantes quando os botões originais saem da tela. */
function updateFloatingButtons(): void {
    const rect = byId('static-action-buttons').getBoundingClientRect();
    const isVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    byId('floating-action-buttons').classList.toggle('visible', !isVisible);
}

function setupFormatButtons(): void {
    for (const [id, option] of Object.entries(FORMAT_BUTTONS)) {
        const button = byId(id);
        button.classList.toggle('active', state.displayOptions[option]);
        button.addEventListener('click', () => {
            state.displayOptions[option] = button.classList.toggle('active');
            storage.saveDisplayOptions(state.displayOptions);
            showReference();
        });
    }
}

function setupActionButtons(): void {
    const previous = () => {
        navigateChapter(-1);
    };
    const next = () => {
        navigateChapter(1);
    };
    const actions: Record<string, () => void> = {
        'copy-button': copyResult,
        'floating-copy-button': copyResult,
        'share-button': shareCurrentReference,
        'floating-share-button': shareCurrentReference,
        'prev-chapter-button': previous,
        'floating-prev-chapter-button': previous,
        'next-chapter-button': next,
        'floating-next-chapter-button': next,
        'download-ebf-button': downloadEbfFile,
        'text-search-button': () => {
            showTextSearchModal(() => state.ebf, goToReference);
        },
        'history-button': () => {
            showHistoryModal(storage.getSearchHistory(), goToReference);
        },
        'reference-help-button': () => {
            showReferenceHelpModal(state.instructionsHtml);
        },
        'file-help-button': showFileHelpModal,
    };

    document.querySelectorAll<HTMLButtonElement>('.action-button').forEach((button) => {
        button.addEventListener('click', () => {
            actions[button.id]?.();

            // Feedback visual comum para todos os botões de ação
            button.classList.add('success');
            setTimeout(() => {
                button.classList.remove('success');
            }, 1000);
        });
    });
}

function setupExpandableSections(): void {
    document.querySelectorAll('.expandable-section').forEach((section) => {
        const header = section.querySelector('.expandable-header');
        const content = section.querySelector('.expandable-content');
        if (!header || !content) return;

        header.addEventListener('click', () => {
            content.classList.toggle('expanded');
            section.classList.toggle('expanded');
        });
    });
}

function setupReferenceInput(): void {
    const input = referenceInput();
    input.addEventListener('change', () => {
        storage.saveReference(input.value);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            showReference();
        }
    });
    input.addEventListener('input', debounce(showReference));
}

/** Referência inicial: o parâmetro ?quote= do link tem prioridade sobre a última consultada. */
function restoreReference(params: URLSearchParams): void {
    const reference = params.get('quote') ?? storage.getSavedReference();
    if (reference) {
        referenceInput().value = reference;
    }
}

async function loadAvailableBibles(params: URLSearchParams): Promise<void> {
    const biblesList = await getAvailableBibles();
    if (biblesList.length === 0) {
        console.error('Nenhuma Bíblia disponível para carregar.');
        return;
    }

    // Prioridade: parâmetro da URL, preferência salva, Bíblia padrão do índice
    const defaultBible =
        params.get('bible') ?? storage.getSavedBible() ?? biblesList.find((bible) => bible.default)?.name ?? null;

    populateBiblesSelect(biblesList, defaultBible);
}

export function startApp(): void {
    initializeTheme();

    state.instructionsHtml = byId('result').innerHTML;
    const params = new URLSearchParams(window.location.search);
    restoreReference(params);
    updateUploadVisibility();

    setupExpandableSections();
    setupFormatButtons();
    setupActionButtons();
    setupReferenceInput();

    bibleSelect().addEventListener('change', () => void onBibleSelected());
    byId('bible-file', HTMLInputElement).addEventListener('change', (event) => {
        void handleFileUpload((event.target as HTMLInputElement).files?.[0]);
    });

    window.addEventListener('scroll', updateFloatingButtons);
    window.addEventListener('resize', updateFloatingButtons);

    void loadAvailableBibles(params);
}
