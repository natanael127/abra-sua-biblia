/** Starts the application: interface language, theme and the SPA shell (App.svelte). */
import { mount } from 'svelte';
import App from './App.svelte';
import { initializeI18n } from './i18n';
import { initializeTheme } from './ui/theme.svelte';

export function startApp(): void {
    initializeI18n();
    initializeTheme();
    mount(App, { target: document.body });
}
