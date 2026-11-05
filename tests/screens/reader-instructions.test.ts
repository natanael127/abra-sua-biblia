// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildPassage, DEFAULT_DISPLAY_OPTIONS } from '../../src/core/passage';
import type { EbfDocument } from '../../src/core/ebf';
import { instructionsHtml } from '../../src/screens/reader/instructions';
import { setUiLanguage } from '../../src/i18n';
import { UI_LANGUAGES } from '../../src/i18n/languages';
import { listBibleFiles, loadBible } from '../helpers';

/** Parses the help into rows: the example references and the meaning of each one. */
function rows(html: string) {
    const help = document.createElement('div');
    help.innerHTML = html;
    return [...help.querySelectorAll('tr:not(.help-section)')].map((row) => ({
        examples: [...row.querySelectorAll('code')].map((code) => code.textContent),
        meaning: row.querySelector('td:last-child')?.textContent ?? '',
    }));
}

const examples = (html: string) => rows(html).flatMap((row) => row.examples);

const book = (usfmId: string | undefined, abbreviation: string, names: string[]) => ({
    ...(usfmId && { usfm_id: usfmId }),
    abbreviation,
    names,
    chapters: [],
});

const bibleWith = (...books: ReturnType<typeof book>[]) => ({ bible: { name: 'Test', books } }) as unknown as EbfDocument;

describe('instructionsHtml', () => {
    it('shows every notation, with the books written as in the loaded Bible', () => {
        expect(rows(instructionsHtml(loadBible('por_ave_maria')))).toEqual([
            { examples: ['Mt 5'], meaning: 'capítulo 5 inteiro' },
            { examples: ['Mt 5,13'], meaning: 'versículo 13' },
            { examples: ['Mt 5,3-12'], meaning: 'versículos de 3 a 12' },
            { examples: ['Mt 5,3-'], meaning: 'do versículo 3 até o fim do capítulo' },
            { examples: ['Mt 5,3-12.21-38'], meaning: 'versículos de 3 a 12 e de 21 a 38 (o ponto separa as partes)' },
            { examples: ['Mt 5:3-12,21-38'], meaning: 'dois-pontos depois do capítulo; aí as partes são separadas por vírgula' },
            { examples: ['Mt 5,3–12'], meaning: 'travessão no lugar do hífen' },
            { examples: ['Mateus 5'], meaning: 'nome completo do livro' },
            { examples: ['MAT 5'], meaning: 'código USFM do livro, o mesmo em todas as traduções' },
            {
                examples: ['1Cor 13', '1CO 13'],
                meaning: 'livros com espaço no nome (como 1 Coríntios): só pela abreviação ou pelo código USFM',
            },
        ]);
    });

    it('follows the abbreviations of the Bible', () => {
        const help = instructionsHtml(loadBible('rus_syno_400'));
        expect(examples(help)).toContain('Мф 5,13');
        expect(examples(help)).toContain('1Кор 13');
    });

    it('leaves out a full name with spaces, which would not work', () => {
        // "São Mateus"
        expect(examples(instructionsHtml(loadBible('por_aparecida')))).not.toContain('São Mateus 5');
        expect(examples(instructionsHtml(loadBible('por_aparecida'))).some((example) => example.startsWith('São'))).toBe(
            false,
        );
    });

    it('does not repeat the abbreviation when it is the USFM id itself', () => {
        const help = instructionsHtml(bibleWith(book('MAT', 'MAT', ['Matthew']), book('1CO', '1CO', ['1 Corinthians'])));
        // Only in the first row (whole chapter): no row of its own for the USFM id
        expect(examples(help).filter((example) => example === 'MAT 5')).toHaveLength(1);
        expect(examples(help)).toContain('Matthew 5');
        expect(rows(help).at(-1)?.examples).toEqual(['1CO 13']);
    });

    it('does not repeat the abbreviation as the full name', () => {
        // "Matthäus" is both
        expect(examples(instructionsHtml(loadBible('deu_delut_51'))).filter((example) => example === 'Matthäus 5')).toHaveLength(
            1,
        );
    });

    it('without a Bible, writes the books by USFM id', () => {
        expect(examples(instructionsHtml(null))).toEqual([
            'MAT 5',
            'MAT 5,13',
            'MAT 5,3-12',
            'MAT 5,3-',
            'MAT 5,3-12.21-38',
            'MAT 5:3-12,21-38',
            'MAT 5,3–12',
            '1CO 13',
        ]);
    });

    it('without Matthew, uses the first book of the Bible', () => {
        const help = instructionsHtml(bibleWith(book('GEN', 'Gn', ['Gênesis'])));
        expect(examples(help)).toContain('Gn 5,13');
        expect(examples(help)).toContain('Gênesis 5');
        expect(examples(help)).toContain('GEN 5');
    });

    it('escapes the names and abbreviations, which may come from an uploaded file', () => {
        const help = instructionsHtml(bibleWith(book('MAT', '<img src=x onerror=alert(1)>', ['<b>Mt</b>'])));
        const element = document.createElement('div');
        element.innerHTML = help;
        expect(element.querySelector('img, b')).toBeNull();
        expect(examples(help)).toContain('<b>Mt</b> 5');
    });

    it.each(listBibleFiles())('every example opens a passage in %s (if it has the book)', (file) => {
        const ebf = loadBible(file.replace(/\.ebf1\.json$/, ''));
        const hasMatthew = ebf.bible.books.some((b) => b.usfm_id === 'MAT');
        const hasSpacedBook = ebf.bible.books.some((b) => b.usfm_id === '1CO');
        const references = examples(instructionsHtml(ebf)).filter((reference) =>
            reference.endsWith(' 13') ? hasSpacedBook : hasMatthew,
        );
        for (const reference of references) {
            expect(buildPassage(reference, ebf, DEFAULT_DISPLAY_OPTIONS).kind, reference).toBe('passage');
        }
    });

    it('is translated into every interface language, with the same rows', () => {
        const portuguese = rows(instructionsHtml(loadBible('por_ave_maria')));
        try {
            for (const { code } of UI_LANGUAGES) {
                setUiLanguage(code, { persist: false });
                const translated = rows(instructionsHtml(loadBible('por_ave_maria')));
                expect(translated.map((row) => row.examples), code).toEqual(portuguese.map((row) => row.examples));
                expect(new Set(translated.map((row) => row.meaning)).size, code).toBe(portuguese.length);
            }
        } finally {
            setUiLanguage('por', { persist: false });
        }
    });
});
