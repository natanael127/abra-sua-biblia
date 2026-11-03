/**
 * Reader screen: translation choice, reference and passage display.
 *
 * The URL reflects the displayed passage (/{language}/{bible}/{book}/{passage}).
 * External navigations (page load, Back/Forward) arrive through `show`; the
 * user's actions on the screen update the URL:
 * - one-off actions (book, chapter, history, search, translation) create an
 *   entry in the browser history;
 * - typing creates an entry on the first change and updates that same entry
 *   on the following ones, until the edit ends (Enter, leaving the field or
 *   another navigation).
 */
import { debounce } from 'es-toolkit';
import {
    type EbfBook,
    type EbfDocument,
    findBook,
    getBookAbbreviation,
    getBookName,
    getNumOfChapters,
} from '../../core/ebf';
import { addToHistory } from '../../core/history';
import { onUiLanguageChange, t } from '../../i18n';
import { parseReference } from '../../core/reference';
import type { DisplayOptions, Passage } from '../../core/passage';
import { renderPassageText, renderReference } from '../../core/render';
import { prepareSearchIndex } from '../../core/search';
import { convertXmlToEbf } from '../../core/xml';
import { type BibleIndexEntry, bibleKey, getAvailableBibles, loadBibleFromPath, parseEbfJson } from '../../data/bibles';
import type { PathParams } from '../../router/path';
import type { Router, Screen } from '../../router/router';
import { showFileHelpModal, showHistoryModal, showReferenceHelpModal, showTextSearchModal } from '../../ui/dialogs';
import { byId } from '../../ui/dom';
import { shareLink } from '../../ui/share';
import { copyTextToClipboard, showTemporaryMessage } from '../../ui/feedback';
import * as storage from '../../ui/storage';
import { refreshThemeTitle } from '../../ui/theme';
import { instructionsHtml } from './instructions';
import { parseLegacyLink, parseReaderParams, readerPath, referenceFromPath, UPLOAD_KEY } from './url';

/** Pause in typing the reference before the passage is displayed. */
const TYPING_DEBOUNCE_MS = 500;

const BIBLE_TYPE_ORDER = ['catholic', 'protestant', 'other'] as const;

/** Formatting buttons: button id -> display option. */
const FORMAT_BUTTONS: Record<string, keyof DisplayOptions> = {
    'display-quotes': 'quotes',
    'display-verse-numbers': 'verseNumbers',
    'display-line-breaks': 'lineBreaks',
    'display-ellipsis': 'ellipsis',
    'display-parentheses-citation': 'parenthesesCitation',
    'display-section-titles': 'sectionTitles',
};

/** Buttons that only make sense when a passage is displayed. */
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
 * How to record the displayed passage in the browser history:
 * - `commit`: new entry (one-off user action);
 * - `edit`: typing; new entry only on the first change of the edit;
 * - `replace`: fixes the current entry (e.g. canonical URL after loading).
 */
type UrlMode = 'commit' | 'edit' | 'replace';

const state = {
    ebf: null as EbfDocument | null,
    displayOptions: storage.getSavedDisplayOptions(),
    bibles: [] as BibleIndexEntry[],
    /** Identifier of the selected Bible ("por/ave-maria", or UPLOAD_KEY); empty until the first navigation. */
    bibleKey: '',
    /** Load in progress (or finished) of the selected Bible. */
    bibleLoad: Promise.resolve(true),
    /** Bible uploaded by the user, kept for Back/Forward between translations. */
    uploadedEbf: null as EbfDocument | null,
    /** Identifies the most recent Bible load, to discard late responses. */
    loadToken: 0,
    /** Identifies the most recent navigation, to discard interrupted ones. */
    navToken: 0,
    /** A reference edit is in progress (see UrlMode `edit`). */
    editing: false,
    /** Passage displayed, source of the copied text; null when there is none. */
    passage: null as Passage | null,
};

let getRouter: () => Router;

const referenceInput = () => byId('reference', HTMLInputElement);
const bibleSelect = () => byId('bible-select', HTMLSelectElement);

/**
 * Finds the Bible by identifier (language/slug) or by name, case-insensitively
 * (links and preferences saved by previous versions use the name).
 */
function findBibleEntry(id: string | null | undefined): BibleIndexEntry | undefined {
    const wanted = id?.toLowerCase();
    return wanted ? state.bibles.find((bible) => bibleKey(bible) === wanted || bible.name.toLowerCase() === wanted) : undefined;
}

const defaultBibleEntry = (): BibleIndexEntry | undefined =>
    state.bibles.find((bible) => bible.default) ?? state.bibles[0];

/** Bible of a language: the default one, if it belongs to it, or the first in the index. */
const languageBibleEntry = (language: string | undefined): BibleIndexEntry | undefined =>
    state.bibles.find((bible) => bible.language === language && bible.default) ??
    state.bibles.find((bible) => bible.language === language);

