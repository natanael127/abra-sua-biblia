import type { EbfBook, EbfDocument } from '../../core/ebf';
import { getBookAbbreviation } from '../../core/ebf';
import { escapeHtml } from '../../core/text';
import { t } from '../../i18n';

/** Book of the examples (Matthew), as a USFM id: the same in every translation. */
const EXAMPLE_BOOK_ID = 'MAT';
/** Book whose name has a space in many languages (1 Corinthians). */
const SPACED_BOOK_ID = '1CO';

/** One row of the help: example reference and what it means. */
interface HelpRow {
    examples: string[];
    meaning: string;
}

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const findByUsfmId = (ebf: EbfDocument | null, usfmId: string): EbfBook | undefined =>
    ebf?.bible.books.find((book) => book.usfm_id && sameText(book.usfm_id, usfmId));

/** Unique values, ignoring case: the abbreviation is often the USFM id itself. */
const unique = (values: string[]) =>
    values.filter((value, index) => values.findIndex((other) => sameText(other, value)) === index);

/**
 * Rows of the help, with the books written as in the loaded Bible (abbreviations
 * vary a lot: "Mt", "Matt.", "Мф", "太"...), so that every example works when
 * typed. Without a Bible, the books are written by USFM id.
 */
function helpRows(ebf: EbfDocument | null): { basic: HelpRow[]; other: HelpRow[] } {
    const book = findByUsfmId(ebf, EXAMPLE_BOOK_ID) ?? ebf?.bible.books[0];
    const abbreviation = book ? getBookAbbreviation(book) : EXAMPLE_BOOK_ID;
    const usfmId = book ? book.usfm_id : EXAMPLE_BOOK_ID;
    // A name typed in full only works if it has no spaces
    const name = book?.names.find((candidate) => !/\s/.test(candidate) && !sameText(candidate, abbreviation));
    const spacedBook = findByUsfmId(ebf, SPACED_BOOK_ID);

    const row = (examples: string[], meaning: string): HelpRow => ({ examples, meaning });
    const basic = [
        row([`${abbreviation} 5`], t('help.chapter')),
        row([`${abbreviation} 5,13`], t('help.verse')),
        row([`${abbreviation} 5,3-12`], t('help.range')),
        row([`${abbreviation} 5,3-`], t('help.from')),
        row([`${abbreviation} 5,3-12.21-38`], t('help.combined')),
    ];
    const other = [
        row([`${abbreviation} 5:3-12,21-38`], t('help.colon')),
        row([`${abbreviation} 5,3–12`], t('help.dash')),
        ...(name ? [row([`${name} 5`], t('help.name'))] : []),
        ...(usfmId && !sameText(usfmId, abbreviation) ? [row([`${usfmId} 5`], t('help.usfm'))] : []),
        row(
            unique([...(spacedBook ? [getBookAbbreviation(spacedBook)] : []), SPACED_BOOK_ID]).map((book) => `${book} 13`),
            t('help.spacedName'),
        ),
    ];
    return { basic, other };
}

const rowsHtml = (rows: HelpRow[]) =>
    rows
        .map(({ examples, meaning }) => {
            // The direction of each example follows its text, as in the reference field
            const codes = examples.map((example) => `<code dir="auto">${escapeHtml(example)}</code>`).join(' ');
            return `<tr><td class="help-example">${codes}</td><td>${meaning}</td></tr>`;
        })
        .join('');

/**
 * Instructions on how to type a Bible reference, in the interface language,
 * with examples in the notation of the loaded Bible. The texts are our own
 * static ones; the book names and abbreviations come from the Bible (which may
 * be a file uploaded by the user) and are escaped. The caller provides the
 * container (help modal or result area).
 */
export function instructionsHtml(ebf: EbfDocument | null): string {
    const { basic, other } = helpRows(ebf);
    // A single table, so that both groups of rows share the columns
    return `<div class="reference-help">
        <p>${t('help.intro')}</p>
        <table class="help-examples">
            ${rowsHtml(basic)}
            <tr class="help-section"><th colspan="2">${t('help.otherForms')}</th></tr>
            ${rowsHtml(other)}
        </table>
        <p class="help-note">${t('help.note')}</p>
    </div>`;
}
