/**
 * Combobox for the interface language: flag + ISO 639-3 code on each option.
 * It is a custom control (a native <select> cannot draw images in its options),
 * following the ARIA "select-only combobox" pattern: the focus stays on the
 * button, which points to the active option with aria-activedescendant.
 */
import { FLAG_URLS } from '../i18n/flags';
import { getUiLanguage, onUiLanguageChange, setUiLanguage } from '../i18n';
import { type UiLanguage, UI_LANGUAGES } from '../i18n/languages';
import { byId } from './dom';

/** Time without typing after which the type-ahead search starts over. */
const TYPE_AHEAD_RESET_MS = 700;

const optionId = (code: string) => `language-option-${code}`;

function createFlag(code: string): HTMLImageElement {
    const flag = document.createElement('img');
    flag.className = 'language-flag';
    flag.src = FLAG_URLS[code] ?? '';
    flag.alt = '';
    flag.width = 24;
    flag.height = 18;
    return flag;
}

function createCode(code: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = 'language-code';
    element.textContent = code;
    return element;
}

export function initializeLanguageSelect(): void {
    const root = byId('language-select');
    const button = byId('language-button', HTMLButtonElement);
    const list = byId('language-listbox');

    const options = new Map<string, HTMLElement>();
    for (const language of UI_LANGUAGES) {
        const option = document.createElement('li');
        option.id = optionId(language.code);
        option.className = 'language-option';
        option.setAttribute('role', 'option');
        // The visible text is only the code; the name of the language is what makes sense for a screen reader
        option.setAttribute('aria-label', language.nativeName);
        option.title = language.nativeName;
        option.dataset.code = language.code;
        option.append(createFlag(language.code), createCode(language.code));
        options.set(language.code, option);
        list.appendChild(option);
    }

    let isOpen = false;
    let activeCode = getUiLanguage().code;
    let typed = '';
    let typedTimer: ReturnType<typeof setTimeout> | undefined;

    const setActive = (code: string) => {
        activeCode = code;
        for (const [key, option] of options) {
            option.classList.toggle('active', key === code);
        }
        const option = options.get(code);
        button.setAttribute('aria-activedescendant', isOpen ? optionId(code) : '');
        if (isOpen) {
            option?.scrollIntoView({ block: 'nearest' });
        }
    };

    const open = () => {
        isOpen = true;
        list.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        setActive(getUiLanguage().code);
    };

    const close = () => {
        isOpen = false;
        list.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        button.removeAttribute('aria-activedescendant');
    };

    const choose = (code: string) => {
        close();
        if (code !== getUiLanguage().code) {
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

    button.addEventListener('click', () => {
        if (isOpen) close();
        else open();
    });

    button.addEventListener('keydown', (event) => {
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
    });

    list.addEventListener('click', (event) => {
        const code = (event.target as Element).closest<HTMLElement>('.language-option')?.dataset.code;
        if (code) {
            choose(code);
            button.focus();
        }
    });
    // Keeps the focus on the button when clicking an option
    list.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });

    document.addEventListener('pointerdown', (event) => {
        if (isOpen && !root.contains(event.target as Node)) close();
    });
    button.addEventListener('blur', () => {
        if (isOpen) close();
    });

    const showSelected = (language: UiLanguage) => {
        button.replaceChildren(createFlag(language.code), createCode(language.code));
        for (const [code, option] of options) {
            option.setAttribute('aria-selected', String(code === language.code));
        }
        setActive(language.code);
    };
    showSelected(getUiLanguage());
    onUiLanguageChange(showSelected);
}
