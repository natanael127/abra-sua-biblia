export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Double quotes in every shape the translations use, written as escapes because
// they are easy to confuse on screen: straight ("), curly (“ ”), low („ ‟) and
// angular (« »).
const DOUBLE_QUOTES = /["“”„‟«»]/g;

export function toSingleQuotes(text: string): string {
    return text.replace(DOUBLE_QUOTES, "'");
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Writes the number with superscript digits (12 -> "¹²"), for plain text. */
export function toSuperscript(value: number): string {
    return String(value).replace(/\d/g, (digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit);
}
