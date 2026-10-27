export interface ParsedReference {
    book: string;
    chapter: number;
    /** Índices dos versículos (base 0), ordenados e sem repetição. */
    verses: number[];
    /** A referência termina em "N-": todos os versículos a partir de N. */
    allAfterLast: boolean;
    /** A referência não especifica versículos: capítulo inteiro. */
    allVerses: boolean;
}

/**
 * Interpreta referências no formato "Livro capítulo[,versículos]", em que
 * versículos são números ou intervalos separados por ponto. Ex.: "Mt 5,3-12.21-".
 */
export function parseReference(reference: string): ParsedReference | null {
    const [book = '', ...rest] = reference.split(' ');
    const others = rest.join(' ');

    // Padrão básico: Capítulo[,Versículo(s)]
    const match = /^(\d+)(?:,(.+))?$/.exec(others);
    if (!match) {
        return null;
    }

    const chapter = match[1] ?? '';
    const verseRef = match[2];

    // Versículos (pode conter múltiplas referências separadas por ponto)
    const verseSegments = verseRef ? verseRef.split('.') : [];
    const allVerses = !verseRef;

    const versesList: number[] = [];
    let allAfterLast = false;
    for (const segment of verseSegments) {
        if (allAfterLast) break;

        // Verificar se é um intervalo (ex: 5-7) ou um único versículo
        if (segment.includes('-')) {
            const [startText = '', endText = ''] = segment.split('-');
            const start = parseInt(startText.trim());
            let end = parseInt(endText.trim());
            if (isNaN(end)) {
                allAfterLast = true;
                end = start;
            }
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (i > 0) {
                        versesList.push(i - 1);
                    }
                }
            }
        } else {
            const verseNumber = parseInt(segment.trim());
            if (!isNaN(verseNumber)) {
                versesList.push(verseNumber - 1);
            }
        }
    }

    versesList.sort((a, b) => a - b);

    return {
        book,
        chapter: parseInt(chapter),
        verses: [...new Set(versesList)],
        allAfterLast,
        allVerses,
    };
}

/**
 * Ajusta os índices dos versículos ao tamanho real do capítulo: descarta os
 * inexistentes e expande "capítulo inteiro" e "a partir de N".
 */
export function resolveVerseIndexes(parsedReference: ParsedReference, numOfVerses: number): number[] {
    if (parsedReference.allVerses) {
        return Array.from({ length: numOfVerses }, (_, i) => i);
    }

    const output = parsedReference.verses.filter((verse) => verse >= 0 && verse < numOfVerses);

    const lastIndex = output.at(-1);
    if (parsedReference.allAfterLast && lastIndex !== undefined) {
        for (let i = lastIndex + 1; i < numOfVerses; i++) {
            output.push(i);
        }
    }

    return output;
}

/**
 * Compacta índices de versículos (base 0) na notação de referência.
 * Ex.: [0, 1, 2, 4] -> ",1-3.5". Lista vazia gera texto vazio.
 */
export function formatVerseRanges(versesList: readonly number[]): string {
    const first = versesList[0];
    if (first === undefined) {
        return '';
    }

    const ranges: string[] = [];
    const pushRange = (start: number, end: number) => {
        ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
    };

    let rangeStart = first;
    let rangeEnd = first;
    for (const verse of versesList.slice(1)) {
        if (verse === rangeEnd + 1) {
            rangeEnd = verse;
        } else {
            pushRange(rangeStart, rangeEnd);
            rangeStart = verse;
            rangeEnd = verse;
        }
    }
    pushRange(rangeStart, rangeEnd);

    return `,${ranges.join('.')}`;
}
