<!--
    Help page (/help): what each button of the Bible screen does, each one
    drawn as it looks there, and how to type a reference (the same help as the
    ❓ modal, with examples in the open Bible), and how to install the site as
    an app on Android and on iPhone/iPad.
-->
<script lang="ts">
    import type { Snippet } from 'svelte';
    import { FLAG_URLS } from '../../i18n/flags';
    import { t, uiLanguage } from '../../i18n/reactive.svelte';
    import MenuButton from '../../ui/components/MenuButton.svelte';
    import ShareIcon from '../../ui/icons/ShareIcon.svelte';
    import { reader } from '../reader/reader.svelte';
    import { instructionsHtml } from '../reader/instructions';

    /** The screen's root element, which the router shows and hides. */
    let { root = $bindable() }: { root?: HTMLElement } = $props();

    // Built with the plain `t`: depends on the language explicitly
    const referenceHelp = $derived.by(() => {
        void uiLanguage();
        return instructionsHtml(reader.ebf);
    });

    const bibleName = $derived(reader.ebf?.bible.name ?? 'Ave-Maria');
</script>

{#snippet item(button: Snippet, description: string)}
    <li class="help-item">
        <div class="help-buttons" aria-hidden="true">{@render button()}</div>
        <p>{description}</p>
    </li>
{/snippet}

{#snippet link(href: string, text: string)}
    <a {href} target="_blank" rel="noopener noreferrer">{text}</a>
{/snippet}

{#snippet glyph(text: string)}
    <span class="action-button help-glyph">{text}</span>
{/snippet}

<div id="help" class="main-content" hidden bind:this={root}>
    <div class="container">
        <div class="page-header">
            <MenuButton />
            <h2 class="screen-title"><span aria-hidden="true">❓</span> {t('menu.help')}</h2>
        </div>

        <section class="help-card">
            <h3>{t('helpPage.menu.title')}</h3>
            <ul class="help-items">
                {#snippet menuButton()}{@render glyph('☰')}{/snippet}
                {@render item(menuButton, t('helpPage.menu.button'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.translation.title')}</h3>
            <ul class="help-items">
                {#snippet language()}
                    <span class="language-button help-glyph">
                        <img class="language-flag" src={FLAG_URLS[uiLanguage().code] ?? ''} alt="" width="24" height="18" />
                        <span class="language-code">{uiLanguage().code}</span>
                    </span>
                {/snippet}
                {@render item(language, t('helpPage.translation.language'))}
                {#snippet bible()}<span class="help-select">{bibleName}</span>{/snippet}
                {@render item(bible, t('helpPage.translation.bible'))}
                {#snippet theme()}{@render glyph('🌓')}{@render glyph('☀️')}{@render glyph('🌙')}{/snippet}
                {@render item(theme, t('helpPage.translation.theme'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.upload.title')}</h3>
            <p class="help-section-intro">{t('helpPage.upload.intro')}</p>
            <ul class="help-items">
                {#snippet file()}{@render glyph('📂')}{/snippet}
                {@render item(file, t('helpPage.upload.file'))}
                {#snippet download()}{@render glyph('⏬')}{/snippet}
                {@render item(download, t('helpPage.upload.download'))}
            </ul>
            <div class="upload-links">
                <div>
                    <h4>{t('helpPage.upload.formats')}</h4>
                    <ul>
                        <li>
                            <strong>EBF/JSON</strong>:
                            {@render link('https://github.com/natanael127/easy-bible-format', 'Easy Bible Format')}
                        </li>
                        <li>
                            <strong>OSIS/XML</strong>:
                            {@render link('https://crosswire.org/osis/', 'Open Scripture Information Standard')}
                        </li>
                        <li>
                            <strong>USFX/XML</strong>:
                            {@render link('https://ebible.org/usfx/', 'Unified Scripture Format XML')}
                        </li>
                    </ul>
                </div>
                <div>
                    <h4>{t('helpPage.upload.repositories')}</h4>
                    <ul>
                        <li>{@render link('https://ebible.org/find/', 'eBible')}</li>
                        <li>{@render link('https://github.com/natanael127/ebf-converted-bibles', t('helpPage.upload.convertedBibles'))}</li>
                        <li>{@render link('https://github.com/gratis-bible/bible', t('helpPage.upload.osisBibles'))}</li>
                    </ul>
                </div>
            </div>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.books.title')}</h3>
            <ul class="help-items">
                {#snippet books()}<span class="help-books">{t('reader.books')} ▼</span>{/snippet}
                {@render item(books, t('helpPage.books.list'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.reference.title')}</h3>
            <ul class="help-items">
                {#snippet field()}<span class="help-field">{t('reader.referencePlaceholder')}</span>{/snippet}
                {@render item(field, t('helpPage.reference.field'))}
                {#snippet search()}{@render glyph('🔎')}{/snippet}
                {@render item(search, t('helpPage.reference.search'))}
                {#snippet history()}{@render glyph('⏳')}{/snippet}
                {@render item(history, t('helpPage.reference.history'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.formatting.title')}</h3>
            <p class="help-section-intro">{t('helpPage.formatting.intro')}</p>
            <ul class="help-items">
                {#snippet quotes()}<span class="format-button active help-glyph">" "</span>{/snippet}
                {@render item(quotes, t('helpPage.formatting.quotes'))}
                {#snippet verseNumbers()}<span class="format-button active help-glyph">123</span>{/snippet}
                {@render item(verseNumbers, t('helpPage.formatting.verseNumbers'))}
                {#snippet lineBreaks()}<span class="format-button active help-glyph">↲</span>{/snippet}
                {@render item(lineBreaks, t('helpPage.formatting.lineBreaks'))}
                {#snippet ellipsis()}<span class="format-button active help-glyph">[...]</span>{/snippet}
                {@render item(ellipsis, t('helpPage.formatting.ellipsis'))}
                {#snippet parenthesesReference()}<span class="format-button active help-glyph">()</span>{/snippet}
                {@render item(parenthesesReference, t('helpPage.formatting.parenthesesReference'))}
                {#snippet sectionTitles()}<span class="format-button active help-glyph">T</span>{/snippet}
                {@render item(sectionTitles, t('helpPage.formatting.sectionTitles'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.actions.title')}</h3>
            <p class="help-section-intro">{t('helpPage.actions.intro')}</p>
            <ul class="help-items">
                {#snippet previous()}<span class="action-button help-glyph help-arrow">&#9664;</span>{/snippet}
                {@render item(previous, t('helpPage.actions.prevChapter'))}
                {#snippet next()}<span class="action-button help-glyph help-arrow">&#9654;</span>{/snippet}
                {@render item(next, t('helpPage.actions.nextChapter'))}
                {#snippet copy()}{@render glyph('📋')}{/snippet}
                {@render item(copy, t('helpPage.actions.copy'))}
                {#snippet share()}<span class="action-button help-glyph"><ShareIcon /></span>{/snippet}
                {@render item(share, t('helpPage.actions.share'))}
                {#snippet notes()}
                    <span class="notes-button help-balloon">
                        <svg viewBox="0 0 24 24"
                            ><path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /></svg
                        >
                    </span>
                {/snippet}
                {@render item(notes, t('helpPage.actions.crossReferencesAndComments'))}
            </ul>
        </section>

        <section class="help-card">
            <h3>{t('helpPage.referenceTitle')}</h3>
            <!-- Our own static texts, with the book names escaped (see instructionsHtml) -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html referenceHelp}
        </section>

        <section class="help-card">
            <h3>{t('helpPage.install.title')}</h3>
            <p class="help-section-intro">{t('helpPage.install.intro')}</p>
            <div class="install-platforms">
                <div>
                    <h4>{t('helpPage.install.android.title')}</h4>
                    <ol>
                        <li>{t('helpPage.install.android.step1')}</li>
                        <li>{t('helpPage.install.android.step2')}</li>
                        <li>{t('helpPage.install.android.step3')}</li>
                        <li>{t('helpPage.install.android.step4')}</li>
                    </ol>
                    <p class="install-tip">{t('helpPage.install.android.tip')}</p>
                </div>
                <div>
                    <h4>{t('helpPage.install.ios.title')}</h4>
                    <ol>
                        <li>{t('helpPage.install.ios.step1')}</li>
                        <li>{t('helpPage.install.ios.step2')}</li>
                        <li>{t('helpPage.install.ios.step3')}</li>
                        <li>{t('helpPage.install.ios.step4')}</li>
                    </ol>
                    <p class="install-tip">{t('helpPage.install.ios.tip')}</p>
                </div>
            </div>
            <p class="install-after">{t('helpPage.install.after')}</p>
        </section>
    </div>
</div>

<style>
    .help-card {
        padding: 15px 20px;
        border: 1px solid var(--border-light);
        border-radius: 8px;
        background-color: var(--bg-secondary);
    }

    .help-card h3 {
        margin: 0 0 10px;
        font-size: 17px;
        color: var(--link-color);
    }

    .help-section-intro {
        margin: 0 0 10px;
        color: var(--text-secondary);
        font-size: 15px;
    }

    .help-items {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .help-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-light);
    }

    .help-item:last-child {
        border-bottom: none;
    }

    .help-item p {
        margin: 0;
        flex: 1;
    }

    /* The buttons as they look on the Bible screen, in a column of the same width */
    .help-buttons {
        flex: none;
        display: flex;
        gap: 6px;
        justify-content: center;
        width: 150px;
    }

    /* Drawings of buttons (spans with the classes of the real ones): no interaction */
    .help-glyph {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 36px;
        padding: 4px 8px;
        box-sizing: border-box;
        cursor: default;
        pointer-events: none;
    }

    .help-glyph.format-button {
        font-size: 16px;
    }

    .help-select,
    .help-field,
    .help-books {
        display: inline-block;
        max-width: 100%;
        padding: 6px 10px;
        box-sizing: border-box;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        border: 1px solid var(--border-accent);
        border-radius: 4px;
        background-color: var(--bg-primary);
        font-size: 15px;
    }

    .help-select::after {
        content: ' ▾';
        color: var(--text-secondary);
    }

    .help-field {
        border-color: var(--border-color);
        color: var(--text-secondary);
    }

    .help-books {
        border-color: var(--border-light);
        background-color: var(--bg-tertiary);
        font-weight: bold;
    }

    .help-balloon {
        width: 28px;
        height: 24px;
        opacity: 1;
        vertical-align: middle;
        cursor: default;
    }

    /* Right-to-left languages: the arrows point the other way, as on the Bible screen */
    :global([dir='rtl']) .help-arrow {
        transform: scaleX(-1);
    }

    /* Supported formats and where to find Bibles */
    .upload-links {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 4px 20px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--border-light);
    }

    .upload-links h4 {
        margin: 0 0 4px;
        font-size: 15px;
    }

    .upload-links ul {
        margin: 0 0 6px;
        padding-inline-start: 20px;
    }

    /* Installing as an app: the steps of each system side by side, one below the other on narrow screens */
    .install-platforms {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 4px 20px;
    }

    .install-platforms h4 {
        margin: 6px 0 4px;
        font-size: 15px;
    }

    .install-platforms ol {
        margin: 0 0 6px;
        padding-inline-start: 22px;
    }

    .install-platforms li {
        margin-bottom: 4px;
    }

    .install-tip {
        margin: 0 0 8px;
        color: var(--text-secondary);
        font-size: 14px;
    }

    .install-after {
        margin: 6px 0 0;
        padding-top: 10px;
        border-top: 1px solid var(--border-light);
    }

    /* Narrow screens: the description goes below the buttons */
    @media (max-width: 480px) {
        .help-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }

        .help-buttons {
            width: auto;
            justify-content: flex-start;
        }
    }
</style>
