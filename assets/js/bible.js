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

function generateResult(reference, basicInstructions, displayOpt, translationName = '') {
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
                // Adicionar nome da tradução se disponível
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

function generateResultFromExistent(reference, basicInstructions, displayOpt, translationName) {
    if (bibleData === null) {
        return {
            error: true,
            html: '<span class="error">É necessário carregar o arquivo da Bíblia primeiro.</span>'
        };
    }
    
    return generateResult(reference, basicInstructions, displayOpt, translationName);
}

function generateResultFromData(reference, basicInstructions, displayOpt, fileData) {
    // Salvar o estado atual
    const previousBibleData = bibleData;
    const previousBibleId = currentBibleId;
    
    // Carregar temporariamente os dados fornecidos
    const loadSuccess = processBibleData(fileData);
    
    // Gerar o resultado
    const result = loadSuccess 
        ? generateResult(reference, basicInstructions, displayOpt, 'Bíblia carregada')
        : {
            error: true,
            html: '<span class="error">Falha ao processar os dados da Bíblia.</span>'
          };
    
    // Restaurar o estado anterior
    bibleData = previousBibleData;
    currentBibleId = previousBibleId;
    
    return result;
}

// Nova função para processar dados de um upload a partir de string JSON
function generateResultFromUpload(reference, basicInstructions, displayOpt) {
    if (!fileCache) {
        return {
            error: true,
            html: '<span class="error">Nenhum arquivo de Bíblia foi carregado.</span>'
        };
    }
    
    try {
        // Tenta fazer o parse do JSON armazenado no fileCache
        const bibleData = JSON.parse(fileCache);
        
        // Usa a função existente para processar os dados já parseados
        return generateResultFromData(reference, basicInstructions, displayOpt, bibleData);
    } catch (error) {
        console.error('Erro ao processar o JSON da Bíblia:', error);
        return {
            error: true,
            html: '<span class="error">Arquivo de Bíblia inválido ou corrompido.</span>'
        };
    }
}
