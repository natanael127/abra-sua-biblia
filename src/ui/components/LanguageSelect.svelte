<!--
    Combobox for the interface language: flag + ISO 639-3 code on each option.
    It is a custom control (a native <select> cannot draw images in its options),
    following the ARIA "select-only combobox" pattern: the focus stays on the
    button, which points to the active option with aria-activedescendant.
-->
<script lang="ts">
    import { setUiLanguage } from '../../i18n';
    import { FLAG_URLS } from '../../i18n/flags';
    import { UI_LANGUAGES } from '../../i18n/languages';
    import { t, uiLanguage } from '../../i18n/reactive.svelte';

    /** Time without typing after which the type-ahead search starts over. */
    const TYPE_AHEAD_RESET_MS = 700;

    const optionId = (code: string) => `language-option-${code}`;

    let root: HTMLElement;
    let button: HTMLButtonElement;
    const options: Record<string, HTMLElement> = {};

    let isOpen = $state(false);
    let typed = '';
    let typedTimer: ReturnType<typeof setTimeout> | undefined;

    const selectedCode = $derived(uiLanguage().code);
    /** Option highlighted by the keyboard; goes back to the selected language whenever it changes. */
    let activeCode = $derived(selectedCode);

    const setActive = (code: string) => {
        activeCode = code;
        if (isOpen) {
            options[code]?.scrollIntoView({ block: 'nearest' });
        }
    };

    const open = () => {
        isOpen = true;
        setActive(selectedCode);
    };

    const close = () => {
        isOpen = false;
    };

    const choose = (code: string) => {
        close();
        if (code !== selectedCode) {
            setUiLanguage(code);
        }
    };

    const move = (code: string | undefined) => {
        if (code) setActive(code);
    };
    const neighbour = (offset: number): string | undefined => {
        const index = UI_LANGUAGES.findIndex((language) => language.code === activeCode);
        return UI_LANGUAGES[Math.min(Math.max(index + offset, 0), UI_LANGUAGES.length - 1)]?.code;
    };

    /** Jumps to the first language whose code starts with what was typed. */
    const typeAhead = (character: string) => {
        clearTimeout(typedTimer);
        typed += character.toLowerCase();
        typedTimer = setTimeout(() => {
            typed = '';
        }, TYPE_AHEAD_RESET_MS);
        const match = UI_LANGUAGES.find((language) => language.code.startsWith(typed));
        if (!isOpen) open();
        move(match?.code);
    };

    function onKeydown(event: KeyboardEvent) {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                if (!isOpen) open();
                else move(neighbour(event.key === 'ArrowDown' ? 1 : -1));
                break;
            case 'Home':
            case 'End':
                if (!isOpen) return;
                event.preventDefault();
                move(UI_LANGUAGES[event.key === 'Home' ? 0 : UI_LANGUAGES.length - 1]?.code);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen) choose(activeCode);
                else open();
                break;
            case 'Escape':
                if (!isOpen) return;
                event.preventDefault();
                close();
                break;
            case 'Tab':
                close();
                break;
            default:
                if (event.key.length === 1 && /\p{L}/u.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.preventDefault();
                    typeAhead(event.key);
                }
        }
    }

    function onOptionClick(code: string) {
        choose(code);
        button.focus();
    }
</script>

<svelte:document
    onpointerdown={(event) => {
        if (isOpen && !root.contains(event.target as Node)) close();
    }}
/>

{#snippet flagAndCode(code: string)}
    <img class="language-flag" src={FLAG_URLS[code] ?? ''} alt="" width="24" height="18" />
    <span class="language-code">{code}</span>
{/snippet}

<div id="language-select" class="language-select" bind:this={root}>
    <button
        type="button"
        id="language-button"
        class="language-button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="language-listbox"
        aria-activedescendant={isOpen ? optionId(activeCode) : undefined}
        aria-label={t('language.label')}
        title={t('language.label')}
        bind:this={button}
        onclick={() => {
            if (isOpen) close();
            else open();
        }}
        onkeydown={onKeydown}
        onblur={() => {
            if (isOpen) close();
        }}
    >
        {@render flagAndCode(selectedCode)}
    </button>
    <!-- Clicking an option keeps the focus on the button (mousedown is cancelled); the keyboard is handled by the button -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <ul
        id="language-listbox"
        class="language-listbox"
        role="listbox"
        hidden={!isOpen}
        aria-label={t('language.label')}
        onmousedown={(event) => {
            event.preventDefault();
        }}
    >
        {#each UI_LANGUAGES as language (language.code)}
            <!-- The visible text is only the code; the name of the language is what makes sense for a screen reader -->
            <li
                id={optionId(language.code)}
                class={['language-option', language.code === activeCode && 'active']}
                role="option"
                aria-selected={language.code === selectedCode}
                aria-label={language.nativeName}
                title={language.nativeName}
                data-code={language.code}
                bind:this={options[language.code]}
                onclick={() => {
                    onOptionClick(language.code);
                }}
            >
                {@render flagAndCode(language.code)}
            </li>
        {/each}
    </ul>
</div>
