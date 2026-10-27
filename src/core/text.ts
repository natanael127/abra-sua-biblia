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
// angular (« »). The escaped form is the one escapeHtml produces from a straight
// quote, so it has to be matched before the character class.
const DOUBLE_QUOTES = /&quot;|["“”„‟«»]/g;

export function toSingleQuotes(text: string): string {
    return text.replace(DOUBLE_QUOTES, "'");
}
