/**
 * Tela de leitura: escolha da tradução, referência e exibição do trecho.
 *
 * A URL reflete o trecho exibido (/{bíblia}/{livro}/{trecho}). Navegações
 * externas (carga da página, Voltar/Avançar) chegam por `show`; as ações do
 * usuário na tela atualizam a URL:
 * - ações pontuais (livro, capítulo, histórico, busca, tradução) criam uma
 *   entrada no histórico do navegador;
 * - a digitação cria uma entrada na primeira alteração e atualiza essa mesma
 *   entrada nas seguintes, até a edição terminar (Enter, sair do campo ou
 *   outra navegação).
 */
import {
    type EbfBook,
    type EbfDocument,
    findBook,
    getBookAbbreviation,
    getBookName,
    getNumOfChapters,
} from '../../core/ebf';
import { addToHistory } from '../../core/history';
import { parseReference } from '../../core/reference';
import { type DisplayOptions, renderReference } from '../../core/render';
import { convertXmlToEbf } from '../../core/xml';
import { type BibleIndexEntry, getAvailableBibles, loadBibleFromPath, parseEbfJson } from '../../data/bibles';
import type { PathParams } from '../../router/path';
import type { Router, Screen } from '../../router/router';
import { showFileHelpModal, showHistoryModal, showReferenceHelpModal, showTextSearchModal } from '../../ui/dialogs';
import { byId, debounce } from '../../ui/dom';
import { copyTextToClipboard, showTemporaryMessage, toPlainText } from '../../ui/feedback';
import * as storage from '../../ui/storage';
import { parseLegacyLink, readerPath, referenceFromPath, UPLOAD_SLUG } from './url';

const APP_TITLE = 'Abra sua Bíblia!';

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

/**
 * Como registrar o trecho exibido no histórico do navegador:
 * - `commit`: nova entrada (ação pontual do usuário);
 * - `edit`: digitação; nova entrada só na primeira alteração da edição;
 * - `replace`: corrige a entrada atual (ex.: URL canônica após a carga).
 */
type UrlMode = 'commit' | 'edit' | 'replace';

const state = {
    ebf: null as EbfDocument | null,
    instructionsHtml: '',
    displayOptions: storage.getSavedDisplayOptions(),
    bibles: [] as BibleIndexEntry[],
    /** Slug da Bíblia selecionada (ou UPLOAD_SLUG); vazio até a primeira navegação. */
    bibleSlug: '',
    /** Carga em andamento (ou concluída) da Bíblia selecionada. */
    bibleLoad: Promise.resolve(true),
    /** Bíblia enviada pelo usuário, mantida para Voltar/Avançar entre traduções. */
    uploadedEbf: null as EbfDocument | null,
    /** Identifica a carga de Bíblia mais recente, para descartar respostas atrasadas. */
    loadToken: 0,
    /** Identifica a navegação mais recente, para descartar as interrompidas. */
    navToken: 0,
    /** Há uma edição da referência em curso (ver UrlMode `edit`). */
    editing: false,
};

let getRouter: () => Router;

const referenceInput = () => byId('reference', HTMLInputElement);
const bibleSelect = () => byId('bible-select', HTMLSelectElement);

/**
 * Encontra a Bíblia pelo slug ou pelo nome, sem diferenciar maiúsculas
 * (links e preferências salvas por versões anteriores usam o nome).
 */
function findBibleEntry(id: string | null | undefined): BibleIndexEntry | undefined {
    const wanted = id?.toLowerCase();
    return wanted ? state.bibles.find((bible) => bible.slug === wanted || bible.name.toLowerCase() === wanted) : undefined;
}

const defaultBibleEntry = (): BibleIndexEntry | undefined =>
    state.bibles.find((bible) => bible.default) ?? state.bibles[0];

/** Troca o livro da referência pela abreviação da Bíblia carregada ("mateus 5" -> "Mt 5"). */
function canonicalReference(reference: string): string {
    const parsed = parseReference(reference);
    const book = parsed && state.ebf ? findBook(state.ebf, parsed.book) : undefined;
    if (!book) return reference;
    return `${getBookAbbreviation(book)}${reference.slice(parsed?.book.length)}`;
}

