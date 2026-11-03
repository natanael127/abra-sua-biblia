import { t } from '../../i18n';

const FORMATS = ['chapter', 'verse', 'from', 'range', 'combined'] as const;

/**
 * Instructions on how to type a Bible reference, in the interface language.
 * Our own static texts (they contain <code>): never data from the user.
 */
export function instructionsHtml(): string {
    const items = FORMATS.map(
        (format) =>
            `<li><strong>${t(`help.${format}.format`)}</strong><br>${t(`help.${format}.description`)}<br>${t(`help.${format}.example`)}</li>`,
    ).join('');
    return `<span class="help-content">${t('help.intro')}<ul>${items}</ul></span>`;
}
