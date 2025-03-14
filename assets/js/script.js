// Global variables
let bibleData = null;
let instructionsBackup = null;
const BIBLES_PATH = 'assets/data/bibles/';

// Opções de formatação
const displayOptions = {
    quotes: true,
    verseNumbers: false,
    lineBreaks: false,
    ellipsis: true,
    parenthesesCitation: false
};

// Funções para salvar e carregar preferências de tradução e referência
function saveBiblePreference(bibleId) {
    localStorage.setItem('selectedBible', bibleId);
}

function saveReferencePreference(reference) {
    localStorage.setItem('lastReference', reference);
}

function loadUserPreferences() {
    // Carregar tradução salva (terá prioridade menor que parâmetros de URL)
    const savedBible = localStorage.getItem('selectedBible');
    
    // Carregar última referência
    const savedReference = localStorage.getItem('lastReference');
    if (savedReference) {
        document.getElementById('reference').value = savedReference;
    }
    
    return { 
        savedBible: savedBible,
        savedReference: savedReference 
    };
}

function getUrlParameter(name) {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(name);
}

// Função para carregar citação da URL
function loadQuote() {
    const quoteParam = getUrlParameter('quote');
    if (quoteParam) {
        document.getElementById('reference').value = decodeURIComponent(quoteParam);
        return true;
    }
    return false;
}

// Função para verificar dinamicamente as Bíblias disponíveis
async function loadAvailableBibles() {
    try {
        // Obtém o parâmetro 'bible' da URL
        const bibleParam = getUrlParameter('bible');
        
        // Carrega preferências salvas
        const preferences = loadUserPreferences();
        
        // Prioridade: 1º parâmetro da URL, 2º preferência salva
        const defaultBible = bibleParam || preferences.savedBible;
        
        // Tenta carregar o índice de Bíblias disponíveis
        const response = await fetch(`${BIBLES_PATH}index.json`);
        
        if (response.ok) {
            const biblesList = await response.json();
            populateBiblesSelect(biblesList, defaultBible);
        } else {
            console.error('Arquivo index.json não encontrado. Nenhuma Bíblia disponível para carregar.');
            // Mantém o select com apenas a opção padrão
        }
    } catch (error) {
        console.error('Erro ao carregar lista de Bíblias:', error);
    }
}

// Função para preencher o select com as Bíblias disponíveis
function populateBiblesSelect(biblesList, defaultBibleId = null) {
    const selectElement = document.getElementById('bible-select');
    
    // Limpar opções existentes, exceto a primeira (placeholder)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Adicionar as Bíblias disponíveis como opções
    biblesList.forEach(bible => {
        const option = document.createElement('option');
        option.value = bible.id;
        option.textContent = bible.name;
        selectElement.appendChild(option);
    });

    // Adicionar opção "Fazer upload..."
    const uploadOption = document.createElement('option');
    uploadOption.value = "upload";
    uploadOption.textContent = "Fazer upload...";
    selectElement.appendChild(uploadOption);

    // Verificar se a Bíblia especificada na URL ou salva está disponível
    selectElement.selectedIndex = 0;
    if (defaultBibleId) {
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].value.toLowerCase() === defaultBibleId.toLowerCase()) {
                selectElement.selectedIndex = i;
                break;
            }
        }
    }
    
    const changeEvent = new Event('change');
    selectElement.dispatchEvent(changeEvent);
}

// Carregar Bíblias disponíveis quando o documento estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    instructionsBackup = document.getElementById('result').innerHTML;
    loadAvailableBibles();
    loadQuote();
    updateUploadContainerVisibility();
    setupExpandableSections();
    setupControlButtons();

    // Adicionar event listener para o select de bíblias
    document.getElementById('bible-select').addEventListener('change', function() {
        updateUploadContainerVisibility();
        
        // Salvar a tradução escolhida (se não for upload)
        if (this.value && this.value !== "upload") {
            saveBiblePreference(this.value);
        }
    });
    
    // Adicionar event listener para salvar referência quando alterar
    document.getElementById('reference').addEventListener('change', function() {
        saveReferencePreference(this.value);
    });
    
    // Salvar referência também ao pressionar Enter
    document.getElementById('reference').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            saveReferencePreference(document.getElementById('reference').value);
        }
    });
});

