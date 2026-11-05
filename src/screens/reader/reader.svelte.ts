/**
 * Reader screen state and actions: translation choice, reference field and
 * passage display. Reader.svelte draws it.
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
import {
    type EbfBook,
    type EbfDocument,
    findBook,
    findBookByUrlId,
    getBookAbbreviation,
    getBookUrlId,
    getNumOfChapters,
} from '../../core/ebf';
import { addToHistory } from '../../core/history';
import type { DisplayOptions, Passage } from '../../core/passage';
import { parseReference } from '../../core/reference';
import { renderInputReference, renderPassageText } from '../../core/render';
import { prepareSearchIndex } from '../../core/search';
import { convertXmlToEbf } from '../../core/xml';
import { type BibleIndexEntry, bibleKey, getAvailableBibles, loadBibleFromUrl, parseEbfJson } from '../../data/bibles';
import { onUiLanguageChange, t } from '../../i18n';
import type { PathParams } from '../../router/path';
import type { Router, Screen } from '../../router/router';
import { copyTextToClipboard, showTemporaryMessage } from '../../ui/feedback';
import { shareLink } from '../../ui/share';
import * as storage from '../../ui/storage';
import { instructionsHtml } from './instructions';
import { inputReferenceFromPath, parseLegacyLink, parseReaderParams, readerPath, UPLOAD_KEY } from './url';

/**
 * How to record the displayed passage in the browser history:
 * - `commit`: new entry (one-off user action);
 * - `edit`: typing; new entry only on the first change of the edit;
 * - `replace`: fixes the current entry (e.g. canonical URL after loading).
 */
export type UrlMode = 'commit' | 'edit' | 'replace';

/** What the screen draws; changed only by the actions below. */
class ReaderState {
    /** Bible loaded (large: not made deeply reactive). */
    ebf = $state.raw<EbfDocument | null>(null);
    bibles = $state.raw<BibleIndexEntry[]>([]);
    /** Identifier of the selected Bible ("por/ave-maria", or UPLOAD_KEY); empty until the first navigation. */
    bibleKey = $state('');
    /** Content of the reference field: the input reference, as the user wrote it. */
    inputReference = $state('');
    displayOptions = $state<DisplayOptions>(storage.getSavedDisplayOptions());
    /** Passage displayed, source of the copied text and of the resulting reference; null when there is none. */
    passage = $state.raw<Passage | null>(null);
    /** HTML of the result area: the passage or the error/instructions. */
    resultHtml = $state('');
    /** No passage is displayed: the buttons that act on it are hidden. */
    resultError = $state(false);
    /** The input reference leads to no passage (format, book or chapter): the field is marked for correction. */
    wrongReference = $state(false);
    /** Name of the file uploaded, once it was read; the converted Bible can then be downloaded. */
    uploadedFileName = $state<string | null>(null);
}

export const reader = new ReaderState();

/** State that the screen does not draw. */
const internal = {
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
};

let getRouter: () => Router;

/**
 * Finds the Bible by identifier (language/slug) or by name, case-insensitively
 * (links and preferences saved by previous versions use the name).
 */
function findBibleEntry(id: string | null | undefined): BibleIndexEntry | undefined {
    const wanted = id?.toLowerCase();
    return wanted ? reader.bibles.find((bible) => bibleKey(bible) === wanted || bible.name.toLowerCase() === wanted) : undefined;
}

const defaultBibleEntry = (): BibleIndexEntry | undefined =>
    reader.bibles.find((bible) => bible.default) ?? reader.bibles[0];

/** Bible of a language: the default one, if it belongs to it, or the first in the index. */
const languageBibleEntry = (language: string | undefined): BibleIndexEntry | undefined =>
    reader.bibles.find((bible) => bible.language === language && bible.default) ??
    reader.bibles.find((bible) => bible.language === language);

const isKnownLanguage = (language: string | undefined): boolean => reader.bibles.some((bible) => bible.language === language);

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
    const book = parsed && reader.ebf ? find(reader.ebf, parsed.book) : undefined;
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
    return readerPath(reader.bibleKey, valid || !reader.ebf ? replaceBook(inputReference, findBook, getBookUrlId) : null);
}

/** Path of the passage currently displayed (or asked for), e.g. to come back to it. */
export const readerCurrentPath = (): string => currentPath(reader.inputReference.trim(), !reader.resultError);

function syncUrl(path: string, mode: UrlMode): void {
    if (!reader.bibleKey) return;

    const router = getRouter();
    switch (mode) {
        case 'replace':
            router.updateUrl(path, { replace: true });
            break;
        case 'commit':
            router.updateUrl(path);
            internal.editing = false;
            break;
        case 'edit':
            if (router.updateUrl(path, { replace: internal.editing })) {
                internal.editing = true;
            }
            break;
    }
}

/**
 * Displays the passage asked for by the input reference in the field, and
 * updates what depends on it: buttons, history, page title and URL.
 */
export function showPassage(mode?: UrlMode): void {
    const inputReference = reader.inputReference.trim();
    storage.saveInputReference(inputReference);

    const result = renderInputReference(inputReference, reader.ebf, reader.displayOptions, instructionsHtml(reader.ebf));
    const valid = !result.error && !!inputReference;
    reader.passage = result.passage ?? null;
    reader.resultError = result.error;
    // Not while there is no Bible to check it against
    reader.wrongReference = !!inputReference && result.error && reader.ebf !== null;
    if (valid) {
        storage.saveSearchHistory(addToHistory(storage.getSearchHistory(), inputReference));
    }
    reader.resultHtml = result.html;

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
    if (!reader.passage) return null;
    const bibleName = reader.ebf?.bible.name;
    const { resultingReference } = reader.passage;
    return bibleName ? `${resultingReference} (${bibleName})` : resultingReference;
}