const isKnownLanguage = (language: string | undefined): boolean => state.bibles.some((bible) => bible.language === language);

/** Replaces the reference's book with the loaded Bible's abbreviation ("mateus 5" -> "Mt 5"). */
function canonicalReference(reference: string): string {
    const parsed = parseReference(reference);
    const book = parsed && state.ebf ? findBook(state.ebf, parsed.book) : undefined;
    if (!book) return reference;
    return `${getBookAbbreviation(book)}${reference.slice(parsed?.book.length)}`;
}

/**
 * Path of the current state. An invalid reference is left out of the URL;
 * with no Bible loaded (load failure, upload not done yet) it cannot be
 * validated, so the reference is kept, so as not to lose the requested passage.
 */
function currentPath(reference: string, valid: boolean): string {
    return readerPath(state.bibleKey, valid || !state.ebf ? canonicalReference(reference) : null);
}

function syncUrl(path: string, mode: UrlMode): void {
    if (!state.bibleKey) return;

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

    const result = renderReference(reference, state.ebf, state.displayOptions, instructionsHtml());
    const valid = !result.error && !!reference;
    state.passage = result.passage ?? null;

    for (const id of RESULT_BUTTONS) {
        byId(id).classList.toggle('hidden', result.error);
    }
    if (valid) {
        storage.saveSearchHistory(addToHistory(storage.getSearchHistory(), reference));
    }

    byId('result').innerHTML = result.html;
    updateFloatingButtons();

    // The resulting citation, not the typed reference (they can differ)
    const bibleName = state.ebf?.bible.name;
    const appTitle = t('app.title');
    document.title = valid && result.passage && bibleName ? `${result.passage.citation} (${bibleName}) - ${appTitle}` : appTitle;
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
    // Relevance search index, built in the background
    if (ebf) {
        void prepareSearchIndex(ebf);
    }
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

    updateBooksTitle();
}

/** "Books (73)" once a Bible is loaded; just "Books" before that. */
function updateBooksTitle(): void {
    const count = state.ebf?.bible.books.length ?? 0;
    byId('book-section-title').textContent = count > 0 ? t('reader.booksCount', { count }) : t('reader.books');
}

/** Texts that are built by the code and not translated by the page's attributes. */
function refreshTranslatedTexts(): void {
    refreshThemeTitle();
    updateBooksTitle();
    if (state.bibles.length > 0) {
        populateBiblesSelect(state.bibles);
        if (state.bibleKey) {
            bibleSelect().value = state.bibleKey;
        }
    }
    showReference();
}

function populateBiblesSelect(biblesList: readonly BibleIndexEntry[]): void {
    const select = bibleSelect();
    select.replaceChildren();

    for (const type of BIBLE_TYPE_ORDER) {
        const bibles = biblesList.filter((bible) => (bible.type || 'other') === type);
        if (bibles.length === 0) continue;

        const optgroup = document.createElement('optgroup');
        optgroup.label = t(`reader.bibleTypes.${type}`);
        for (const bible of bibles) {
            const option = document.createElement('option');
            option.value = bibleKey(bible);
            option.textContent = bible.name;
            optgroup.appendChild(option);
        }
        select.appendChild(optgroup);
    }

    const uploadOption = document.createElement('option');
    uploadOption.value = UPLOAD_KEY;
    uploadOption.textContent = t('reader.upload');
    select.appendChild(uploadOption);
}

function updateUploadVisibility(): void {
    const container = document.querySelector<HTMLElement>('.file-input-container');
    if (container) {
        container.style.display = bibleSelect().value === UPLOAD_KEY ? 'block' : 'none';
    }
}

/**
 * Selects and loads the Bible. Resolves false if another selection replaced it
 * before it finished loading.
 */