function currentPath(reference: string, valid: boolean): string {
    return readerPath(state.bibleSlug, valid ? canonicalReference(reference) : null);
}

function syncUrl(path: string, mode: UrlMode): void {
    if (!state.bibleSlug) return;

    const router = getRouter();
    switch (mode) {
        case 'replace':
            router.updateUrl(path, { replace: true });
            break;
        case 'commit':
            router.updateUrl(path);
            state.editing = false;
            break;
        case 'edit':
            if (router.updateUrl(path, { replace: state.editing })) {
                state.editing = true;
            }
            break;
    }
}

function showReference(mode?: UrlMode): void {
    const reference = referenceInput().value.trim();
    storage.saveReference(reference);

    const result = renderReference(reference, state.ebf, state.displayOptions, state.instructionsHtml);
    const valid = !result.error && !!reference;

    for (const id of RESULT_BUTTONS) {
        byId(id).classList.toggle('hidden', result.error);
    }
    if (valid) {
        storage.saveSearchHistory(addToHistory(storage.getSearchHistory(), reference));
    }

    byId('result').innerHTML = result.html;
    updateFloatingButtons();

    const bibleName = state.ebf?.bible.name;
    document.title = valid && bibleName ? `${reference} (${bibleName}) - ${APP_TITLE}` : APP_TITLE;
    if (mode) {
        syncUrl(currentPath(reference, valid), mode);
    }
}

function goToReference(reference: string): void {
    referenceInput().value = reference;
    showReference('commit');
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
            referenceInput().focus();
            goToReference(`${getBookAbbreviation(book)} 1`);
        });
        bookList.appendChild(bookElement);
    }

    const header = document.querySelector('.book-section .expandable-header');
    if (header) {
        header.innerHTML = `Livros (${books.length})<span class="expand-icon">▼</span>`;
    }
}

function populateBiblesSelect(biblesList: readonly BibleIndexEntry[]): void {
    const select = bibleSelect();
    select.replaceChildren();

    for (const type of BIBLE_TYPE_ORDER) {
        const bibles = biblesList.filter((bible) => (bible.type || 'other') === type);
        if (bibles.length === 0) continue;

        const optgroup = document.createElement('optgroup');
        optgroup.label = BIBLE_TYPE_LABELS[type] ?? type;
        for (const bible of bibles) {
            const option = document.createElement('option');
            option.value = bible.slug;
            option.textContent = bible.name;
            optgroup.appendChild(option);
        }
        select.appendChild(optgroup);
    }

    const uploadOption = document.createElement('option');
    uploadOption.value = UPLOAD_SLUG;
    uploadOption.textContent = 'Fazer upload...';
    select.appendChild(uploadOption);
}

function updateUploadVisibility(): void {
    const container = document.querySelector<HTMLElement>('.file-input-container');
    if (container) {
        container.style.display = bibleSelect().value === UPLOAD_SLUG ? 'block' : 'none';
    }
}

/**
 * Seleciona e carrega a Bíblia. Resolve false se outra seleção a substituiu
 * antes de terminar de carregar.
 */
function selectBible(slug: string): Promise<boolean> {
    bibleSelect().value = slug;
    updateUploadVisibility();
    if (slug === state.bibleSlug) {
        return state.bibleLoad;
    }

    const token = ++state.loadToken;
    state.bibleSlug = slug;

    if (slug === UPLOAD_SLUG) {
        setBible(state.uploadedEbf);
        state.bibleLoad = Promise.resolve(true);
        return state.bibleLoad;
    }

    storage.saveBible(slug);
    const entry = findBibleEntry(slug);
    state.bibleLoad = (entry ? loadBibleFromPath(entry.path) : Promise.resolve(null)).then((ebf) => {
        if (token !== state.loadToken) return false;
        if (!ebf) {
            showTemporaryMessage('Erro ao carregar a Bíblia');
        }
        setBible(ebf);
        return true;
    });
    return state.bibleLoad;
}

async function onBibleSelected(): Promise<void> {
    state.navToken++;
    if (await selectBible(bibleSelect().value)) {
        showReference('commit');
    }
}

