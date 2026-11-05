<!--
    Cross-references of a verse (`source`, "Jo 3,16"): each one with the text of
    its verses, opened on click. The ones whose book the Bible lacks are listed
    but cannot be opened.
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
    let source = $state('');
    let references = $state.raw<readonly CrossReference[]>([]);

    export async function open(verse: string, items: readonly CrossReference[]): Promise<void> {
        source = verse;
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

<Modal bind:this={modal} id="cross-references-modal" class="cross-references-modal" title={t('reader.crossReferences', { reference: source })}>
    <div class="cross-references-list" bind:this={list}>
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
