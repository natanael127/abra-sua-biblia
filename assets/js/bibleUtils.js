function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseReference(reference) {
    bookName = reference.split(' ')[0];
    others = reference.split(' ').slice(1).join(' ');

    // Padrão básico: Capítulo[,Versículo(s)]
    const basicPattern = /^(\d+)(?:,(.+))?$/;
    const match = others.match(basicPattern);

    if (!match) {
        return null;
    }

    const [, chapter, verseRef] = match;

    // Versículos (pode conter múltiplas referências separadas por ponto)
    verseSegments = []
    let allVerses = true;
    if (verseRef) {
        verseSegments = verseRef.split('.');
        allVerses = false;
    }

    let versesList = [];
    allAfterLast = false;
    let segmentIndex = 0;
    while (segmentIndex < verseSegments.length && !allAfterLast) {
        const segment = verseSegments[segmentIndex];
        // Verificar se é um intervalo (ex: 5-7) ou um único versículo
        if (segment.includes('-')) {
            [start, end] = segment.split('-').map(v => parseInt(v.trim()));
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
        segmentIndex++;
    }

    // Sort verses to ensure they are in ascending order
    versesList.sort((a, b) => a - b);

    // Clean duplicates
    versesList = [...new Set(versesList)];

    return {
        book: bookName,
        chapter: parseInt(chapter),
        verses: versesList,
        allAfterLast: allAfterLast,
        allVerses: allVerses,
    };
}

function fixVersesIndexes(parsedReference, numOfVerses) {
    outputVersesList = parsedReference.verses;
    outputVersesList = outputVersesList.filter(
        verse => verse >= 0 && verse < numOfVerses
    );

    if (parsedReference.allVerses) {
        outputVersesList = [];
        for (let i = 0; i < numOfVerses; i++) {
            outputVersesList.push(i);
        }
    }

    if (parsedReference.allAfterLast && outputVersesList.length > 0) {
        lastIndex = outputVersesList[outputVersesList.length - 1];
        for (let i = lastIndex + 1; i < numOfVerses; i++) {
            outputVersesList.push(i);
        }
    }

    return outputVersesList;
}

function getFormattedVerseTexts(parsedRef, chapterContent, displayOpt) {
    const verseTexts = [];

    let previousVerse = -1;
    for (let indexListVerses = 0; indexListVerses < parsedRef.verses.length; indexListVerses++) {
        const verseIndex = parsedRef.verses[indexListVerses];

        // Se não for o primeiro versículo e houver lacuna entre os versículos, adicione o marcador de omissão
        if (previousVerse >= 0 && verseIndex > previousVerse + 1) {
            if (displayOpt.ellipsis) {
                verseTexts.push('[...]');
            }
        }

        const verseObject = chapterContent[verseIndex];
        // Support both verse objects and plain text strings
        const rawVerseText = typeof verseObject === 'string' ? verseObject : verseObject?.text;
        const rawVerseTitle = typeof verseObject === 'object' ? verseObject?.title : null;
        // Escape HTML to prevent injection
        const verseText = escapeHtml(rawVerseText);
        const verseTitle = escapeHtml(rawVerseTitle);

        if (verseText) { // Verifica se o versículo existe e não é vazio
            let formattedVerse = verseText;

            // Adicionar número do versículo como sobrescrito
            if (displayOpt.verseNumbers) {
                formattedVerse = `<sup>${verseIndex + 1}</sup> ${formattedVerse}`;
            }

            // Add verse title if sectionTitles is enabled (prepend to avoid double line break)
            if (displayOpt.sectionTitles && verseTitle) {
                formattedVerse = `<span class="section-title">${verseTitle}</span>${formattedVerse}`;
            }

            if (displayOpt.quotes) {
                // Replace all kind of double quotes with single quotes
                formattedVerse = formattedVerse.replaceAll(/"/g, "'");
                formattedVerse = formattedVerse.replaceAll('"', "'");
                formattedVerse = formattedVerse.replaceAll(/&quot;/g, "'");

                // Quote the first and last verse
                let isLastVerse = (indexListVerses == parsedRef.verses.length - 1);
                let isFirstVerse = (indexListVerses == 0);
                if (isFirstVerse) {
                    formattedVerse = `"${formattedVerse}`;
                }
                if (isLastVerse) {
                    formattedVerse = `${formattedVerse}"`;
                }
            }

            verseTexts.push(formattedVerse);
        }

        previousVerse = verseIndex;
    }

    return verseTexts;
}

function getEfectiveVerses(versesList) {
    let strOut = '';

    if (versesList.length === 1) {
        strOut = `,${versesList[0] + 1}`;
    } else if (versesList.length !== 0) {
        const ranges = [];
        let rangeStart = versesList[0];
        let rangeEnd = versesList[0];

        for (let i = 1; i < versesList.length; i++) {
            if (versesList[i] === rangeEnd + 1) {
                // The current verse is consecutive to the previous one
                rangeEnd = versesList[i];
            } else {
                // The current verse is not consecutive
                if (rangeStart === rangeEnd) {
                    ranges.push(`${rangeStart + 1}`); // Single verse
                } else {
                    ranges.push(`${rangeStart + 1}-${rangeEnd + 1}`); // Range
                }
                
                // Start a new range
                rangeStart = versesList[i];
                rangeEnd = versesList[i];
            }
        }

        // Add the last range
        if (rangeStart === rangeEnd) {
            // Single verse
            ranges.push(`${rangeStart + 1}`);
        } else {
            // Range
            ranges.push(`${rangeStart + 1}-${rangeEnd + 1}`);
        }

        strOut = `,${ranges.join('.')}`;
    }

    return strOut;
}

// Export purely functional functions
window.BibleUtils = {
    escapeHtml,
    parseReference,
    fixVersesIndexes,
    getFormattedVerseTexts,
    getEfectiveVerses,
};
