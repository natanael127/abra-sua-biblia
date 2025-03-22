// Variáveis exportadas
let bibleData = null;
let currentBibleId = null;
const BIBLES_PATH = 'assets/data/bibles/';

async function getAvailableBibles() {
    try {
        const response = await fetch(`${BIBLES_PATH}index.json`);
        if (!response.ok) {
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar lista de Bíblias:', error);
        return [];
    }
}

// Função central para processar dados de uma Bíblia
function processBibleData(data, bibleId = null) {
    if (data && data.bible.books) {
        bibleData = data;
        currentBibleId = bibleId;

        // Preencher e mostrar a barra lateral com os livros disponíveis
        populateBooksSidebar(bibleData.bible.books);

        return true;
    } else {
        bibleData = null;
        currentBibleId = null;
        return false;
    }
}

// Função para carregar Bíblia de um arquivo predefinido
async function loadBibleFromPredefined(bibleName) {
    // Se a mesma bíblia já estiver carregada, não precisa carregar novamente
    if (currentBibleId === bibleName && bibleData !== null) {
        return true;
    }
    
    try {
        // Carregar o arquivo JSON da pasta de Bíblias
        const response = await fetch(`${BIBLES_PATH}catholic-open/json/final/${bibleName}.json`);
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return processBibleData(data, bibleName);
    } catch (error) {
        console.error('Erro ao carregar a Bíblia:', error);
        return false;
    }
}

// Função para processar dados de uma Bíblia já carregados
function loadBibleFromData(data) {
    try {
        const success = processBibleData(data, null); // Bíblia de arquivo não tem ID permanente
        return success;
    } catch (parseError) {
        console.error('Erro ao processar dados da Bíblia:', parseError);
        return false;
    }
}

// Função para analisar referências complexas
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
    let indexListVerses = 0;
    let isLastVerse = false;
    while ((indexListVerses < parsedRef.verses.length) && !isLastVerse) {
        isLastVerse = (indexListVerses == parsedRef.verses.length - 1);
        isFirstVerse = (indexListVerses == 0);
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
        indexListVerses++;
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

/**
 * Core function to generate HTML result for a Bible reference
 * @param {Object} options - Configuration options
 * @param {string} options.reference - Bible reference to lookup
 * @param {string} options.basicInstructions - Instructions to show on parsing error
 * @param {Object} options.displayOpt - Display options
 * @param {string} [options.translationName=''] - Translation name to display
 * @param {Object} [options.tempBibleData=null] - Temporary Bible data to use instead of global
 * @returns {Object} Result object with error flag and HTML content
 */
function generateResult(options) {
    const { reference, basicInstructions, displayOpt, translationName = '' } = options;
    const useTempData = options.tempBibleData !== undefined;
    
    // Store original data if we're using temporary data
    const originalData = useTempData ? { data: bibleData, id: currentBibleId } : null;
    
    // Set up temporary data if provided
    if (useTempData && options.tempBibleData) {
        processBibleData(options.tempBibleData);
    }

    // Check if Bible data is available
    if (bibleData === null) {
        return {
            error: true,
            html: '<span class="error">É necessário carregar o arquivo da Bíblia primeiro.</span>'
        };
    }

    // Parse the reference
    const parsedRef = parseReference(reference);
    if (parsedRef === null) {
        return {
            error: true,
            html: basicInstructions
        };
    }

    // Generate the actual result
    let errorFlag = false;
    let htmlOut = '';

    // Find book
    const book = bibleData.bible.books.find(b => 
        b.abbreviation.toLowerCase() === parsedRef.book.toLowerCase() || 
        b.name.toLowerCase() === parsedRef.book.toLowerCase()
    );

    if (!book) {
        errorFlag = true;
        htmlOut = `<span class="error">Livro "${parsedRef.book}" não encontrado.</span>`;
    } else {
        // Check if chapter exists
        const chapterIndex = parsedRef.chapter - 1;
        if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
            errorFlag = true;
            htmlOut = `<span class="error">Capítulo ${parsedRef.chapter} não encontrado em ${book.name}.</span>`;
        } else {
            // Add translation name if available
            let headerText = `${book.name} ${parsedRef.chapter}`;
            if (translationName) {
                headerText += ` <span class="translation-name">(${translationName})</span>`;
            }
            htmlOut = `<div class="reference">${headerText}</div>`;

            const chapterContent = book.chapters[chapterIndex];
            parsedRef.verses = fixVersesIndexes(parsedRef, chapterContent.length);
            const verseTexts = getFormattedVerseTexts(parsedRef, chapterContent, displayOpt);
            
            if (displayOpt.parenthesesCitation) {
                let improvedRef = `${book.abbreviation} ${parsedRef.chapter}`;
                if (!parsedRef.allVerses) {
                    improvedRef += getEfectiveVerses(parsedRef.verses);
                }
                verseTexts.push(`<span class="verse-reference">(${improvedRef})</span>`);
            }

            // Main verse content
            const joinedContent = displayOpt.lineBreaks ? 
                verseTexts.join('<br>') : 
                verseTexts.join(' ');

            htmlOut += `<div class="verse-text">${joinedContent}</div>`;
        }
    }

    // Restore original data if we used temporary data
    if (originalData) {
        bibleData = originalData.data;
        currentBibleId = originalData.id;
    }

    return {
        error: errorFlag,
        html: htmlOut
    };
}

// Simplified wrapper functions
function generateResultFromExistent(reference, basicInstructions, displayOpt, translationName) {
    return generateResult({
        reference,
        basicInstructions,
        displayOpt,
        translationName
    });
}

function generateResultFromData(reference, basicInstructions, displayOpt, fileData) {
    return generateResult({
        reference,
        basicInstructions,
        displayOpt,
        translationName: 'Bíblia carregada',
        tempBibleData: fileData
    });
}

function generateResultFromUpload(reference, basicInstructions, displayOpt) {
    if (!fileCache) {
        return {
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>'
        };
    }
    
    try {
        const bibleData = JSON.parse(fileCache);
        return generateResult({
            reference,
            basicInstructions,
            displayOpt,
            translationName: 'Bíblia carregada',
            tempBibleData: bibleData
        });
    } catch (error) {
        console.error('Erro ao processar o JSON da Bíblia:', error);
        return {
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>'
        };
    }
}