// Nova função para mostrar/esconder o container de upload
function updateUploadContainerVisibility() {
    const selectElement = document.getElementById('bible-select');
    const fileInputContainer = document.querySelector('.file-input-container');
    
    if (selectElement.value === "upload") {
        fileInputContainer.style.display = 'block';
    } else {
        fileInputContainer.style.display = 'none';
    }
}

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

// Atualizar os event listeners para usar as novas funções
document.getElementById('bible-select').addEventListener('change', async function() {
    const bibleName = this.value;

    if (!bibleName) {
        return; // Se for a opção vazia ("Selecione uma tradução..."), não faz nada
    }
    
    if (bibleName === "upload") {
        // Se for a opção "Fazer upload...", apenas exibe o container de upload
        return;
    }
    
    await loadBibleFromPredefined(bibleName);
});

// Listener no input de arquivo
document.getElementById('bible-file').addEventListener('change', async function() {
    await loadBibleFromFile(this.files[0]);
});

function populateBooksSidebar(books) {
    const bookList = document.getElementById('book-list');

    // Limpar lista atual
    bookList.innerHTML = '';

    // Adicionar cada livro à lista
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.className = 'book-item';
        bookElement.textContent = book.abbreviation || book.name.substring(0, 3);
        bookElement.title = book.name;
        
        // Adicionar evento de clique para preencher automaticamente o campo de busca apenas com a abreviação
        bookElement.addEventListener('click', function() {
            document.getElementById('reference').value = `${book.abbreviation || book.name.substring(0, 3)}`;
            document.getElementById('reference').focus();
        });
        
        bookList.appendChild(bookElement);
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
    
    allAfterFirst = false;
    for (const segment of verseSegments) {
        // Verificar se é um intervalo (ex: 5-7) ou um único versículo
        if (segment.includes('-')) {
            [start, end] = segment.split('-').map(v => parseInt(v.trim()));
            if (isNaN(end)) {
                allAfterFirst = true;
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
    }
    
    return {
        book: bookName,
        chapter: parseInt(chapter),
        verses: verses,
        allAfterFirst: allAfterFirst
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

    firstVerse = 0;
    if (parsedRef.allAfterFirst == true) {
        firstVerse = parsedRef.verses[0];
        parsedRef.verses = [];
    }
    // Versículos contínuos
    if ((parsedRef.verses === null) || (parsedRef.allAfterFirst == true)) {
        parsedRef.verses = [];

        for (let i = firstVerse; i < book.chapters[chapterIndex].length; i++) {
            parsedRef.verses.push(i);
        }
    }
    // Ordenar os versículos para garantir que estejam em ordem crescente
    parsedRef.verses.sort((a, b) => a - b);
    
    const verseTexts = [];
    let previousVerse = -1;

    for (let i = 0; i < parsedRef.verses.length; i++) {
        isLastVerse = (i == parsedRef.verses.length - 1);
        isFirstVerse = (i == 0);
        const verseIndex = parsedRef.verses[i];

        // Se não for o primeiro versículo e houver lacuna entre os versículos, adicione o marcador de omissão
        if (previousVerse >= 0 && verseIndex > previousVerse + 1) {
            if (displayOptions.ellipsis) {
                verseTexts.push('[...]');
            }
        }

        if (verseIndex >= 0 && verseIndex < book.chapters[chapterIndex].length) {
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
                    formattedVerse = formattedVerse.replaceAll('“', "'");
                    formattedVerse = formattedVerse.replaceAll('”', "'");
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

// Função de debounce para limitar a frequência de chamadas
function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Versão com debounce da função searchVerse
const debouncedSearchVerse = debounce(() => {
    searchVerse();
});

// Adicionar evento de tecla Enter no campo de entrada
document.getElementById('reference').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        searchVerse();
    }
});

// Novo: Adicionar evento de input para busca automática enquanto digita
document.getElementById('reference').addEventListener('input', debouncedSearchVerse);

// Função para copiar o texto bíblico para o clipboard
document.getElementById('copy-button').addEventListener('click', function() {
    const copyButton = document.getElementById('copy-button');
    
    // Obter o texto bíblico
    const verseTextElement = document.querySelector('.verse-text');
    
    if (verseTextElement) {
        let textToCopy = verseTextElement.innerHTML
            .replace(/<br>/g, '\n')
            .replace(/<[^>]+>/g, ''); // Remove HTML tags
        
        // Tentar copiar usando diferentes métodos
        copyTextToClipboard(textToCopy)
            .then(() => {
                // Feedback visual de sucesso
                copyButton.textContent = 'Copiado!';
                copyButton.classList.add('success');
                
                // Restaurar o botão após 2 segundos
                setTimeout(() => {
                    copyButton.textContent = 'Copiar';
                    copyButton.classList.remove('success');
                }, 2000);
            })
            .catch(err => {
                console.error('Erro ao copiar texto:', err);
                copyButton.textContent = 'Erro!';
                copyButton.classList.add('error');
                
                setTimeout(() => {
                    copyButton.textContent = 'Copiar';
                    copyButton.classList.remove('error');
                }, 2000);
            });
    }
});

function copyTextToClipboard(text) {
    // Método 1: Clipboard API (mais moderno)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    
    // Método 2: Elemento temporário + execCommand (funciona melhor em dispositivos móveis)
    return new Promise((resolve, reject) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // Tornar o textarea invisível mas presente no DOM
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            textArea.style.left = '-999999px';
            textArea.style.top = '0';
            document.body.appendChild(textArea);
            
            // Selecionar e copiar no contexto do evento de clique do usuário
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                resolve();
            } else {
                reject(new Error('Falha ao copiar texto com execCommand'));
            }
        } catch (err) {
            reject(err);
        }
    });
}