async function handleFileUpload(file: File | undefined): Promise<void> {
    if (!file) return;

    const isJson = file.type === 'application/json' || file.name.endsWith('.json');
    const isXml = file.type === 'application/xml' || file.name.endsWith('.xml') || file.name.endsWith('.osis');
    if (!isJson && !isXml) {
        showTemporaryMessage('Formato de arquivo não suportado');
        return;
    }

    const downloadButton = byId('download-ebf-button', HTMLButtonElement);
    try {
        const content = await file.text();
        state.uploadedEbf = isXml ? convertXmlToEbf(content) : parseEbfJson(content);
        downloadButton.disabled = false;
        downloadButton.dataset.filename = file.name;
    } catch (error) {
        console.error('Erro ao ler o arquivo da Bíblia:', error);
        downloadButton.disabled = true;
        delete downloadButton.dataset.filename;
        showTemporaryMessage('Arquivo de Bíblia inválido');
        return;
    }

    if (state.bibleSlug === UPLOAD_SLUG) {
        setBible(state.uploadedEbf);
        showReference('replace');
    }
}

/** Baixa a Bíblia carregada por upload, convertida para EBF1. */
function downloadEbfFile(): void {
    if (!state.uploadedEbf) return;

    const fileName = byId('download-ebf-button').dataset.filename ?? 'biblia';
    const lastDotIndex = fileName.lastIndexOf('.');
    const baseName = lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);

    const blob = new Blob([JSON.stringify(state.uploadedEbf, null, 4)], { type: 'application/json' });
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

    if (state.bibleSlug === UPLOAD_SLUG) {
        alert('Não é possível compartilhar referências de Bíblias carregadas manualmente.');
        return;
    }

    const shareUrl = window.location.origin + currentPath(reference, true);

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
    // Disparado ao sair do campo depois de alterá-lo: encerra a edição
    input.addEventListener('change', () => {
        storage.saveReference(input.value);
        state.editing = false;
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            showReference('edit');
            state.editing = false;
        }
    });
    input.addEventListener(
        'input',
        debounce(() => {
            showReference('edit');
        }),
    );
}

/**
 * Exibe o estado da URL. Sem Bíblia na URL ("/"), restaura a última leitura
 * (ou a Bíblia padrão do índice); links antigos (/?bible=&quote=) valem como
 * na versão anterior. A URL é então corrigida para a canônica.
 */
async function show(params: PathParams, biblesReady: Promise<void>): Promise<void> {
    const token = ++state.navToken;
    state.editing = false;

    await biblesReady;
    if (token !== state.navToken || state.bibles.length === 0) return;

    let slug: string | undefined;
    let reference: string;
    if (params.bible) {
        slug = params.bible.toLowerCase();
        reference = referenceFromPath(params.book, params.passage);
        if (slug !== UPLOAD_SLUG && !findBibleEntry(slug)) {
            showTemporaryMessage('Tradução não encontrada');
            slug = defaultBibleEntry()?.slug;
        }
    } else {
        const legacy = parseLegacyLink(window.location.search);
        const legacyBible = legacy?.bible ? findBibleEntry(legacy.bible) : undefined;
        if (legacy?.bible && !legacyBible) {
            showTemporaryMessage('Tradução não encontrada');
        }
        slug = (legacyBible ?? findBibleEntry(storage.getSavedBible()) ?? defaultBibleEntry())?.slug;
        reference = legacy?.reference ?? storage.getSavedReference() ?? '';
    }
    if (!slug) return;

    referenceInput().value = reference;
    const loaded = await selectBible(slug);
    if (!loaded || token !== state.navToken) return;

    referenceInput().value = canonicalReference(reference);
    showReference('replace');
}

/** Cria a tela de leitura; `router` dá acesso ao roteador que a exibe. */
export function createReaderScreen(router: () => Router): Screen {
    getRouter = router;
    state.instructionsHtml = byId('result').innerHTML;
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

    const biblesReady = getAvailableBibles().then((biblesList) => {
        state.bibles = biblesList;
        if (biblesList.length === 0) {
            console.error('Nenhuma Bíblia disponível para carregar.');
        }
        populateBiblesSelect(biblesList);
    });

    return {
        root: byId('reader'),
        show: (params) => show(params, biblesReady),
    };
}
