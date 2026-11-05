<!--
    Main menu ("hamburger"): a drawer on the side of the screen with the Bible
    and the other pages. It is a popover, opened by the MenuButton of each
    screen: Esc and a click outside close it.
-->
<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
    import { type Destination, PAGE_PATHS } from '../../screens/navigation';

    interface Props {
        /** Destination currently displayed. */
        current: Destination;
        onnavigate: (destination: Destination) => void;
    }

    let { current, onnavigate }: Props = $props();

    let menu: HTMLElement;

    const ITEMS: readonly { destination: Destination; emoji: string; href: string; label: () => string }[] = [
        { destination: 'reader', emoji: '📖', href: '/', label: () => t('menu.bible') },
        { destination: 'about', emoji: 'ℹ️', href: PAGE_PATHS.about, label: () => t('menu.about') },
    ];

    function onClick(event: MouseEvent, destination: Destination): void {
        // Modified clicks (new tab, new window) are left to the browser
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        menu.hidePopover();
        onnavigate(destination);
    }
</script>

<nav id="main-menu" class="main-menu" popover="auto" aria-label={t('menu.label')} bind:this={menu}>
    <div class="main-menu-header">
        <span class="main-menu-title">{t('app.title')}</span>
        <button type="button" class="close-modal" popovertarget="main-menu" popovertargetaction="hide" title={t('buttons.close')}
            >×</button
        >
    </div>
    <ul class="main-menu-list">
        {#each ITEMS as item (item.destination)}
            <li>
                <a
                    class="main-menu-item"
                    href={item.href}
                    aria-current={item.destination === current ? 'page' : undefined}
                    onclick={(event) => {
                        onClick(event, item.destination);
                    }}
                >
                    <span class="main-menu-emoji" aria-hidden="true">{item.emoji}</span>
                    <span>{item.label()}</span>
                </a>
            </li>
        {/each}
    </ul>
</nav>

<style>
    .main-menu {
        /* Drawer along the start side of the screen (the right one in right-to-left languages) */
        position: fixed;
        inset-block: 0;
        inset-inline: 0 auto;
        width: min(80vw, 300px);
        height: 100%;
        max-height: none;
        margin: 0;
        padding: 0;
        border: none;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        box-shadow: 0 0 20px var(--shadow-color);
        translate: -100% 0;
        transition:
            translate 0.2s ease-out,
            overlay 0.2s allow-discrete,
            display 0.2s allow-discrete;
    }

    :global([dir='rtl']) .main-menu {
        translate: 100% 0;
    }

    .main-menu:popover-open,
    :global([dir='rtl']) .main-menu:popover-open {
        translate: 0 0;
    }

    /* Slides in when it opens */
    @starting-style {
        .main-menu:popover-open {
            translate: -100% 0;
        }
        :global([dir='rtl']) .main-menu:popover-open {
            translate: 100% 0;
        }
    }

    .main-menu::backdrop {
        background-color: var(--modal-overlay);
    }

    .main-menu-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid var(--border-light);
    }

    .main-menu-title {
        font-size: 18px;
        font-weight: bold;
    }

    .main-menu-list {
        margin: 0;
        padding: 8px 0;
        list-style: none;
    }

    .main-menu-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 20px;
        color: var(--text-primary);
        font-size: 17px;
        text-decoration: none;
        border-inline-start: 4px solid transparent;
        transition: background-color 0.15s;
    }

    .main-menu-item:visited {
        color: var(--text-primary);
    }

    .main-menu-item:hover,
    .main-menu-item:focus-visible {
        background-color: var(--bg-accent);
        outline: none;
    }

    .main-menu-item[aria-current='page'] {
        font-weight: bold;
        background-color: var(--bg-tertiary);
        border-inline-start-color: var(--button-active-bg);
    }

    .main-menu-emoji {
        width: 1.5em;
        font-size: 20px;
        text-align: center;
    }
</style>
