// Control variables
let instructionsBackup = null;
let currentTranslationName = '';
let fileCache = '';
const MAX_HISTORY_SIZE = 10;

const displayOptions = {
    quotes: true,
    verseNumbers: false,
    lineBreaks: false,
    ellipsis: true,
    parenthesesCitation: false
};

function saveBiblePreference(bibleId) {
    localStorage.setItem('selectedBible', bibleId);
}

function saveReferencePreference(reference) {
    localStorage.setItem('lastReference', reference);
}

function loadUserPreferences() {
    const savedBible = localStorage.getItem('selectedBible');
    
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

function loadQuote() {
    const quoteParam = getUrlParameter('quote');
    if (quoteParam) {
        document.getElementById('reference').value = decodeURIComponent(quoteParam);
        return true;
    }
    return false;
}

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

function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

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

    document.getElementById('history-button').classList.remove('active');
}

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

function saveDisplayPreferences() {
    localStorage.setItem('bibleDisplayOptions', JSON.stringify(displayOptions));
}

function loadDisplayPreferences() {
    const savedOptions = localStorage.getItem('bibleDisplayOptions');
    if (savedOptions) {
        const parsedOptions = JSON.parse(savedOptions);
        Object.assign(displayOptions, parsedOptions);
    }
}

function updateCurrentTranslationName(bibleId, biblesList) {
    if (!bibleId || bibleId === "upload") {
        currentTranslationName = '';
        return;
    }
    
    const selectedBible = biblesList.find(bible => bible.id === bibleId);
    currentTranslationName = selectedBible ? selectedBible.name : '';
}

async function handleFileUpload(file) {
    if (!file) {
        return false;
    }
    
    // Check if file is JSON or XML
    const isJson = file.type === 'application/json' || file.name.endsWith('.json');
    const isXml = file.type === 'application/xml' || file.name.endsWith('.xml') || file.name.endsWith('.osis');
    
    if (!isJson && !isXml) {
        return false;
    }
    
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(event) {
            const content = event.target.result;
            
            if (isXml) {
                try {
                    // Convert XML to JSON using convertOsisToJson
                    const jsonData = await window.BibleUtils.convertOsisToJson(content);
                    fileCache = JSON.stringify(jsonData);
                } catch (error) {
                    console.error('Error converting XML to JSON:', error);
                    resolve(false);
                    return;
                }
            } else {
                // JSON files stored directly
                fileCache = content;
            }
            
            searchVerse();
            resolve(true);
        };
        
        fileReader.onerror = function() {
            resolve(false);
        };
        
        fileReader.readAsText(file);
    });
}

function saveSearchToHistory(reference) {
    if (!reference.trim()) return;
    
    // Get existing history
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    
    // Remove this item if it exists already (to avoid duplicates)
    searchHistory = searchHistory.filter(item => item !== reference);
    
    // Check if this reference is the start of any existing item in history
    const isStartOfExisting = searchHistory.some(item => 
        item.toLowerCase().startsWith(reference.toLowerCase()) && item.length > reference.length
    );
    
    // Remove any history items that are the start of this reference
    searchHistory = searchHistory.filter(item => 
        !(reference.toLowerCase().startsWith(item.toLowerCase()) && item.length < reference.length)
    );
    
    // Only add if it's not a prefix of an existing item
    if (!isStartOfExisting) {
        // Add the new search at the beginning
        searchHistory.unshift(reference);
        
        // Limit history size
        if (searchHistory.length > MAX_HISTORY_SIZE) {
            searchHistory = searchHistory.slice(0, MAX_HISTORY_SIZE);
        }
    }
    
    // Save back to localStorage
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

function loadSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

function showHistoryModal() {
    document.getElementById('history-button').classList.add('active');
    
    // Criar modal se não existir
    let modal = document.getElementById('history-modal');
    let overlay = document.getElementById('modal-overlay');
    
    if (!modal) {
        // Criar overlay
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
        
        // Criar modal
        modal = document.createElement('div');
        modal.id = 'history-modal';
        modal.className = 'history-modal';
        modal.innerHTML = `
            <div class="history-modal-header">
                <h3 class="history-modal-title">Histórico de buscas</h3>
                <button class="close-modal">&times;</button>
            </div>
            <ul class="history-list"></ul>
        `;
        document.body.appendChild(modal);
        
        // Adicionar evento ao botão fechar
        modal.querySelector('.close-modal').addEventListener('click', hideHistoryModal);
        
        // Fechar ao clicar no overlay
        overlay.addEventListener('click', hideHistoryModal);
    }
    
    // Preencher histórico
    const historyList = modal.querySelector('.history-list');
    historyList.innerHTML = '';
    
    const history = loadSearchHistory();
    
    if (history.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'history-list-item';
        emptyItem.textContent = 'Nenhuma busca recente';
        historyList.appendChild(emptyItem);
    } else {
        history.forEach(item => {
            const listItem = document.createElement('li');
            listItem.className = 'history-list-item';
            listItem.textContent = item;
            listItem.addEventListener('click', function() {
                document.getElementById('reference').value = item;
                hideHistoryModal();
                searchVerse();
            });
            historyList.appendChild(listItem);
        });
    }
    
    // Mostrar modal e overlay
    modal.classList.add('show');
    overlay.classList.add('show');
}

function hideHistoryModal() {
    const modal = document.getElementById('history-modal');
    const overlay = document.getElementById('modal-overlay');
    
    // Remover classe ativa do botão de histórico
    document.getElementById('history-button').classList.remove('active');
    
    if (modal) modal.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

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

        // Process last file
        if (this.value === "upload") {
            handleFileUpload(document.getElementById('bible-file').files[0]);
        }
        // Salvar a tradução escolhida (se não for upload)
        else if (this.value) {
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

    // Add click event to history button
    document.getElementById('history-button').addEventListener('click', function(event) {
        event.preventDefault();
        showHistoryModal();
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
        if (reference) {
            saveSearchToHistory(reference);
        }
    }
    resultElement.innerHTML = result.html;
}
