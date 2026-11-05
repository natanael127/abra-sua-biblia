<!--
    SPA shell: draws the screens and the main menu and connects them to the
    router, which shows the screen of the current URL and hides the others. To
    add a screen, create it in src/screens/ and add its route before the reader
    screen, whose pattern (/:language?/...) accepts any first segment; a page of
    the main menu also goes into PAGE_PATHS (src/screens/navigation.ts).
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { t } from './i18n/reactive.svelte';
    import { createRouter, type Router, type Screen } from './router/router';
    import About from './screens/about/About.svelte';
    import { type Destination, ensureReaderBehindPage, navigateTo, PAGE_PATHS, type PageId } from './screens/navigation';
    import Reader from './screens/reader/Reader.svelte';
    import { createReaderScreen } from './screens/reader/reader.svelte';
    import { READER_PATTERN } from './screens/reader/url';
    import MainMenu from './ui/components/MainMenu.svelte';

    let readerRoot = $state<HTMLElement>();
    let aboutRoot = $state<HTMLElement>();

    /** Screen displayed. */
    let current = $state<Destination>('reader');
    let router: Router | undefined;

    const PAGE_TITLES: Record<PageId, () => string> = {
        about: () => t('menu.about'),
    };

    /** Screen of a page of the menu: static, only its title goes into the page title. */
    const pageScreen = (page: PageId, root: HTMLElement): Screen => ({
        root,
        show() {
            current = page;
        },
    });

    // The reader sets the title itself (the displayed passage)
    $effect(() => {
        if (current !== 'reader') {
            document.title = `${PAGE_TITLES[current]()} - ${t('app.title')}`;
        }
    });

    onMount(() => {
        if (!readerRoot || !aboutRoot) return;
        const reader = createReaderScreen(() => router as Router, readerRoot);
        router = createRouter([
            { pattern: PAGE_PATHS.about, screen: pageScreen('about', aboutRoot) },
            {
                pattern: READER_PATTERN,
                screen: {
                    ...reader,
                    show(params) {
                        current = 'reader';
                        return reader.show(params);
                    },
                },
            },
        ]);
        ensureReaderBehindPage();
        router.start();
        return () => {
            router?.stop();
        };
    });
</script>

<Reader bind:root={readerRoot} />
<About bind:root={aboutRoot} />
<MainMenu
    {current}
    onnavigate={(destination) => {
        if (router) navigateTo(router, destination);
    }}
/>