function selectBible(key: string): Promise<boolean> {
    bibleSelect().value = key;
    updateUploadVisibility();
    if (key === state.bibleKey) {
        return state.bibleLoad;
    }

    const token = ++state.loadToken;
    state.bibleKey = key;

    if (key === UPLOAD_KEY) {
        setBible(state.uploadedEbf);
        state.bibleLoad = Promise.resolve(true);
        return state.bibleLoad;
    }

    storage.saveBible(key);
    const entry = findBibleEntry(key);
    state.bibleLoad = (entry ? loadBibleFromPath(entry.path) : Promise.resolve(null)).then((ebf) => {
        if (token !== state.loadToken) return false;
        if (!ebf) {
            showTemporaryMessage(t('messages.bibleLoadError'));
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
        showTemporaryMessage(t('messages.unsupportedFormat'));
        return;
    }

    const downloadButton = byId('download-ebf-button', HTMLButtonElement);
    try {
        const content = await file.text();
        state.uploadedEbf = isXml ? convertXmlToEbf(content) : parseEbfJson(content);
        downloadButton.disabled = false;
        downloadButton.dataset.filename = file.name;
    } catch (error) {
        console.error('Error reading the Bible file:', error);
        downloadButton.disabled = true;
        delete downloadButton.dataset.filename;
        showTemporaryMessage(t('messages.invalidFile'));
        return;
    }

    if (state.bibleKey === UPLOAD_KEY) {
        setBible(state.uploadedEbf);
        showReference('replace');
    }
}

/** Downloads the Bible loaded by upload, converted to EBF1. */
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
    if (!state.passage) return;

    copyTextToClipboard(renderPassageText(state.passage)).then(
        () => {
            showTemporaryMessage(t('messages.textCopied'));
        },
        (error: unknown) => {
            console.error('Error copying text:', error);
            showTemporaryMessage(t('messages.copyError'));
        },
    );
}

function shareCurrentReference(): void {
    const reference = referenceInput().value.trim();
    if (!reference) return;

    if (state.bibleKey === UPLOAD_KEY) {
        alert(t('messages.cannotShareUpload'));
        return;
    }

    const bibleName = state.ebf?.bible.name;
    shareLink({
        title: bibleName ? `${reference} (${bibleName})` : reference,
        url: window.location.origin + currentPath(reference, true),
    }).then(
        (result) => {
            if (result === 'copied') {
                showTemporaryMessage(t('messages.linkCopied'));
            }
        },
        (error: unknown) => {
            console.error('Error sharing:', error);
            showTemporaryMessage(t('messages.linkCopyError'));
        },
    );
}

/** Shows the floating buttons when the original buttons leave the screen. */
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
            showReferenceHelpModal(instructionsHtml());
        },
        'file-help-button': showFileHelpModal,
    };

    document.querySelectorAll<HTMLButtonElement>('.action-button').forEach((button) => {
        button.addEventListener('click', () => {
            actions[button.id]?.();

            // Visual feedback shared by all action buttons
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
    // Fired when leaving the field after changing it: ends the edit
    input.addEventListener('change', () => {
        storage.saveReference(input.value);
        state.editing = false;
    });
    const showWhileTyping = debounce(() => {
        showReference('edit');
    }, TYPING_DEBOUNCE_MS);
    input.addEventListener('input', showWhileTyping);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Display right away, without waiting for the typing pause
            showWhileTyping.cancel();
            showReference('edit');
            state.editing = false;
        }
    });
}

/**
 * Displays the URL state. With no Bible in the URL ("/"), restores the last
 * reading (or the index's default Bible); old links (/?bible=&quote=) work as
 * in the previous version. A Bible segment under an unknown language (not the
 * expected format) redirects to the root. The URL is then corrected to the
 * canonical one.
 */
async function show(params: PathParams, biblesReady: Promise<void>): Promise<void> {
    const token = ++state.navToken;
    state.editing = false;

    await biblesReady;
    if (token !== state.navToken || state.bibles.length === 0) return;

    const target = parseReaderParams(params);
    let key: string | undefined;
    let reference: string;
    if (target.bibleKey && target.bibleKey !== UPLOAD_KEY && !isKnownLanguage(target.bibleKey.split('/')[0])) {
        // Not the /{language}/{bible}/... format (e.g. a link without the language: /ave-maria/mt/5)
        getRouter().navigate('/', { replace: true });
        return;
    }
    if (target.bibleKey || target.language) {
        key = target.bibleKey;
        if (!key) {
            const languageEntry = languageBibleEntry(target.language);
            key = languageEntry && bibleKey(languageEntry);
        }
        reference = referenceFromPath(target.book, target.passage);
        if (key !== UPLOAD_KEY && !findBibleEntry(key)) {
            showTemporaryMessage(t('messages.translationNotFound'));
            const fallback = defaultBibleEntry();
            key = fallback && bibleKey(fallback);
        }
    } else {
        const legacy = parseLegacyLink(window.location.search);
        const legacyBible = legacy?.bible ? findBibleEntry(legacy.bible) : undefined;
        if (legacy?.bible && !legacyBible) {
            showTemporaryMessage(t('messages.translationNotFound'));
        }
        const entry = legacyBible ?? findBibleEntry(storage.getSavedBible()) ?? defaultBibleEntry();
        key = entry && bibleKey(entry);
        reference = legacy?.reference ?? storage.getSavedReference() ?? '';
    }
    if (!key) return;

    referenceInput().value = reference;
    const loaded = await selectBible(key);
    if (!loaded || token !== state.navToken) return;

    referenceInput().value = canonicalReference(reference);
    showReference('replace');
}

/** Creates the reader screen; `router` gives access to the router that displays it. */
export function createReaderScreen(router: () => Router): Screen {
    getRouter = router;
    updateUploadVisibility();
    updateBooksTitle();
    onUiLanguageChange(refreshTranslatedTexts);

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
            console.error('No Bible available to load.');
        }
        populateBiblesSelect(biblesList);
    });

    return {
        root: byId('reader'),
        show: (params) => show(params, biblesReady),
    };
}
