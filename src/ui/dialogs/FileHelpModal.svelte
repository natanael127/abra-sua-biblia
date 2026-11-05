<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
    import Modal from '../components/Modal.svelte';

    let modal: Modal;

    export function open(): void {
        modal.showModal();
    }
</script>

{#snippet link(href: string, text: string)}
    <a {href} target="_blank" rel="noopener noreferrer">{text}</a>
{/snippet}

<Modal bind:this={modal} id="file-help-modal" title={t('modals.fileHelp.title')}>
    <strong>{t('modals.fileHelp.formats')}</strong>
    <ul>
        <li>
            <strong>EBF/JSON</strong><br />
            {@render link('https://github.com/natanael127/easy-bible-format', 'Easy Bible Format')}
        </li>
        <li>
            <strong>OSIS/XML</strong><br />
            {@render link('https://crosswire.org/osis/', 'Open Scripture Information Standard')}
        </li>
        <li>
            <strong>USFX/XML</strong><br />
            {@render link('https://ebible.org/usfx/', 'Unified Scripture Format XML')}
        </li>
    </ul>
    <strong>{t('modals.fileHelp.repositories')}</strong>
    <ul>
        <li>{@render link('https://ebible.org/find/', 'eBible')}</li>
        <li>{@render link('https://github.com/natanael127/ebf-converted-bibles', t('modals.fileHelp.convertedBibles'))}</li>
        <li>{@render link('https://github.com/gratis-bible/bible', t('modals.fileHelp.osisBibles'))}</li>
    </ul>
</Modal>
