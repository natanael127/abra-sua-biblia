export const MAX_HISTORY_SIZE = 10;

/**
 * Adds an input reference, as typed, to the start of the history. While the
 * user types, each prefix ("Mt 5", "Mt 5,3", "Mt 5,3-12") replaces the
 * previous one instead of piling up entries.
 */
export function addToHistory(history: readonly string[], inputReference: string, maxSize = MAX_HISTORY_SIZE): string[] {
    if (!inputReference.trim()) return [...history];

    const lower = inputReference.toLowerCase();

    let output = history.filter((item) => item !== inputReference);

    const isStartOfExisting = output.some(
        (item) => item.toLowerCase().startsWith(lower) && item.length > inputReference.length,
    );

    output = output.filter((item) => !(lower.startsWith(item.toLowerCase()) && item.length < inputReference.length));

    if (!isStartOfExisting) {
        output.unshift(inputReference);
        output = output.slice(0, maxSize);
    }

    return output;
}
