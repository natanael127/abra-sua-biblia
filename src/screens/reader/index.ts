/**
 * Reader screen: translation choice, reference field and passage display.
 *
 * The reference field holds the input reference, as the user wrote it; the
 * passage displayed carries the resulting reference of what was found (see
 * src/core/reference.ts). Each one has its uses:
 * - input reference (canonical: book swapped for the Bible's abbreviation):
 *   reference field, last reading and search history; in the URL the book is
 *   the USFM id instead;
 * - resulting reference: after the passage, page title and sharing.
 *
 * The URL carries the input reference of the displayed passage
 * (/{language}/{bible}/{book}/{chapterVerses}).
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
    findBookByUrlId,
    getBookAbbreviation,
    getBookUrlId,
    getBookName,
    getNumOfChapters,
} from '../../core/ebf';
import { addToHistory } from '../../core/history';
import { getUiLanguage, onUiLanguageChange, t } from '../../i18n';
import { parseReference } from '../../core/reference';
import type { DisplayOptions, Passage } from '../../core/passage';
import { renderPassageText, renderInputReference } from '../../core/render';
import { prepareSearchIndex } from '../../core/search';
import { convertXmlToEbf } from '../../core/xml';
import {
    type BibleIndexEntry,
    bibleKey,
    getAvailableBibles,
    loadBibleFromUrl,
    parseEbfJson,
    selectableBibles,
} from '../../data/bibles';
import type { PathParams } from '../../router/path';
import type { Router, Screen } from '../../router/router';
import { showFileHelpModal, showHistoryModal, showReferenceHelpModal, showTextSearchModal } from '../../ui/dialogs';
import { byId } from '../../ui/dom';
import { shareLink } from '../../ui/share';
import { copyTextToClipboard, showTemporaryMessage } from '../../ui/feedback';
import * as storage from '../../ui/storage';
import { refreshThemeTitle } from '../../ui/theme';
import { instructionsHtml } from './instructions';
import { parseLegacyLink, parseReaderParams, readerPath, inputReferenceFromPath, UPLOAD_KEY } from './url';

/** Pause in typing the input reference before the passage is displayed. */
const TYPING_DEBOUNCE_MS = 500;

const BIBLE_TYPE_ORDER = ['catholic', 'protestant', 'other'] as const;

/** Formatting buttons: button id -> display option. */
const FORMAT_BUTTONS: Record<string, keyof DisplayOptions> = {
    'display-quotes': 'quotes',
    'display-verse-numbers': 'verseNumbers',
    'display-line-breaks': 'lineBreaks',
    'display-ellipsis': 'ellipsis',
    'display-parentheses-reference': 'parenthesesReference',
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
    /** An edit of the input reference is in progress (see UrlMode `edit`). */
    editing: false,
    /**
     * Passage displayed, source of the copied text and of the resulting
     * reference; null when there is none.
     */
    passage: null as Passage | null,
};

let getRouter: () => Router;

/** Field where the user types the input reference. */
const referenceField = () => byId('reference', HTMLInputElement);
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

/**
 * Replaces the book of the input reference, found by `find`, with `format(book)`;
 * the rest stays as typed. Unchanged if the book is not found.
 */
function replaceBook(
    inputReference: string,
    find: (ebf: EbfDocument, book: string) => EbfBook | undefined,
    format: (book: EbfBook) => string,
): string {
    const parsed = parseReference(inputReference);
    const book = parsed && state.ebf ? find(state.ebf, parsed.book) : undefined;
    if (!book) return inputReference;
    return `${format(book)}${inputReference.slice(parsed?.book.length)}`;
}

/**
 * Canonical form of the input reference: only the book is replaced with the
 * loaded Bible's abbreviation, the rest stays as typed ("mateus 5, 4.3" ->
 * "Mt 5, 4.3"). It is not the resulting reference ("Mt 5,3-4"). `fromUrl`: the
 * book comes from a URL, so it is looked up by USFM id first.
 */
function canonicalInputReference(inputReference: string, fromUrl = false): string {
    return replaceBook(inputReference, fromUrl ? findBookByUrlId : findBook, getBookAbbreviation);
}

/**
 * Path of the current state: the input reference with the book as its USFM id
 * ("Jo 3,16" -> /por/ave-maria/jhn/3,16). An invalid input reference is left
 * out of the URL; with no Bible loaded (load failure, upload not done yet) it
 * cannot be validated, so it is kept, so as not to lose the requested passage.
 */
