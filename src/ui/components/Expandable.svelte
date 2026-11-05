<!-- Section that opens and closes by clicking its header. -->
<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        id?: string;
        /** Extra class of the section. */
        class?: string;
        header: Snippet;
        children: Snippet;
    }

    let { id, class: className, header, children }: Props = $props();

    let expanded = $state(false);
</script>

<div {id} class={['expandable-section', className, expanded && 'expanded']}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <h3
        class="expandable-header"
        onclick={() => {
            expanded = !expanded;
        }}
    >
        {@render header()}<span class="expand-icon">▼</span>
    </h3>
    <div class={['expandable-content', expanded && 'expanded']}>
        {@render children()}
    </div>
</div>
