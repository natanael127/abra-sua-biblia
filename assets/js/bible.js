// Variáveis exportadas
let bibleData = null;
const BIBLES_PATH = 'assets/data/bibles/';

// Função central para processar dados de uma Bíblia
function processBibleData(data) {
    if (data && data.bible.books) {
        bibleData = data;

        // Preencher e mostrar a barra lateral com os livros disponíveis
        populateBooksSidebar(bibleData.bible.books);
        
        // Atualizar o resultado se já houver uma referência
        const reference = document.getElementById('reference').value.trim();
        if (reference) {
            searchVerse();
        }

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

    // Se não houver referência de versículo, é o capítulo inteiro
    if (!verseRef) {
        return {
            book: bookName,
            chapter: parseInt(chapter),
            verses: null
        };
    }
    
    // Analisar a parte de versículos (pode conter múltiplas referências separadas por ponto)
    const verseSegments = verseRef.split('.');
    let verses = [];
    
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
                        verses.push(i - 1);
                    }
                }
            }
        } else {
            const verseNumber = parseInt(segment.trim());
            if (!isNaN(verseNumber)) {
                verses.push(verseNumber - 1);
            }
        }
        segmentIndex++;
    }
    
    return {
        book: bookName,
        chapter: parseInt(chapter),
        verses: verses,
        allAfterLast: allAfterLast
    };
}

// Função para buscar o versículo
async function searchVerse() {
    const reference = document.getElementById('reference').value.trim();
    const resultElement = document.getElementById('result');
    const copyButton = document.getElementById('copy-button');
    
    // Salvar a referência atual ao pesquisar
    saveReferencePreference(reference);
    
    // Ocultar botão de copiar ao iniciar nova busca
    copyButton.classList.remove('visible');
    
    // Verificar se a Bíblia foi carregada
    if (!bibleData) {
        resultElement.innerHTML = '<span class="error">É necessário carregar o arquivo da Bíblia primeiro.</span>';
        return;
    }
    
    // Analisar a referência
    const parsedRef = parseReference(reference);
    
    if (!parsedRef) {
        resultElement.innerHTML = instructionsBackup;
        return;
    }
    
    // Encontrar o livro
    const book = bibleData.bible.books.find(b => 
        b.abbreviation.toLowerCase() === parsedRef.book.toLowerCase() || 
        b.name.toLowerCase() == parsedRef.book.toLowerCase()
    );
    
    if (!book) {
        resultElement.innerHTML = `<span class="error">Livro "${parsedRef.book}" não encontrado.</span>`;
        return;
    }
    
    // Verificar se o capítulo existe
    const chapterIndex = parsedRef.chapter - 1;
    if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
        resultElement.innerHTML = `<span class="error">Capítulo ${parsedRef.chapter} não encontrado em ${book.name}.</span>`;
        return;
    }

    // Versículos contínuos
    if (parsedRef.verses === null) {
        parsedRef.verses = [];

        for (let i = 0; i < book.chapters[chapterIndex].length; i++) {
            parsedRef.verses.push(i);
        }
    }
    // Ordenar os versículos para garantir que estejam em ordem crescente
    parsedRef.verses.sort((a, b) => a - b);

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
            if (displayOptions.ellipsis) {
                verseTexts.push('[...]');
            }
        }

        if (verseIndex >= 0 && verseIndex < book.chapters[chapterIndex].length) {
            if (verseIndex == book.chapters[chapterIndex].length - 1) {
                isLastVerse = true;
                // Delete all verses after this one
                parsedRef.verses.splice(indexListVerses + 1);
            } else if (isLastVerse && parsedRef.allAfterLast) {
                isLastVerse = false;
                parsedRef.verses.push(verseIndex + 1);
            }
            const verseText = book.chapters[chapterIndex][verseIndex];
            if (verseText) { // Verifica se o versículo existe e não é vazio
                let formattedVerse = verseText;

                // Adicionar número do versículo como sobrescrito
                if (displayOptions.verseNumbers) {
                    formattedVerse = `<sup>${verseIndex + 1}</sup> ${formattedVerse}`;
                }

                if (displayOptions.quotes) {
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
        }

        previousVerse = verseIndex;

        indexListVerses++;
    }

    resultElement.innerHTML = `<div class="reference">${book.name}</div>`;

    if (displayOptions.parenthesesCitation) {
        verseTexts.push(`<span class="verse-reference">(${reference})</span>`);
    }

    // Conteúdo principal dos versículos
    if (displayOptions.lineBreaks) {
        joinedContent = verseTexts.join('<br>');
    } else {
        joinedContent = verseTexts.join(' ');
    }

    resultElement.innerHTML += `<div class="verse-text">${joinedContent}</div>`;

    copyButton.classList.add('visible');
}
