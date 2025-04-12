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

        // Preencher e mostrar a barra lateral com os livros disponíveis
        // TODO: remove it to page.js
        populateBooksSidebar(data.bible.books);

        return true;
    } else {
        return false;
    }
}

async function loadBibleFromPredefined(bibleName) {
    try {
        // Carregar o arquivo JSON da pasta de Bíblias
        const response = await fetch(`${BIBLES_PATH}catholic-open/json/${bibleName}.ebf1.json`);
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const success = processBibleData(data, bibleName);
        
        if (success) {
            return data;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Erro ao carregar a Bíblia:', error);
        return null;
    }
}

function generateResult(reference, basicInstructions, displayOpt, ebfObject = null) {
    processBibleData(ebfObject);

    // Check if Bible data is available
    if (ebfObject === null) {
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

    // Find book - priorities: abbreviation, usfm_id, names array
    userBook = parsedRef.book.toLowerCase();
    const book = ebfObject.bible.books.find(b => 
        (b.abbreviation && b.abbreviation.toLowerCase() === userBook) || 
        (b.usfm_id && b.usfm_id.toLowerCase() === userBook) || 
        (b.names && b.names.some(name => name.toLowerCase() === userBook))
    );

    if (!book) {
        errorFlag = true;
        htmlOut = `<span class="error">Livro "${parsedRef.book}" não encontrado.</span>`;
    } else {
        // Check if chapter exists
        const chapterIndex = parsedRef.chapter - 1;
        if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
            errorFlag = true;
            htmlOut = `<span class="error">Capítulo ${parsedRef.chapter} não encontrado em ${book.names[0]}.</span>`;
        } else {
            // Add translation name if available
            let headerText = `${book.names[0]} ${parsedRef.chapter}`;
            if (ebfObject.bible.name) {
                headerText += ` - ${ebfObject.bible.name}`;
            }
            htmlOut = `<div class="reference">${headerText}</div>`;

            const chapterObject = book.chapters[chapterIndex];
            chapterVerses = [];
            for (const verseObject of chapterObject.verses) {
                chapterVerses.push(verseObject.text);
            }
            parsedRef.verses = BibleUtils.fixVersesIndexes(parsedRef, chapterVerses.length);
            const verseTexts = BibleUtils.getFormattedVerseTexts(parsedRef, chapterVerses, displayOpt);
            
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

    return {
        error: errorFlag,
        html: htmlOut
    };
}

function generateResultFromEbf(reference, basicInstructions, displayOpt, ebfContent) {
    if (!ebfContent) {
        return {
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>'
        };
    }
    
    try {
        return generateResult(reference, basicInstructions, displayOpt, ebfContent);
    } catch (error) {
        console.error('Erro ao processar o JSON da Bíblia:', error);
        return {
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>'
        };
    }
}