function currentPath(inputReference: string, valid: boolean): string {
    return readerPath(state.bibleKey, valid || !state.ebf ? replaceBook(inputReference, findBook, getBookUrlId) : null);
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

/**
 * Displays the passage asked for by the input reference in the field, and
 * updates what depends on it: buttons, history, page title and URL.
 */
function showPassage(mode?: UrlMode): void {
    const inputReference = referenceField().value.trim();
    storage.saveInputReference(inputReference);

    const result = renderInputReference(inputReference, state.ebf, state.displayOptions, instructionsHtml());
    const valid = !result.error && !!inputReference;
    state.passage = result.passage ?? null;

    for (const id of RESULT_BUTTONS) {
        byId(id).classList.toggle('hidden', result.error);
    }
    if (valid) {
        storage.saveSearchHistory(addToHistory(storage.getSearchHistory(), inputReference));
    }

    byId('result').innerHTML = result.html;
    updateFloatingButtons();

    const title = passageTitle();
    const appTitle = t('app.title');
    document.title = title ? `${title} - ${appTitle}` : appTitle;
    if (mode) {
        syncUrl(currentPath(inputReference, valid), mode);
    }
}

/**
 * Title of the displayed passage, for the page and for sharing: the resulting
 * reference, not the input reference (they can differ), and the Bible name
 * ("Jo 3,16 (Ave-Maria)"). Null when no passage is displayed.
 */
function passageTitle(): string | null {
    if (!state.passage) return null;
    const bibleName = state.ebf?.bible.name;
    const { resultingReference } = state.passage;
    return bibleName ? `${resultingReference} (${bibleName})` : resultingReference;
}

/** Puts the input reference in the field and displays its passage (new history entry). */
function goToInputReference(inputReference: string): void {
    referenceField().value = inputReference;
    showPassage('commit');
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
            referenceField().focus();
            goToInputReference(`${getBookAbbreviation(book)} 1`);
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
        populateBiblesSelect(state.bibleKey);
        if (state.bibleKey) {
            bibleSelect().value = state.bibleKey;
        }
    }
    showPassage();
}

/**
 * Fills the translation list with the Bibles of the interface language and,
 * if it is of another one, the selected Bible (see `selectableBibles`).
 */
function populateBiblesSelect(selectedKey: string): void {
    const select = bibleSelect();
    select.replaceChildren();
    const biblesList = selectableBibles(state.bibles, getUiLanguage().code, selectedKey);

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
    // The Bible has to be in the list to be selected, and it may be of another language than the interface's
    populateBiblesSelect(key);
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
    state.bibleLoad = (entry ? loadBibleFromUrl(entry.url) : Promise.resolve(null)).then((ebf) => {
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
        showPassage('commit');
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
        showPassage('replace');
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
    const parsedRef = parseReference(referenceField().value.trim());
    if (!parsedRef || !state.ebf) return;

    const chapter = parsedRef.chapter + offset;
    if (chapter >= 1 && chapter <= getNumOfChapters(state.ebf, parsedRef.book)) {
        goToInputReference(`${parsedRef.book} ${chapter}`);
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

/**
 * Shares the displayed passage: the title has the resulting reference; the link
 * has the canonical input reference, like the URL of the page.
 */
function sharePassage(): void {
    const inputReference = referenceField().value.trim();
    const title = passageTitle();
    if (!inputReference || !title) return;

    if (state.bibleKey === UPLOAD_KEY) {
        alert(t('messages.cannotShareUpload'));
        return;
    }

    shareLink({
        title,
        url: window.location.origin + currentPath(inputReference, true),
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
            showPassage();
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
        'share-button': sharePassage,
        'floating-share-button': sharePassage,
        'prev-chapter-button': previous,
        'floating-prev-chapter-button': previous,
        'next-chapter-button': next,
        'floating-next-chapter-button': next,
        'download-ebf-button': downloadEbfFile,
        'text-search-button': () => {
            showTextSearchModal(() => state.ebf, goToInputReference);
        },
        'history-button': () => {
            showHistoryModal(storage.getSearchHistory(), goToInputReference);
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

function setupReferenceField(): void {
    const field = referenceField();
    // Fired when leaving the field after changing it: ends the edit
    field.addEventListener('change', () => {
        storage.saveInputReference(field.value);
        state.editing = false;
    });
    const showWhileTyping = debounce(() => {
        showPassage('edit');
    }, TYPING_DEBOUNCE_MS);
    field.addEventListener('input', showWhileTyping);
    field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Display right away, without waiting for the typing pause
            showWhileTyping.cancel();
            showPassage('edit');
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
    let inputReference: string;
    /** The book comes from the URL path (USFM id), not from a legacy link or the last reading. */
    let bookFromPath = false;
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
        inputReference = inputReferenceFromPath(target.book, target.chapterVerses);
        bookFromPath = true;
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
        inputReference = legacy?.inputReference ?? storage.getSavedInputReference() ?? '';
    }
    if (!key) return;

    referenceField().value = inputReference;
    const loaded = await selectBible(key);
    if (!loaded || token !== state.navToken) return;

    referenceField().value = canonicalInputReference(inputReference, bookFromPath);
    showPassage('replace');
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
    setupReferenceField();

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
        populateBiblesSelect(state.bibleKey);
    });

    return {
        root: byId('reader'),
        show: (params) => show(params, biblesReady),
    };
}
