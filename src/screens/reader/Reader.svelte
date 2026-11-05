<!-- Reader screen (/{language}/{bible}/{book}/{chapterVerses}); its state and actions are in reader.svelte.ts. -->
<script lang="ts">
    import { debounce } from 'es-toolkit';
    import { tick } from 'svelte';
    import { resolveCrossReferences } from '../../core/cross-references';
    import { getBookAbbreviation, getBookName } from '../../core/ebf';
    import type { DisplayOptions } from '../../core/passage';
    import { bibleKey, selectableBibles } from '../../data/bibles';
    import { t, uiLanguage } from '../../i18n/reactive.svelte';
    import { clickFeedback } from '../../ui/click-feedback';
    import Expandable from '../../ui/components/Expandable.svelte';
    import LanguageSelect from '../../ui/components/LanguageSelect.svelte';
    import ThemeButton from '../../ui/components/ThemeButton.svelte';
    import CrossReferencesModal from '../../ui/dialogs/CrossReferencesModal.svelte';
    import FileHelpModal from '../../ui/dialogs/FileHelpModal.svelte';
    import HistoryModal from '../../ui/dialogs/HistoryModal.svelte';
    import ReferenceHelpModal from '../../ui/dialogs/ReferenceHelpModal.svelte';
    import TextSearchModal from '../../ui/dialogs/TextSearchModal.svelte';
    import * as storage from '../../ui/storage';
    import {
        chooseBible,
        copyResult,
        downloadEbfFile,
        editInputReference,
        endEdit,
        goToInputReference,
        navigateChapter,
        reader,
        sharePassage,
        toggleDisplayOption,
        uploadBible,
    } from './reader.svelte';
    import { UPLOAD_KEY } from './url';

    /** The screen's root element, which the router shows and hides. */
    let { root = $bindable() }: { root?: HTMLElement } = $props();

    /** Pause in typing the input reference before the passage is displayed. */
    const TYPING_DEBOUNCE_MS = 500;

    const BIBLE_TYPE_ORDER = ['catholic', 'protestant', 'other'] as const;

    /** Formatting buttons: id, display option and label. */
    const FORMAT_BUTTONS: readonly { id: string; option: keyof DisplayOptions; label: string }[] = [
        { id: 'display-quotes', option: 'quotes', label: '" "' },
        { id: 'display-verse-numbers', option: 'verseNumbers', label: '123' },
        { id: 'display-line-breaks', option: 'lineBreaks', label: '↲' },
        { id: 'display-ellipsis', option: 'ellipsis', label: '[...]' },
        { id: 'display-parentheses-reference', option: 'parenthesesReference', label: '()' },
        { id: 'display-section-titles', option: 'sectionTitles', label: 'T' },
    ];

    const formatTitles: Record<keyof DisplayOptions, () => string> = {
        quotes: () => t('buttons.quotes'),
        verseNumbers: () => t('buttons.verseNumbers'),
        lineBreaks: () => t('buttons.lineBreaks'),
        ellipsis: () => t('buttons.ellipsis'),
        parenthesesReference: () => t('buttons.parenthesesReference'),
        sectionTitles: () => t('buttons.sectionTitles'),
    };

    let referenceField: HTMLInputElement;
    let staticActionButtons: HTMLElement;
    let historyModal: HistoryModal;
    let crossReferencesModal: CrossReferencesModal;
    let referenceHelpModal: ReferenceHelpModal;
    let fileHelpModal: FileHelpModal;
    let textSearchModal: TextSearchModal;

    /** The floating buttons are shown when the original buttons leave the screen. */
    let floatingVisible = $state(false);

    /** Translations of the interface language and, if it is of another one, the selected Bible. */
    const bibleGroups = $derived.by(() => {
        const bibles = selectableBibles(reader.bibles, uiLanguage().code, reader.bibleKey);
        return BIBLE_TYPE_ORDER.map((type) => ({
            type,
            bibles: bibles.filter((bible) => (bible.type || 'other') === type),
        })).filter((group) => group.bibles.length > 0);
    });

    const books = $derived(reader.ebf?.bible.books ?? []);

    function updateFloatingButtons(): void {
        const rect = staticActionButtons.getBoundingClientRect();
        const isVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
        floatingVisible = !isVisible;
    }

    // The passage changes the height of the page
    $effect(() => {
        // Only reads the state, to run again when it changes
        // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator
        void reader.resultHtml;
        void tick().then(updateFloatingButtons);
    });

    const showWhileTyping = debounce(editInputReference, TYPING_DEBOUNCE_MS);

    function onReferenceKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            // Display right away, without waiting for the typing pause
            showWhileTyping.cancel();
            editInputReference();
            endEdit();
        }
    }

    /** The balloon after a verse opens its cross-references. */
    function onResultClick(event: MouseEvent): void {
        const button = (event.target as Element).closest<HTMLElement>('.cross-references-button');
        const element = reader.passage?.elements[Number(button?.dataset.element)];
        if (!reader.ebf || element?.type !== 'verse' || !element.crossReferences) return;

        const { source, references } = element.crossReferences;
        void crossReferencesModal.open(source, resolveCrossReferences(reader.ebf, references));
    }
