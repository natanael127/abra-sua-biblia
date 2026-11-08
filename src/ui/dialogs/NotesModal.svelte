<!--
    Notes of a verse or chapter: its comment, if it has one, and the
    cross-references (verses only), each one with the text of its verses, opened
    on click. The ones whose book the Bible lacks are listed but cannot be opened.
-->
<script lang="ts">
    import { tick } from 'svelte';
    import type { CrossReference } from '../../core/cross-references';
    import { t } from '../../i18n/reactive.svelte';
    import Modal from '../components/Modal.svelte';
    import type { SelectReference } from './types';

    let { onselect }: { onselect: SelectReference } = $props();

    let modal: Modal;
    let list: HTMLElement;
    let title = $state('');
    let comment = $state('');
    let references = $state.raw<readonly CrossReference[]>([]);

    export async function open(heading: string, text: string | undefined, items: readonly CrossReference[]): Promise<void> {
        title = heading;
        comment = text ?? '';
        references = items;
        modal.showModal();
        await tick();
        list.scrollTop = 0;
    }

    function choose(reference: string) {
        modal.close();
        onselect(reference);
    }
</script>

<Modal bind:this={modal} id="notes-modal" class="notes-modal" {title}>
    <div class="notes-list" bind:this={list}>
        {#if comment}
            <div class="notes-comment" dir="auto">{comment}</div>
        {/if}
        {#each references as { reference, text, available }, index (index)}
            {#if available}
                <button
                    class="cross-reference-item"
                    onclick={() => {
                        choose(reference);
                    }}
                >
                    <div class="cross-reference-reference">{reference}</div>
                    <div class="cross-reference-text" dir="auto">{text}</div>
                </button>
            {:else}
                <div class="cross-reference-item unavailable">
                    <div class="cross-reference-reference">{reference}</div>
                    <div class="cross-reference-text" dir="auto">{t('modals.crossReferences.unavailable')}</div>
                </div>
            {/if}
        {/each}
    </div>
</Modal>
