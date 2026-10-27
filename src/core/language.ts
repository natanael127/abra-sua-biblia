/**
 * Normalização de códigos de idioma para ISO 639-3, exigido pelo campo
 * bible.language do EBF1 (três letras minúsculas, ex.: "por").
 *
 * Mesmas regras de converters/language.py do easy-bible-format. As tabelas
 * vêm do pacote iso-639-3; só os mapas de conversão entram no bundle, não a
 * lista completa de idiomas. Para nomes de idiomas, use Intl.DisplayNames.
 */
import { iso6393To1 } from 'iso-639-3/iso6393-to-1.js';
import { iso6393To2B } from 'iso-639-3/iso6393-to-2b.js';

export const UNDETERMINED_LANGUAGE = 'und';

/** Inverte um mapa ISO 639-3 -> outro padrão, ignorando os códigos iguais nos dois. */
const invert = (map: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(
        Object.entries(map)
            .filter(([iso3, other]) => iso3 !== other)
            .map(([iso3, other]) => [other, iso3]),
    );

/** ISO 639-1 (duas letras) -> ISO 639-3 */
const ISO_639_1_TO_3 = invert(iso6393To1);

/** Códigos bibliográficos do ISO 639-2 (639-2/B) -> ISO 639-3 */
const ISO_639_2B_TO_3 = invert(iso6393To2B);

/**
 * Converte um código de idioma para ISO 639-3. Aceita ISO 639-1 ("pt"),
 * ISO 639-2/B ("ger"), ISO 639-3 ("por") e tags com região ("pt-BR", "pt_BR").
 * Retorna "und" (indeterminado) se não reconhecer.
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
