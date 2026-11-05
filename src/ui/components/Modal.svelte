<!--
    Modal box with a title and a close button. Uses <dialog>, which already
    handles the Esc key, focus and the dimmed backdrop; a click outside the box
    (on the backdrop) also closes it.
-->
<script lang="ts">
    import type { Snippet } from 'svelte';
    import { t } from '../../i18n/reactive.svelte';

    interface Props {
        id: string;
        title: string;
        /** Extra class of the <dialog>. */
        class?: string;
        /** The content fills the box, with no padding and no height limit of its own. */
        flush?: boolean;
        onclose?: () => void;
        children: Snippet;
    }

    let { id, title, class: className, flush = false, onclose, children }: Props = $props();

    let dialog: HTMLDialogElement;

    export function showModal(): void {
        dialog.showModal();
    }

    export function close(): void {
        dialog.close();
    }

    export const isOpen = (): boolean => dialog.open;
</script>

<!-- The keyboard is handled by <dialog> itself (Esc) -->
<dialog
    bind:this={dialog}
    {id}
    class={['app-modal', className]}
    onclick={(event) => {
        if (event.target === dialog) dialog.close();
    }}
    {onclose}
>
    <div class="app-modal-header">
        <h3 class="app-modal-title">{title}</h3>
        <button class="close-modal" title={t('buttons.close')} onclick={close}>×</button>
    </div>
    <div class={['help-content', flush && 'flush']}>
        {@render children()}
    </div>
</dialog>