/** Puts the input reference in the field and displays its passage (new history entry). */
export function goToInputReference(inputReference: string): void {
    reader.inputReference = inputReference;
    showPassage('commit');
}

/** Typing in the reference field: displays the passage, keeping a single history entry for the edit. */
export function editInputReference(): void {
    showPassage('edit');
}

/** The edit of the input reference ended (Enter, or leaving the field after changing it). */
export function endEdit(): void {
    storage.saveInputReference(reader.inputReference);
    internal.editing = false;
}

export function toggleDisplayOption(option: keyof DisplayOptions): void {
    reader.displayOptions[option] = !reader.displayOptions[option];
    storage.saveDisplayOptions($state.snapshot(reader.displayOptions));
    showPassage();
}

function setBible(ebf: EbfDocument | null): void {
    reader.ebf = ebf;
    // Relevance search index, built in the background
    if (ebf) {
        void prepareSearchIndex(ebf);
    }
}

/**
 * Selects and loads the Bible. Resolves false if another selection replaced it
 * before it finished loading.
 */
function selectBible(key: string): Promise<boolean> {
    if (key === reader.bibleKey) {
        return internal.bibleLoad;
    }

    const token = ++internal.loadToken;
    reader.bibleKey = key;

    if (key === UPLOAD_KEY) {
        setBible(internal.uploadedEbf);
        internal.bibleLoad = Promise.resolve(true);
        return internal.bibleLoad;
    }

    storage.saveBible(key);
    const entry = findBibleEntry(key);
    internal.bibleLoad = (entry ? loadBibleFromUrl(entry.url) : Promise.resolve(null)).then((ebf) => {
        if (token !== internal.loadToken) return false;
        if (!ebf) {
            showTemporaryMessage(t('messages.bibleLoadError'));
        }
        setBible(ebf);
        return true;
    });
    return internal.bibleLoad;
}

/**
 * Switching translation is a navigation to the same passage in the new Bible:
 * the book goes into the URL as its USFM id, the same in every translation, and
 * `show` finds it there and writes it as the new Bible's abbreviation.
 */
export function chooseBible(key: string): void {
    const inputReference = reader.inputReference.trim();
    getRouter().navigate(readerPath(key, replaceBook(inputReference, findBook, getBookUrlId)));
}

export async function uploadBible(file: File | undefined): Promise<void> {
    if (!file) return;

    const isJson = file.type === 'application/json' || file.name.endsWith('.json');
    const isXml = file.type === 'application/xml' || file.name.endsWith('.xml') || file.name.endsWith('.osis');
    if (!isJson && !isXml) {
        showTemporaryMessage(t('messages.unsupportedFormat'));
        return;
    }

    try {
        const content = await file.text();
        internal.uploadedEbf = isXml ? convertXmlToEbf(content) : parseEbfJson(content);
        reader.uploadedFileName = file.name;
    } catch (error) {
        console.error('Error reading the Bible file:', error);
        reader.uploadedFileName = null;
        showTemporaryMessage(t('messages.invalidFile'));
        return;
    }

    if (reader.bibleKey === UPLOAD_KEY) {
        setBible(internal.uploadedEbf);
        showPassage('replace');
    }
}

/** Downloads the Bible loaded by upload, converted to EBF1. */
export function downloadEbfFile(): void {
    if (!internal.uploadedEbf) return;

    const fileName = reader.uploadedFileName ?? 'biblia';
    const lastDotIndex = fileName.lastIndexOf('.');
    const baseName = lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);

    const blob = new Blob([JSON.stringify(internal.uploadedEbf, null, 4)], { type: 'application/json' });
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

export function navigateChapter(offset: -1 | 1): void {
    const parsedRef = parseReference(reader.inputReference.trim());
    if (!parsedRef || !reader.ebf) return;

    const chapter = parsedRef.chapter + offset;
    if (chapter >= 1 && chapter <= getNumOfChapters(reader.ebf, parsedRef.book)) {
        goToInputReference(`${parsedRef.book} ${chapter}`);
    }
}

export function copyResult(): void {
    if (!reader.passage) return;

    copyTextToClipboard(renderPassageText(reader.passage)).then(
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
export function sharePassage(): void {
    const inputReference = reader.inputReference.trim();
    const title = passageTitle();
    if (!inputReference || !title) return;

    if (reader.bibleKey === UPLOAD_KEY) {
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

/**
 * Displays the URL state. With no Bible in the URL ("/"), restores the last
 * reading (or the index's default Bible); old links (/?bible=&quote=) work as
 * in the previous version. A Bible segment under an unknown language (not the
 * expected format) redirects to the root. The URL is then corrected to the
 * canonical one.
 */
async function show(params: PathParams, biblesReady: Promise<void>): Promise<void> {
    const token = ++internal.navToken;
    internal.editing = false;

    await biblesReady;
    if (token !== internal.navToken || reader.bibles.length === 0) return;

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

    reader.inputReference = inputReference;
    const loaded = await selectBible(key);
    if (!loaded || token !== internal.navToken) return;

    reader.inputReference = canonicalInputReference(inputReference, bookFromPath);
    showPassage('replace');
}

/**
 * Creates the reader screen, drawn in `root`; `router` gives access to the
 * router that displays it.
 */
export function createReaderScreen(router: () => Router, root: HTMLElement): Screen {
    getRouter = router;
    // The result area has texts in the interface language (errors, instructions)
    onUiLanguageChange(() => {
        showPassage();
    });

    const biblesReady = getAvailableBibles().then((biblesList) => {
        reader.bibles = biblesList;
        if (biblesList.length === 0) {
            console.error('No Bible available to load.');
        }
    });

    return {
        root,
        show: (params) => show(params, biblesReady),
    };
}
