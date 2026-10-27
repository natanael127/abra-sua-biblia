export const MAX_HISTORY_SIZE = 10;

/**
 * Inclui uma referência no início do histórico. Enquanto o usuário digita,
 * cada prefixo ("Mt 5", "Mt 5,3", "Mt 5,3-12") substitui o anterior em vez de
 * acumular entradas.
 */
export function addToHistory(history: readonly string[], reference: string, maxSize = MAX_HISTORY_SIZE): string[] {
    if (!reference.trim()) return [...history];

    const lower = reference.toLowerCase();

    let output = history.filter((item) => item !== reference);

    const isStartOfExisting = output.some(
        (item) => item.toLowerCase().startsWith(lower) && item.length > reference.length,
    );

    output = output.filter((item) => !(lower.startsWith(item.toLowerCase()) && item.length < reference.length));

    if (!isStartOfExisting) {
        output.unshift(reference);
        output = output.slice(0, maxSize);
    }

    return output;
}
