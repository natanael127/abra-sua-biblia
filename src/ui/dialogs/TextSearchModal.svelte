<!--
    Text search in the open Bible. Until the relevance index is ready (it is
    built in the background when the Bible loads), it searches in Bible order;
    once ready, the open search is redone by relevance.
-->
<script lang="ts">
    import { debounce } from 'es-toolkit';
    import { tick } from 'svelte';
    import type { EbfDocument } from '../../core/ebf';
    import {
        highlightMatches,
        highlightTerms,
        isSearchIndexReady,
        MIN_QUERY_LENGTH,
        prepareSearchIndex,
        type SearchOrder,
        type SearchResponse,
        type SearchResult,
        searchVerses,
    } from '../../core/search';
    import { t } from '../../i18n/reactive.svelte';
    import Modal from '../components/Modal.svelte';
    import { getSearchOrder, saveSearchOrder } from '../storage';
    import type { SelectReference } from './types';

    let { bible, onselect }: { bible: EbfDocument | null; onselect: SelectReference } = $props();

    /** What is below the search field: nothing, a message or the results of `query`. */
    type View =
        | { kind: 'empty' }
        | { kind: 'message'; message: string }
        | { kind: 'results'; response: SearchResponse; query: string };

    const ORDERS: readonly SearchOrder[] = ['relevance', 'book'];

    let modal: Modal;
    let input: HTMLInputElement;
    let resultsContainer: HTMLElement;

    let query = $state('');
    let order = $state<SearchOrder>(getSearchOrder());
    let view = $state.raw<View>({ kind: 'empty' });
    let selectedIndex = $state(-1);
    /** The relevance index of the Bible was ready on the last search. */
    let ranked = $state(false);

    const results = $derived(view.kind === 'results' ? view.response.results : []);

    const orderLabel = (value: SearchOrder) =>
        value === 'relevance' ? t('modals.textSearch.relevance') : t('modals.textSearch.byBook');

    const status = $derived(
        !ranked
            ? t('modals.textSearch.preparing')
            : order === 'book'
              ? t('modals.textSearch.bibleOrder')
              : t('modals.textSearch.byRelevance'),
    );

    const count = $derived.by(() => {
        if (view.kind !== 'results') return '';
        const { results: shown, total, ranked: rankedResults } = view.response;
        if (total > shown.length) {
            return t(rankedResults ? 'modals.textSearch.mostRelevant' : 'modals.textSearch.firstResults', {
                shown: shown.length,
                total,
            });
        }
        return t('modals.textSearch.results', { count: total });
    });

    const inputReference = (result: SearchResult) => `${result.bookAbbr} ${result.chapter},${result.verse}`;

    const highlighted = (result: SearchResult, searched: string) =>
        result.terms ? highlightTerms(result.text, result.terms) : highlightMatches(result.text, searched);

    function updateStatus(): void {
        ranked = !!bible && isSearchIndexReady(bible);
    }

    function performSearch(): void {
        const searched = query.trim();
        selectedIndex = -1;
        updateStatus();

        if (!bible) {
            view = { kind: 'message', message: t('modals.textSearch.noBible') };
            return;
        }
        if (searched.length < MIN_QUERY_LENGTH) {
            view = { kind: 'empty' };
            return;
        }

        const response = searchVerses(bible, searched, undefined, order);
        view =
            response.results.length === 0
                ? { kind: 'message', message: t('modals.textSearch.noResults') }
                : { kind: 'results', response, query: searched };
    }

    const searchWhileTyping = debounce(performSearch, 300);

    async function selectItem(index: number): Promise<void> {
        selectedIndex = index;
        await tick();
        resultsContainer.querySelectorAll('.text-search-result-item')[index]?.scrollIntoView({ block: 'nearest' });
    }

    function choose(result: SearchResult): void {
        modal.close();
        onselect(inputReference(result));
    }

    function chooseOrder(value: SearchOrder): void {
        if (value === order) return;
        order = value;
        saveSearchOrder(order);
        performSearch();
    }

    function onOrderKeydown(event: KeyboardEvent, buttons: HTMLElement): void {
        // Arrow keys switch between the options, as in a radio group
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const next = order === 'book' ? 'relevance' : 'book';
        chooseOrder(next);
        void tick().then(() => {
            buttons.querySelector<HTMLElement>(`[data-order="${next}"]`)?.focus();
        });
    }

    function onInputKeydown(event: KeyboardEvent): void {
        if (results.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            void selectItem(Math.min(selectedIndex + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            void selectItem(Math.max(selectedIndex - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const result = results[selectedIndex];
            if (result) choose(result);
        }
    }

    /** Shows the index state and, once it is ready, redoes the open search by relevance. */
    export function open(): void {
        modal.showModal();
        input.focus();

        const opened = bible;
        updateStatus();
        if (!opened || isSearchIndexReady(opened)) return;
        void prepareSearchIndex(opened).then(() => {
            if (!modal.isOpen() || bible !== opened) return;
            // Keep selected the verse the user was choosing with the arrow keys
            const selected = results[selectedIndex];
            searchWhileTyping.cancel();
            performSearch();
            if (selected) {
                void selectItem(results.findIndex((result) => inputReference(result) === inputReference(selected)));
            }
        });
    }

    function reset(): void {
        searchWhileTyping.cancel();
        query = '';
        view = { kind: 'empty' };
        selectedIndex = -1;
    }
</script>

<Modal bind:this={modal} id="text-search-modal" class="text-search-modal" title={t('modals.textSearch.title')} flush onclose={reset}>
    <div class="text-search-input-row">
        <input
            type="text"
            class="text-search-input"
            placeholder={t('modals.textSearch.placeholder', { min: MIN_QUERY_LENGTH })}
            bind:this={input}
            bind:value={query}
            oninput={searchWhileTyping}
            onkeydown={onInputKeydown}
        />
    </div>
    <div class="text-search-count">{view.kind === 'message' ? '' : count}</div>
    <!-- Index state (data-ranked: relevance search ready) and choice of result order -->
    <div class="text-search-options">
        <div class="text-search-status" data-ranked={String(ranked)}>{status}</div>
        <!-- Segmented control showing both orders at once -->
        <div
            class="text-search-order"
            role="radiogroup"
            tabindex="-1"
            aria-label={t('modals.textSearch.orderLabel')}
            onkeydown={(event) => {
                onOrderKeydown(event, event.currentTarget);
            }}
        >
            {#each ORDERS as value (value)}
                <button
                    type="button"
                    class="text-search-order-option"
                    role="radio"
                    data-order={value}
                    aria-checked={value === order}
                    tabindex={value === order ? 0 : -1}
                    onclick={() => {
                        chooseOrder(value);
                    }}
                >
                    {orderLabel(value)}
                </button>
            {/each}
        </div>
    </div>
    <div class="text-search-results" bind:this={resultsContainer}>
        {#if view.kind === 'message'}
            <div class="text-search-no-results">{view.message}</div>
        {:else if view.kind === 'results'}
            {@const searched = view.query}
            {#each view.response.results as result, index (index)}
                <!-- The keyboard is handled by the search field (arrows and Enter) -->
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                    class={['text-search-result-item', index === selectedIndex && 'selected']}
                    data-input-reference={inputReference(result)}
                    onclick={() => {
                        choose(result);
                    }}
                >
                    <!-- The verse text escaped, with <mark> around the matches -->
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    <div class="text-search-result-text">{@html highlighted(result, searched)}</div>
                    <div class="text-search-result-reference">{result.bookName} {result.chapter},{result.verse}</div>
                </div>
            {/each}
        {/if}
    </div>
</Modal>
