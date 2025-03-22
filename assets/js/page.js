// Global variables
let instructionsBackup = null;
let currentTranslationName = '';
let fileCache = '';

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
        
        // Obter a lista de bíblias disponíveis usando a função do bible.js
        const biblesList = await getAvailableBibles();
        
        if (biblesList && biblesList.length > 0) {
            populateBiblesSelect(biblesList, defaultBible);
            searchVerse();

            // Carregar a Bíblia padrão e executar a busca se existir uma Bíblia selecionada
            if (defaultBible) {
                await loadBibleFromPredefined(defaultBible);
                updateCurrentTranslationName(defaultBible, biblesList);
                // Executar a busca após carregar a Bíblia
                searchVerse();
            }
        } else {
            console.error('Nenhuma Bíblia disponível para carregar.');
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

// Função para atualizar o nome da tradução atual
function updateCurrentTranslationName(bibleId, biblesList) {
    if (!bibleId || bibleId === "upload") {
        currentTranslationName = '';
        return;
    }
    
    const selectedBible = biblesList.find(bible => bible.id === bibleId);
    currentTranslationName = selectedBible ? selectedBible.name : '';
}

// Função para lidar com o upload de arquivo
async function handleFileUpload(file) {
    if (!file) {
        return false;
    }
    
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        return false;
    }
    
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = function(event) {
            fileCache = event.target.result;
            searchVerse();
        };
        
        fileReader.onerror = function() {
            resolve(false);
        };
        
        fileReader.readAsText(file);
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    instructionsBackup = document.getElementById('result').innerHTML;
    loadAvailableBibles();
    loadQuote();
    updateUploadContainerVisibility();
    setupExpandableSections();
    setupControlButtons();

    // Adicionar event listener para o select de bíblias
    document.getElementById('bible-select').addEventListener('change', async function() {
        updateUploadContainerVisibility();
        
        // Salvar a tradução escolhida (se não for upload)
        if (this.value && this.value !== "upload") {
            saveBiblePreference(this.value);
            const biblesList = await getAvailableBibles();
            updateCurrentTranslationName(this.value, biblesList);
        }

        if (this.value && this.value !== "upload") {
            await loadBibleFromPredefined(this.value);
            searchVerse();
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
            searchVerse();
        }
    });

    // Listener no input de arquivo
    document.getElementById('bible-file').addEventListener('change', async function() {
        await handleFileUpload(this.files[0]);
        searchVerse();
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
});

async function searchVerse() {
    const reference = document.getElementById('reference').value.trim();
    const resultElement = document.getElementById('result');
    const copyButton = document.getElementById('copy-button');
    const translationSelect = document.getElementById('bible-select');
    const selectedBibleId = translationSelect.value;

    // Salvar a referência atual ao pesquisar
    saveReferencePreference(reference);

    if (selectedBibleId && selectedBibleId !== "upload") {
        result = generateResultFromExistent(reference, instructionsBackup, displayOptions, currentTranslationName);
    } else {
        result = generateResultFromUpload(reference, instructionsBackup, displayOptions, fileCache);
    }

    if (result.error) {
        copyButton.classList.remove('visible');
    } else {
        copyButton.classList.add('visible');
    }
    resultElement.innerHTML = result.html;
}
