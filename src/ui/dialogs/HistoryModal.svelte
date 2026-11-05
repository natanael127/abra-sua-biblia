<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
    import Modal from '../components/Modal.svelte';
    import type { SelectReference } from './types';

    let { onselect }: { onselect: SelectReference } = $props();

    let modal: Modal;
    let history = $state.raw<readonly string[]>([]);

    export function open(items: readonly string[]): void {
        history = items;
        modal.showModal();
    }

    function choose(item: string) {
        modal.close();
        onselect(item);
    }
</script>

<Modal bind:this={modal} id="history-modal" title={t('modals.history.title')}>
    <ul class="history-list">
        {#each history as item, index (index)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
            <li
                class="history-list-item"
                onclick={() => {
                    choose(item);
                }}
            >
                {item}
            </li>
        {:else}
            <li class="history-list-item">{t('modals.history.empty')}</li>
        {/each}
    </ul>
</Modal>
