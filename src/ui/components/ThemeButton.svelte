<script lang="ts">
    import { t } from '../../i18n/reactive.svelte';
    import { cycleTheme, getTheme, THEME_ICONS } from '../theme.svelte';
</script>

<button id="theme-button" class="theme-button" title={t(`buttons.theme.${getTheme()}`)} onclick={cycleTheme}>
    <span id="theme-icon">{THEME_ICONS[getTheme()]}</span>
</button>
