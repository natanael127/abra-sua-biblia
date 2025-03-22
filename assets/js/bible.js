// Variáveis exportadas
let bibleData = null;
const BIBLES_PATH = 'assets/data/bibles/';

// Função central para processar dados de uma Bíblia
function processBibleData(data) {
    if (data && data.bible.books) {
        bibleData = data;

        // Preencher e mostrar a barra lateral com os livros disponíveis
        populateBooksSidebar(bibleData.bible.books);

        return true;
    } else {
        bibleData = null;
        return false;
    }
}

// Função para carregar Bíblia de um arquivo predefinido
async function loadBibleFromPredefined(bibleName) {
    try {
        // Carregar o arquivo JSON da pasta de Bíblias
        const response = await fetch(`${BIBLES_PATH}catholic-open/json/final/${bibleName}.json`);
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return processBibleData(data);
    } catch (error) {
        console.error('Erro ao carregar a Bíblia:', error);
        return false;
    }
}

// Função para processar um arquivo JSON carregado pelo usuário
function loadBibleFromFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(false);
            return;
        }
        
        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            resolve(false);
            return;
        }
        
        const fileReader = new FileReader();
        
        fileReader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                const success = processBibleData(data);
                resolve(success);
            } catch (parseError) {
                console.error('Erro ao processar JSON:', parseError);
                resolve(false);
            }
        };
        
        fileReader.onerror = function() {
            resolve(false);
        };
        
        fileReader.readAsText(file);
    });
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

function generateResult(reference, basicInstructions, displayOpt) {
    let errorFlag = false;
    let htmlOut = '';

    const parsedRef = parseReference(reference);
    if (bibleData !== null && parsedRef !== null) {
        // Find book
        const book = bibleData.bible.books.find(b => 
            b.abbreviation.toLowerCase() === parsedRef.book.toLowerCase() || 
            b.name.toLowerCase() == parsedRef.book.toLowerCase()
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
                htmlOut = `<div class="reference">${book.name} ${parsedRef.chapter}</div>`;

                const chapterContent = book.chapters[chapterIndex];
                parsedRef.verses = fixVersesIndexes(parsedRef, chapterContent.length);
                const verseTexts = getFormattedVerseTexts(parsedRef, chapterContent, displayOpt);
                if (displayOpt.parenthesesCitation) {
                    verseTexts.push(`<span class="verse-reference">(${reference})</span>`);
                }
    
                // Conteúdo principal dos versículos
                if (displayOpt.lineBreaks) {
                    joinedContent = verseTexts.join('<br>');
                } else {
                    joinedContent = verseTexts.join(' ');
                }
    
                htmlOut += `<div class="verse-text">${joinedContent}</div>`;
            }
        }
    } else if (bibleData === null) {
        errorFlag = true;
        htmlOut = '<span class="error">É necessário carregar o arquivo da Bíblia primeiro.</span>';
    } else if (parsedRef === null) {
        errorFlag = true;
        htmlOut = basicInstructions;
    }

    return {
        error: errorFlag,
        html: htmlOut,
    };
}
