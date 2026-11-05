/**
 * The interface language as Svelte state, for the components: what they
 * render with `t` (or after reading `uiLanguage()`) is rendered again when the
 * language changes. The pure logic keeps using `t` from ./index.
 */
import { getUiLanguage, onUiLanguageChange, t as translate } from './index';
import type { UiLanguage } from './languages';

let language = $state.raw(getUiLanguage());
onUiLanguageChange((changed) => {
    language = changed;
});

/** Current interface language; reading it makes the caller depend on it. */
export const uiLanguage = (): UiLanguage => language;

/** Same as i18next's `t`, but a dependency of the effect or template that calls it. */
export const t = ((...args: unknown[]) => {
    void uiLanguage();
    return (translate as unknown as (...args: unknown[]) => string)(...args);
}) as unknown as typeof translate;
