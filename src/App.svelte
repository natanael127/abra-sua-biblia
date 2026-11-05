<!--
    SPA shell: draws the screens and connects them to the router, which shows
    the one of the current URL and hides the others. To add a screen, create it
    in src/screens/ and add its route before the reader screen, whose pattern
    (/:language?/...) accepts any first segment.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { createRouter, type Router } from './router/router';
    import Reader from './screens/reader/Reader.svelte';
    import { createReaderScreen } from './screens/reader/reader.svelte';
    import { READER_PATTERN } from './screens/reader/url';

    let readerRoot = $state<HTMLElement>();

    onMount(() => {
        if (!readerRoot) return;
        const router: Router = createRouter([{ pattern: READER_PATTERN, screen: createReaderScreen(() => router, readerRoot) }]);
        router.start();
        return () => {
            router.stop();
        };
    });
</script>

<Reader bind:root={readerRoot} />
