/**
 * Normalization of language codes to ISO 639-3, as required by the
 * bible.language field of EBF1 (three lowercase letters, e.g. "por").
 *
 * Same rules as converters/language.py in easy-bible-format. The tables come
 * from the iso-639-3 package; only the conversion maps go into the bundle, not
 * the full list of languages. For language names, use Intl.DisplayNames.
 */
import { iso6393To1 } from 'iso-639-3/iso6393-to-1.js';
import { iso6393To2B } from 'iso-639-3/iso6393-to-2b.js';

export const UNDETERMINED_LANGUAGE = 'und';

/** Inverts an ISO 639-3 -> other standard map, skipping codes that are the same in both. */
const invert = (map: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(
        Object.entries(map)
            .filter(([iso3, other]) => iso3 !== other)
            .map(([iso3, other]) => [other, iso3]),
    );

/** ISO 639-1 (two letters) -> ISO 639-3 */
const ISO_639_1_TO_3 = invert(iso6393To1);

/** ISO 639-2 bibliographic codes (639-2/B) -> ISO 639-3 */
const ISO_639_2B_TO_3 = invert(iso6393To2B);

/**
 * Converts a language code to ISO 639-3. Accepts ISO 639-1 ("pt"),
 * ISO 639-2/B ("ger"), ISO 639-3 ("por") and tags with a region ("pt-BR",
 * "pt_BR"). Returns "und" (undetermined) if the code is not recognized.
 */
export function toIso6393(code: string | null | undefined): string {
    const language = (code ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
    if (language.length === 2) {
        return ISO_639_1_TO_3[language] ?? UNDETERMINED_LANGUAGE;
    }
    if (/^[a-z]{3}$/.test(language)) {
        return ISO_639_2B_TO_3[language] ?? language;
    }
    return UNDETERMINED_LANGUAGE;
}
