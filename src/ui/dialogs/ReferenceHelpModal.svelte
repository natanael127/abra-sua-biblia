<script lang="ts">
    import type { EbfDocument } from '../../core/ebf';
    import { t, uiLanguage } from '../../i18n/reactive.svelte';
    import { instructionsHtml } from '../../screens/reader/instructions';
    import Modal from '../components/Modal.svelte';

    /** The examples follow the Bible currently loaded. */
    let { bible }: { bible: EbfDocument | null } = $props();

    let modal: Modal;
    // Built with the plain `t`: depends on the language explicitly
    const html = $derived.by(() => {
        void uiLanguage();
        return instructionsHtml(bible);
    });

    export function open(): void {
        modal.showModal();
    }
</script>

<Modal bind:this={modal} id="reference-help-modal" title={t('modals.referenceHelp.title')}>
    <!-- Our own static texts, with the book names escaped (see instructionsHtml) -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html html}
</Modal>