</script>

<svelte:window onscroll={updateFloatingButtons} onresize={updateFloatingButtons} />

{#snippet chapterButtons(prefix: string)}
    <button
        id="{prefix}prev-chapter-button"
        class={['action-button', reader.resultError && 'hidden']}
        title={t('buttons.prevChapter')}
        use:clickFeedback
        onclick={() => {
            navigateChapter(-1);
        }}>&#9664;</button
    >
    <button
        id="{prefix}copy-button"
        class={['action-button', reader.resultError && 'hidden']}
        title={t('buttons.copy')}
        use:clickFeedback
        onclick={copyResult}>&#128203;</button
    >
    <button
        id="{prefix}share-button"
        class={['action-button', reader.resultError && 'hidden']}
        title={t('buttons.share')}
        aria-label={t('buttons.share')}
        use:clickFeedback
        onclick={sharePassage}
        ><svg class="share-icon" viewBox="0 0 24 24" aria-hidden="true"
            ><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line
                x1="8.6"
                y1="13.5"
                x2="15.4"
                y2="17.5"
            /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg
        ></button
    >
    <button
        id="{prefix}next-chapter-button"
        class={['action-button', reader.resultError && 'hidden']}
        title={t('buttons.nextChapter')}
        use:clickFeedback
        onclick={() => {
            navigateChapter(1);
        }}>&#9654;</button
    >
{/snippet}

<div id="reader" class="main-content" bind:this={root}>
    <div class="container">
        <div class="preloaded-bibles">
            <div class="bible-selection">
                <h3 class="page-title">{t('reader.chooseTranslation')}</h3>
            </div>
            <div class="bible-selection">
                <LanguageSelect />
                <select
                    id="bible-select"
                    value={reader.bibleKey}
                    onchange={(event) => {
                        chooseBible(event.currentTarget.value);
                    }}
                >
                    {#each bibleGroups as group (group.type)}
                        <optgroup label={t(`reader.bibleTypes.${group.type}`)}>
                            {#each group.bibles as bible (bibleKey(bible))}
                                <option value={bibleKey(bible)}>{bible.name}</option>
                            {/each}
                        </optgroup>
                    {/each}
                    {#if reader.bibles.length > 0}
                        <option value={UPLOAD_KEY}>{t('reader.upload')}</option>
                    {/if}
                </select>
                <ThemeButton />
            </div>
        </div>

        <div class="file-input-container" style:display={reader.bibleKey === UPLOAD_KEY ? 'block' : 'none'}>
            <input
                type="file"
                id="bible-file"
                onchange={(event) => {
                    void uploadBible(event.currentTarget.files?.[0]);
                }}
            />
            <button
                id="download-ebf-button"
                class="action-button"
                title={t('buttons.downloadEbf')}
                disabled={reader.uploadedFileName === null}
                use:clickFeedback
                onclick={downloadEbfFile}
            >
                <span class="download-icon">&#x23EC;</span>
            </button>
            <button
                id="file-help-button"
                class="action-button"
                title={t('buttons.fileHelp')}
                use:clickFeedback
                onclick={() => {
                    fileHelpModal.open();
                }}
            >
                <span class="help-icon">&#x2753;</span>
            </button>
        </div>

        <Expandable class="book-section">
            {#snippet header()}
                <span id="book-section-title">{books.length > 0 ? t('reader.booksCount', { count: books.length }) : t('reader.books')}</span>
            {/snippet}
            <div id="book-list" class="book-list">
                {#each books as book, index (index)}
                    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                    <div
                        class="book-item"
                        title={getBookName(book)}
                        onclick={() => {
                            referenceField.focus();
                            goToInputReference(`${getBookAbbreviation(book)} 1`);
                        }}
                    >
                        {getBookAbbreviation(book)}
                    </div>
                {/each}
            </div>
        </Expandable>

        <div class="search-box">
            <input
                type="text"
                id="reference"
                placeholder={t('reader.referencePlaceholder')}
                dir="auto"
                aria-invalid={reader.wrongReference ? 'true' : undefined}
                bind:this={referenceField}
                bind:value={reader.inputReference}
                oninput={showWhileTyping}
                onchange={endEdit}
                onkeydown={onReferenceKeydown}
            />
            <button
                id="text-search-button"
                class="action-button"
                title={t('buttons.textSearch')}
                use:clickFeedback
                onclick={() => {
                    textSearchModal.open();
                }}
            >
                <span class="search-icon">&#x1F50E;</span>
            </button>
            <button
                id="history-button"
                class="action-button"
                title={t('buttons.history')}
                use:clickFeedback
                onclick={() => {
                    historyModal.open(storage.getSearchHistory());
                }}
            >
                <span class="history-icon">&#x23F3;</span>
            </button>
            <button
                id="reference-help-button"
                class="action-button"
                title={t('buttons.referenceHelp')}
                use:clickFeedback
                onclick={() => {
                    referenceHelpModal.open();
                }}
            >
                <span class="help-icon">&#x2753;</span>
            </button>
        </div>

        <div class="buttons-block" id="formatting-buttons">
            {#each FORMAT_BUTTONS as { id, option, label } (id)}
                <button
                    {id}
                    class={['format-button', reader.displayOptions[option] && 'active']}
                    title={formatTitles[option]()}
                    onclick={() => {
                        toggleDisplayOption(option);
                    }}>{label}</button
                >
            {/each}
        </div>

        <div class="buttons-block" id="static-action-buttons" bind:this={staticActionButtons}>
            {@render chapterButtons('')}
        </div>

        <div class="result-container">
            <!-- The result HTML is built by src/core/render.ts, with the Bible texts escaped -->
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="result" id="result" dir="auto" onclick={onResultClick}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html reader.resultHtml}
            </div>

            <!-- Floating navigation buttons -->
            <div class={['buttons-block', floatingVisible && 'visible']} id="floating-action-buttons">
                {@render chapterButtons('floating-')}
            </div>
        </div>

        <Expandable id="about-footer" class="about-section">
            {#snippet header()}
                <span>{t('about.title')}</span>
            {/snippet}
            <ul>
                <li>
                    <span>{t('about.developedBy')}</span><br />
                    <a href="https://github.com/natanael127" target="_blank" rel="noopener noreferrer">Natanael de Souza Figueiredo</a>
                </li>
                <li>
                    <span>{t('about.translationsAveMariaCnbb')}</span><br />
                    <a href="https://yourmenial.blogspot.com/" target="_blank" rel="noopener noreferrer">Gustavo Monteiro Gonçalves</a>
                </li>
                <li>
                    <span>{t('about.translationsAaAcfNvi')}</span><br />
                    <a href="https://github.com/thiagobodruk/bible" target="_blank" rel="noopener noreferrer">Thiago Bodruk</a>
                </li>
                <li>
                    <span>{t('about.translationPadreMatosSoares')}</span><br />
                    <a href="https://catolicoabencoai.app.br/" target="_blank" rel="noopener noreferrer">Hans Mateus Boron</a>
                </li>
            </ul>
            <p>
                <a href="mailto:contato@abrasuabiblia.com.br" target="_blank" rel="noopener noreferrer">contato@abrasuabiblia.com.br</a>
            </p>
            <!-- Commit hash and date of the build (scripts/build-version.ts) -->
            <p id="build-version" class="build-version"><span>{t('about.version')}</span> {__PAGE_VERSION__}</p>
        </Expandable>
    </div>

    <HistoryModal bind:this={historyModal} onselect={goToInputReference} />
    <CrossReferencesModal bind:this={crossReferencesModal} onselect={goToInputReference} />
    <ReferenceHelpModal bind:this={referenceHelpModal} bible={reader.ebf} />
    <FileHelpModal bind:this={fileHelpModal} />
    <TextSearchModal bind:this={textSearchModal} bible={reader.ebf} onselect={goToInputReference} />
</div>
