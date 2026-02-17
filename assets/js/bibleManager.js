const DATA_PATH = 'assets/data/';

async function getAvailableBibles() {
    try {
        const response = await fetch(`${DATA_PATH}index.json`);
        if (!response.ok) {
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar lista de Bíblias:', error);
        return [];
    }
}

async function loadBibleFromPath(biblePath) {
    output = null;

    try {
        // Carregar o arquivo JSON usando o path relativo ao DATA_PATH
        const response = await fetch(`${DATA_PATH}${biblePath}`);

        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo: ${response.status} ${response.statusText}`);
        }

        output = await response.json();
    } catch (error) {
        console.error('Erro ao carregar a Bíblia:', error);
    }

    return output;
}

function findBookByString(bookString, ebfObject) {
    return ebfObject.bible.books.find(b => 
        (b.abbreviation && b.abbreviation.toLowerCase() === bookString.toLowerCase()) || 
        (b.usfm_id && b.usfm_id.toLowerCase() === bookString.toLowerCase()) || 
        (b.names && b.names.some(name => name.toLowerCase() === bookString.toLowerCase()))
    );
}

function generateResult(reference, basicInstructions, displayOpt, ebfObject = null) {
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

    const book = findBookByString(parsedRef.book, ebfObject);

    if (!book) {
        errorFlag = true;
        htmlOut = `<span class="error">Livro "${parsedRef.book}" não encontrado.</span>`;
    } else {
        // Check if chapter exists
        const chapterIndex = parsedRef.chapter - 1;
        if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
            errorFlag = true;
            htmlOut = `<span class="error">Capítulo ${parsedRef.chapter} não encontrado em ${BibleUtils.escapeHtml(book.names[0])}.</span>`;
        } else {
            const chapterObject = book.chapters[chapterIndex];

            // Add translation name and chapter title if available
            // Escape HTML to prevent injection
            const bookName = BibleUtils.escapeHtml(book.names[0]);
            const chapterTitle = BibleUtils.escapeHtml(chapterObject.title);
            const bibleName = BibleUtils.escapeHtml(ebfObject.bible.name);
            
            let headerText = `${bookName} ${parsedRef.chapter}`;
            if (chapterTitle) {
                headerText += `: ${chapterTitle}`;
            }
            if (bibleName) {
                headerText += ` (${bibleName})`;
            }
            htmlOut = `<div class="reference">${headerText}</div>`;

            // Add chapter title if sectionTitles is enabled
            parsedRef.verses = BibleUtils.fixVersesIndexes(parsedRef, chapterObject.verses.length);
            const verseTexts = BibleUtils.getFormattedVerseTexts(parsedRef, chapterObject.verses, displayOpt);
            
            if (displayOpt.parenthesesCitation) {
                let improvedRef = `${BibleUtils.escapeHtml(book.abbreviation)} ${parsedRef.chapter}`;
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

function getNumOfChapters(abbreviation, ebfObject) {
    let numChapters = 0;

    const book = findBookByString(abbreviation, ebfObject);
    if (book) {
        numChapters = book.chapters.length;
    }

    return numChapters;
}