// Função para configurar as seções expansíveis
function setupExpandableSections() {
    const expandableSections = document.querySelectorAll('.expandable-section');
    
    expandableSections.forEach(section => {
        const header = section.querySelector('.expandable-header');
        const content = section.querySelector('.expandable-content');
        
        if (header && content) {
            // Iniciar com a seção colapsada
            content.classList.remove('expanded');
            section.classList.remove('expanded');
            
            // Adicionar evento de clique
            header.addEventListener('click', function() {
                content.classList.toggle('expanded');
                section.classList.toggle('expanded');
            });
        }
    });
}

// Função para configurar os botões de controle
function setupControlButtons() {
    // Carregar as preferências salvas, se existirem
    loadDisplayPreferences();
    
    // Configurar cada botão de controle
    const controlButtons = document.querySelectorAll('.control-button');
    
    controlButtons.forEach(button => {
        // Aplicar o estado inicial (ativo/inativo) com base nas preferências
        const optionName = button.id.replace('display-', '');
        const optionKey = convertIdToOptionKey(optionName);
        
        if (displayOptions[optionKey]) {
            button.classList.add('active');
        }
        
        // Adicionar evento de clique
        button.addEventListener('click', function() {
            // Alternar estado do botão
            this.classList.toggle('active');
            
            // Atualizar as opções de exibição
            const optionName = this.id.replace('display-', '');
            const optionKey = convertIdToOptionKey(optionName);
            displayOptions[optionKey] = this.classList.contains('active');
            
            // Salvar preferências
            saveDisplayPreferences();
            
            // Atualizar o texto exibido
            searchVerse();
        });
    });
}

// Funções auxiliares para conversão de IDs para chaves de opções
function convertIdToOptionKey(id) {
    // Mapeamento de IDs para chaves de opções
    const map = {
        'quotes': 'quotes',
        'verse-numbers': 'verseNumbers',
        'line-breaks': 'lineBreaks',
        'ellipsis': 'ellipsis',
        'parentheses-citation': 'parenthesesCitation'
    };
    return map[id] || id;
}

// Salvar preferências no localStorage
function saveDisplayPreferences() {
    localStorage.setItem('bibleDisplayOptions', JSON.stringify(displayOptions));
}

// Carregar preferências do localStorage
function loadDisplayPreferences() {
    const savedOptions = localStorage.getItem('bibleDisplayOptions');
    if (savedOptions) {
        const parsedOptions = JSON.parse(savedOptions);
        Object.assign(displayOptions, parsedOptions);
    }
}
