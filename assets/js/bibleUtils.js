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

        const verseText = chapterContent[verseIndex];
        if (verseText) { // Verifica se o versículo existe e não é vazio
            let formattedVerse = verseText;

            // Adicionar número do versículo como sobrescrito
            if (displayOpt.verseNumbers) {
                formattedVerse = `<sup>${verseIndex + 1}</sup> ${formattedVerse}`;
            }

            if (displayOpt.quotes) {
                // Replace all kind of double quotes with single quotes
                formattedVerse = formattedVerse.replaceAll(/"/g, "'");
                formattedVerse = formattedVerse.replaceAll('"', "'");
                formattedVerse = formattedVerse.replaceAll('"', "'");

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

function convertOsisToEbf(xmlContent) {
    return new Promise((resolve, reject) => {
        try {
            // Use the browser's built-in XML parser
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            
            // Handle parsing errors
            const parseError = xmlDoc.getElementsByTagName("parsererror");
            if (parseError.length > 0) {
                reject(new Error("XML parsing error: " + parseError[0].textContent));
                return;
            }
            
            // Extract Bible name from header > work > title
            let bibleName = "imported";  // Default name if not found
            const header = xmlDoc.getElementsByTagName("header")[0];
            if (header) {
                const work = header.getElementsByTagName("work")[0];
                if (work) {
                    const title = work.getElementsByTagName("title")[0];
                    if (title) {
                        bibleName = title.textContent.trim();
                    }
                }
            }

            const books = [];
            // Get all book divs
            const osisText = xmlDoc.getElementsByTagName("osisText")[0];
            if (!osisText) {
                reject(new Error("Invalid OSIS format: osisText element not found"));
                return;
            }
            
            // Find all div elements with type="book"
            const bookDivs = Array.from(osisText.getElementsByTagName("div"))
                .filter(div => div.getAttribute("type") === "book");
            
            bookDivs.forEach(bookDiv => {
                const bookName = bookDiv.getAttribute("osisID");
                const chapters = [];
                
                // Process chapters
                const chapterElements = Array.from(bookDiv.getElementsByTagName("chapter"));
                chapterElements.forEach(chapterElem => {
                    const verses = [];
                    
                    // Process verses
                    const verseElements = Array.from(chapterElem.getElementsByTagName("verse"));
                    verseElements.forEach(verseElem => {
                        // Get the text content of the verse
                        let verseText = "";
                        for (const node of verseElem.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                verseText += node.textContent;
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                verseText += node.textContent;
                            }
                        }
                        verses.push({
                            text: verseText.trim(),
                        });
                    });
                    
                    chapters.push({
                        verses: verses,
                    });
                });
                
                books.push({
                    // TODO: Differentiate between bookName and osisID
                    name: bookName,
                    abbreviation: bookName,
                    usfm_id: bookName,
                    chapters: chapters,
                });
            });
            
            resolve({
                bible: {
                    name: bibleName,
                    books: books,
                }
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// Export purely functional functions
window.BibleUtils = {
    parseReference,
    fixVersesIndexes,
    getFormattedVerseTexts,
    getEfectiveVerses,
    convertOsisToEbf,
};
