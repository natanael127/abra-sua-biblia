<!-- Opens the main menu (MainMenu.svelte); each screen has one in its header. -->
<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
</script>

<button type="button" class="menu-button" popovertarget="main-menu" aria-label={t('menu.open')} title={t('menu.open')}>☰</button>

<style>
    .menu-button {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        padding: 6px 12px;
        background-color: var(--button-bg);
        color: var(--text-primary);
        border: 1px solid var(--border-accent);
        border-radius: 4px;
        font-size: 20px;
        line-height: 1.4;
        transition: background-color 0.2s;
    }

    .menu-button:hover {
        background-color: var(--button-hover);
    }

    .menu-button:focus-visible {
        outline: none;
        border-color: var(--success-color);
    }
</style>
