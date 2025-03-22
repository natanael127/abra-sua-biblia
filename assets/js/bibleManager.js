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

function loadBibleFromData(data) {
    try {
        const success = processBibleData(data, null); // Bíblia de arquivo não tem ID permanente
        return success;
    } catch (parseError) {
        console.error('Erro ao processar dados da Bíblia:', parseError);
        return false;
    }
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
    const parsedRef = BibleUtils.parseReference(reference);
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
            parsedRef.verses = BibleUtils.fixVersesIndexes(parsedRef, chapterContent.length);
            const verseTexts = BibleUtils.getFormattedVerseTexts(parsedRef, chapterContent, displayOpt);
            
            if (displayOpt.parenthesesCitation) {
                let improvedRef = `${book.abbreviation} ${parsedRef.chapter}`;
                if (!parsedRef.allVerses) {
                    improvedRef += BibleUtils.getEfectiveVerses(parsedRef.verses);
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

function generateResultFromExistent(reference, basicInstructions, displayOpt, translationName) {
    return generateResult({
        reference,
        basicInstructions,
        displayOpt,
        translationName
    });
}

function generateResultFromUpload(reference, basicInstructions, displayOpt, fileRaw) {
    if (!fileRaw) {
        return {
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>'
        };
    }
    
    try {
        return generateResult({
            reference,
            basicInstructions,
            displayOpt,
            translationName: 'Bíblia carregada',
            tempBibleData: JSON.parse(fileRaw)
        });
    } catch (error) {
        console.error('Erro ao processar o JSON da Bíblia:', error);
        return {
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>'
        };
    }
}
