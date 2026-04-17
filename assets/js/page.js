// Constants
const MAX_HISTORY_SIZE = 10;

// Theme constants
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const THEME_AUTO = 'auto';
const THEME_ICONS = {
    [THEME_LIGHT]: '☀️',
    [THEME_DARK]: '🌙',
    [THEME_AUTO]: '🌓'
};
const THEME_TITLES = {
    [THEME_LIGHT]: 'Tema: Claro',
    [THEME_DARK]: 'Tema: Escuro',
    [THEME_AUTO]: 'Tema: Automático'
};

// Control variables
let instructionsBackup = null;
let ebfData = null;
let currentTheme = THEME_AUTO;
const modalList = [
    'history-modal',
    'reference-help-modal',
    'file-help-modal',
    'text-search-modal',
];

const displayOptions = {
    quotes: false,
    verseNumbers: true,
    lineBreaks: true,
    ellipsis: true,
    parenthesesCitation: true,
    sectionTitles: true
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

// Theme functions
function saveThemePreference(theme) {
    localStorage.setItem('selectedTheme', theme);
}

function loadThemePreference() {
    return localStorage.getItem('selectedTheme') || THEME_AUTO;
}

function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return THEME_DARK;
    }
    return THEME_LIGHT;
}

function applyTheme(theme) {
    currentTheme = theme;
    let effectiveTheme = theme;
    
    if (theme === THEME_AUTO) {
        effectiveTheme = getSystemTheme();
    }
    
    if (effectiveTheme === THEME_DARK) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Update button icon and title
    const themeIcon = document.getElementById('theme-icon');
    const themeButton = document.getElementById('theme-button');
    
    if (themeIcon) {
        themeIcon.textContent = THEME_ICONS[theme];
    }
    if (themeButton) {
        themeButton.title = THEME_TITLES[theme];
    }
}

function cycleTheme() {
    const themeOrder = [THEME_AUTO, THEME_LIGHT, THEME_DARK];
    const currentIndex = themeOrder.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    const nextTheme = themeOrder[nextIndex];
    
    saveThemePreference(nextTheme);
    applyTheme(nextTheme);
}

function initializeTheme() {
    const savedTheme = loadThemePreference();
    applyTheme(savedTheme);
    
    // Listen for system theme changes when in auto mode
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
            if (currentTheme === THEME_AUTO) {
                applyTheme(THEME_AUTO);
            }
        });
    }
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
        
        // Obter a lista de bíblias disponíveis usando a função do bible.js
        const biblesList = await getAvailableBibles();
        
        if (biblesList && biblesList.length > 0) {
            // Prioridade: 1º parâmetro da URL, 2º preferência salva, 3º bíblia padrão do índice
            let defaultBible = bibleParam || preferences.savedBible;
            
            // Se não há preferência externa, usar a bíblia marcada como default no índice
            if (!defaultBible) {
                const defaultBibleEntry = biblesList.find(bible => bible.default === true);
                if (defaultBibleEntry) {
                    defaultBible = defaultBibleEntry.name;
                }
            }
            
            populateBiblesSelect(biblesList, defaultBible);
        } else {
            console.error('Nenhuma Bíblia disponível para carregar.');
        }
    } catch (error) {
        console.error('Erro ao carregar lista de Bíblias:', error);
    }
}

// Mapeamento de tipos para nomes de exibição
const BIBLE_TYPE_LABELS = {
    'catholic': 'Católicas',
    'protestant': 'Evangélicas',
    'other': 'Outras'
};

// Ordem de exibição dos tipos
const BIBLE_TYPE_ORDER = ['catholic', 'protestant', 'other'];

function populateBiblesSelect(biblesList, defaultBibleId = null) {
    const selectElement = document.getElementById('bible-select');
    
    // Limpar opções existentes, exceto a primeira (placeholder)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Remover optgroups existentes
    const existingOptgroups = selectElement.querySelectorAll('optgroup');
    existingOptgroups.forEach(og => og.remove());
    
    // Agrupar bíblias por tipo
    const biblesByType = {};
    biblesList.forEach(bible => {
        const type = bible.type || 'other';
        if (!biblesByType[type]) {
            biblesByType[type] = [];
        }
        biblesByType[type].push(bible);
    });
    
    // Adicionar as Bíblias organizadas por tipo
    BIBLE_TYPE_ORDER.forEach(type => {
        if (biblesByType[type] && biblesByType[type].length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = BIBLE_TYPE_LABELS[type] || type;
            
            biblesByType[type].forEach(bible => {
                const option = document.createElement('option');
                option.value = bible.name;
                option.textContent = bible.name;
                option.dataset.path = bible.path;
                optgroup.appendChild(option);
            });
            
            selectElement.appendChild(optgroup);
        }
    });

    // Adicionar opção "Fazer upload..." (fora dos grupos)
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
        bookElement.title = book.names[0];
        
        bookElement.addEventListener('click', function() {
            document.getElementById('reference').value = `${book.abbreviation || book.name.substring(0, 3)} 1`;
            document.getElementById('reference').focus();
            searchVerse();
        });
        
        bookList.appendChild(bookElement);
    });

    // Update the expandable section header with book count
    const bookSectionHeader = document.querySelector('.book-section .expandable-header');
    if (bookSectionHeader) {
        bookSectionHeader.innerHTML = `Livros (${books.length})<span class="expand-icon">▼</span>`;
    }
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
    
    // Configurar cada botão de formatação
    const formatButtons = document.querySelectorAll('.format-button');
    
    formatButtons.forEach(button => {
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

    // Configuração dos botões de ação
    setupActionButtons();
}

function setupActionButtons() {
    // Adicionar comportamento padrão para os botões de ação
    const actionButtons = document.querySelectorAll('.action-button');
    
    actionButtons.forEach(button => {
        // Limpar qualquer evento anterior
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Para cada botão de ação, adicionar o comportamento visual padrão
        newButton.addEventListener('click', function() {
            const button = this;
            
            // Verificar qual ação executar baseado no ID do botão
            if (button.id === 'copy-button') {
                handleCopyButtonClick();
            } 
            else if (button.id === 'share-button') {
                shareCurrentReference();
            }
            else if (button.id === 'prev-chapter-button') {
                navigateToPreviousChapter();
            }
            else if (button.id === 'next-chapter-button') {
                navigateToNextChapter();
            }
            else if (button.id === 'download-ebf-button') {
                downloadEbfFile();
            }
            else if (button.id === 'text-search-button') {
                showTextSearchModal();
            }
            else if (button.id === 'history-button') {
                showHistoryModal();
            }
            else if (button.id === 'reference-help-button') {
                showReferenceHelpModal();
            }
            else if (button.id === 'file-help-button') {
                showFileHelpModal();
            }

            // Feedback visual comum para todos os botões de ação
            button.classList.add('success');
            setTimeout(() => {
                button.classList.remove('success');
            }, 1000);
        });
    });
}

function showTemporaryMessage(message) {
    // Remover qualquer mensagem existente
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar o elemento de mensagem
    const messageElement = document.createElement('div');
    messageElement.className = 'temporary-message';
    messageElement.textContent = message;
    
    // Adicionar à página
    document.body.appendChild(messageElement);
    
    // Mostrar com animação
    setTimeout(() => {
        messageElement.classList.add('show');
    }, 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        messageElement.classList.remove('show');
        setTimeout(() => {
            messageElement.remove();
        }, 500); // Esperar a animação de fade-out
    }, 3000);
}

function handleCopyButtonClick() {
    const verseTextElement = document.querySelector('.verse-text');
    
    if (verseTextElement) {
        let textToCopy = verseTextElement.innerHTML
            .replace(/<br>/g, '\n')
            .replace(/<\/span>/g, '\n')
            .replace(/<[^>]+>/g, ''); // Remove HTML tags
        
        // Tentar copiar usando diferentes métodos
        copyTextToClipboard(textToCopy)
            .then(() => {
                // Exibir mensagem de sucesso
                showTemporaryMessage('Texto copiado');
            })
            .catch(err => {
                console.error('Erro ao copiar texto:', err);
                showTemporaryMessage('Erro ao copiar texto');
            });
    }
}

function convertIdToOptionKey(id) {
    // Mapeamento de IDs para chaves de opções
    const map = {
        'quotes': 'quotes',
        'verse-numbers': 'verseNumbers',
        'line-breaks': 'lineBreaks',
        'ellipsis': 'ellipsis',
        'parentheses-citation': 'parenthesesCitation',
        'section-titles': 'sectionTitles'
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
    
    return new Promise((resolve) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(event) {
            const content = event.target.result;
            
            if (isXml) {
                try {
                    ebfData = await window.XmlBibles.convertXmlToEbf(content);
                    enableDownloadButton(file.name);
                } catch (error) {
                    console.error('Error converting XML to JSON:', error);
                    disableDownloadButton();
                    resolve(false);
                    return;
                }
            } else {
                // JSON files stored directly
                try {
                    ebfData = JSON.parse(content);
                    enableDownloadButton(file.name);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    disableDownloadButton();
                }
            }

            // Atualizar a lista de livros na sidebar
            if (ebfData && ebfData.bible && ebfData.bible.books) {
                populateBooksSidebar(ebfData.bible.books);
            }
            
            searchVerse();
            resolve(true);
        };
        
        fileReader.onerror = function() {
            disableDownloadButton();
            resolve(false);
        };
        
        fileReader.readAsText(file);
    });
}

// Função para habilitar o botão de download
function enableDownloadButton(fileName) {
    const downloadButton = document.getElementById('download-ebf-button');
    downloadButton.disabled = false;
    downloadButton.dataset.filename = fileName;
}

// Função para desabilitar o botão de download
function disableDownloadButton() {
    const downloadButton = document.getElementById('download-ebf-button');
    downloadButton.disabled = true;
    delete downloadButton.dataset.filename;
}

// Função para gerar o download do arquivo EBF
function downloadEbfFile() {
    if (!ebfData) return;
    
    const downloadButton = document.getElementById('download-ebf-button');
    const fileName = downloadButton.dataset.filename;

    // Gerar novo nome de arquivo com extensão .ebf1.json
    let newFileName;
    const lastDotIndex = fileName.lastIndexOf('.');
    
    if (lastDotIndex !== -1) {
        // Se tem extensão, substitui
        newFileName = fileName.substring(0, lastDotIndex) + '.ebf1.json';
    } else {
        // Se não tem extensão, apenas adiciona
        newFileName = fileName + '.ebf1.json';
    }
    
    // Criar pretty print do JSON com indentação de 4 espaços
    const prettyJson = JSON.stringify(ebfData, null, 4);
    
    // Criar blob e link de download
    const blob = new Blob([prettyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    
    // Limpar recursos
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
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

// Modal utility functions
function createModal(options) {
    // options: { id, title, content, className }
    let modal = document.getElementById(options.id);
    let overlay = document.getElementById('modal-overlay');
    
    if (!modal) {
        // Create overlay if needed
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);
        }
        
        // Create modal
        modal = document.createElement('div');
        modal.id = options.id;
        modal.className = 'app-modal';
        if (options.className) {
            modal.classList.add(options.className);
        }

        modal.innerHTML = `
            <div class="app-modal-header">
                <h3 class="app-modal-title">${options.title}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="help-content">
                ${options.content}
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close button event
        modal.querySelector('.close-modal').addEventListener('click', () => {
            hideModal(options.id);
        });
        
        // Close when clicking overlay
        overlay.addEventListener('click', () => {
            // Find all open modals and close them with their associated buttons
            document.querySelectorAll('.app-modal.show').forEach(openModal => {
                hideModal(openModal.id);
            });
        });
    }
    
    return modal;
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
        // Show modal and overlay
        modal.classList.add('show');
        overlay.classList.add('show');
        // Enable pointer events
        overlay.style.pointerEvents = 'auto';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal) modal.classList.remove('show');
    if (overlay) {
        overlay.classList.remove('show');
        // Disable pointer events
        overlay.style.pointerEvents = 'none';
    }
}

function showHistoryModal() {
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('history-modal');
    if (!modal) {
        modal = createModal({
            id: 'history-modal',
            title: 'Histórico de buscas',
            content: '<ul class="history-list"></ul>'
        });
    }
    
    // Update history list
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
                hideModal('history-modal');
                searchVerse();
            });
            historyList.appendChild(listItem);
        });
    }
    
    showModal('history-modal');
}

function showReferenceHelpModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('reference-help-modal');
    if (!modal) {
        modal = createModal({
            id: 'reference-help-modal',
            title: 'Referência bíblica',
            content: instructionsBackup
        });
    }
    
    showModal('reference-help-modal');
}

function showFileHelpModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('file-help-modal');
    if (!modal) {
        modal = createModal({
            id: 'file-help-modal',
            title: 'Upload de arquivos',
            content: `
                <strong>Formatos suportados:</strong>
                <ul>
                    <li>
                        <strong>EBF/JSON</strong><br>
                        <a href="https://github.com/natanael127/easy-bible-format" target="_blank" rel="noopener noreferrer">Easy Bible Format</a>
                    </li>
                    <li>
                        <strong>OSIS/XML</strong><br>
                        <a href="https://crosswire.org/osis/" target="_blank" rel="noopener noreferrer">Open Scripture Information Standard</a>
                    </li>
                    <li>
                        <strong>USFX/XML</strong><br>
                        <a href="https://ebible.org/usfx/" target="_blank" rel="noopener noreferrer">Unified Scripture Format XML</a>
                    </li>
                </ul>
                <strong>Repositórios de Bíblias:</strong>
                <ul>
                    <li>
                        <a href="https://ebible.org/find/" target="_blank" rel="noopener noreferrer">eBible</a>
                    </li>
                    <li>
                        <a href="https://github.com/natanael127/ebf-converted-bibles" target="_blank" rel="noopener noreferrer">Bíblias convertidas para EBF</a>
                    </li>
                    <li>
                        <a href="https://github.com/gratis-bible/bible" target="_blank" rel="noopener noreferrer">Bíblias no formato OSIS</a>
                    </li>
                </ul>
            `
        });
    }

    showModal('file-help-modal');
}

// Text search modal
let textSearchSelectedIndex = -1;

function showTextSearchModal() {
    let modal = document.getElementById('text-search-modal');
    if (!modal) {
        modal = createModal({
            id: 'text-search-modal',
            title: 'Busca textual',
            className: 'text-search-modal',
            content: ''
        });

        // Replace help-content with custom layout
        const helpContent = modal.querySelector('.help-content');
        helpContent.innerHTML = '';
        helpContent.style.padding = '0';
        helpContent.style.maxHeight = 'none';

        const inputRow = document.createElement('div');
        inputRow.className = 'text-search-input-row';
        inputRow.innerHTML = '<input type="text" class="text-search-input" placeholder="Digite pelo menos 3 caracteres...">';
        helpContent.appendChild(inputRow);

        const countEl = document.createElement('div');
        countEl.className = 'text-search-count';
        helpContent.appendChild(countEl);

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'text-search-results';
        helpContent.appendChild(resultsContainer);

        const searchInput = modal.querySelector('.text-search-input');

        const debouncedTextSearch = debounce(() => {
            performTextSearch(searchInput.value.trim());
        }, 300);

        searchInput.addEventListener('input', debouncedTextSearch);

        searchInput.addEventListener('keydown', function(event) {
            const items = modal.querySelectorAll('.text-search-result-item');
            if (items.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                textSearchSelectedIndex = Math.min(textSearchSelectedIndex + 1, items.length - 1);
                updateTextSearchSelection(items);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                textSearchSelectedIndex = Math.max(textSearchSelectedIndex - 1, 0);
                updateTextSearchSelection(items);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (textSearchSelectedIndex >= 0 && textSearchSelectedIndex < items.length) {
                    items[textSearchSelectedIndex].click();
                }
            }
        });
    }

    // Reset state
    const searchInput = modal.querySelector('.text-search-input');
    searchInput.value = '';
    modal.querySelector('.text-search-results').innerHTML = '';
    modal.querySelector('.text-search-count').textContent = '';
    textSearchSelectedIndex = -1;

    showModal('text-search-modal');
    setTimeout(() => searchInput.focus(), 50);
}

function updateTextSearchSelection(items) {
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === textSearchSelectedIndex);
    });
    if (textSearchSelectedIndex >= 0 && items[textSearchSelectedIndex]) {
        items[textSearchSelectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function performTextSearch(query) {
    const modal = document.getElementById('text-search-modal');
    const resultsContainer = modal.querySelector('.text-search-results');
    const countEl = modal.querySelector('.text-search-count');
    textSearchSelectedIndex = -1;

    if (!ebfData) {
        resultsContainer.innerHTML = '<div class="text-search-no-results">Nenhuma Bíblia carregada</div>';
        countEl.textContent = '';
        return;
    }

    if (query.length < 3) {
        resultsContainer.innerHTML = '';
        countEl.textContent = '';
        return;
    }

    const MAX_RESULTS = 200;
    const results = [];
    const queryLower = query.toLowerCase();

    for (const book of ebfData.bible.books) {
        for (let ci = 0; ci < book.chapters.length; ci++) {
            const chapter = book.chapters[ci];
            for (let vi = 0; vi < chapter.verses.length; vi++) {
                const verse = chapter.verses[vi];
                if (verse.text && verse.text.toLowerCase().includes(queryLower)) {
                    results.push({
                        bookAbbr: book.abbreviation || book.names[0].substring(0, 3),
                        bookName: book.names[0],
                        chapter: ci + 1,
                        verse: vi + 1,
                        text: verse.text
                    });
                    if (results.length >= MAX_RESULTS) break;
                }
            }
            if (results.length >= MAX_RESULTS) break;
        }
        if (results.length >= MAX_RESULTS) break;
    }

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="text-search-no-results">Nenhum versículo encontrado</div>';
        countEl.textContent = '';
        return;
    }

    countEl.textContent = results.length >= MAX_RESULTS
        ? `Primeiros ${MAX_RESULTS} resultados`
        : `${results.length} resultado${results.length > 1 ? 's' : ''}`;

    resultsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'text-search-result-item';

        const textEl = document.createElement('div');
        textEl.className = 'text-search-result-text';
        textEl.innerHTML = highlightQuery(BibleUtils.escapeHtml(r.text), query);

        const citation = `${r.bookAbbr} ${r.chapter},${r.verse}`;
        const citeEl = document.createElement('div');
        citeEl.className = 'text-search-result-citation';
        citeEl.textContent = `${r.bookName} ${r.chapter},${r.verse}`;

        item.appendChild(textEl);
        item.appendChild(citeEl);

        item.addEventListener('click', function() {
            document.getElementById('reference').value = citation;
            hideModal('text-search-modal');
            searchVerse();
        });

        fragment.appendChild(item);
    });

    resultsContainer.appendChild(fragment);
}

function highlightQuery(escapedText, query) {
    const escapedQuery = BibleUtils.escapeHtml(query);
    // Case-insensitive replace, preserving original case in the output
    const regex = new RegExp('(' + escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
}

function closeActiveModal() {
    let output = false;
    for (let modalId in modalList) {
        const modal = document.getElementById(modalList[modalId]);
        if (modal && modal.classList.contains('show')) {
            hideModal(modalList[modalId]);
            output = true;
        }
    }

    return output;
}

function navigateToPreviousChapter() {
    const reference = document.getElementById('reference').value.trim();

    const parsedRef = window.BibleUtils.parseReference(reference);

    if (parsedRef && parsedRef.chapter && parsedRef.chapter > 1) {
        // Navigate to previous chapter (whole chapter)
        const newReference = `${parsedRef.book} ${parsedRef.chapter - 1}`;
        document.getElementById('reference').value = newReference;
        saveReferencePreference(newReference);
        searchVerse();
    }
}

function navigateToNextChapter() {
    const reference = document.getElementById('reference').value.trim();

    const parsedRef = window.BibleUtils.parseReference(reference);
    if (parsedRef && parsedRef.chapter && parsedRef.chapter < getNumOfChapters(parsedRef.book, ebfData)) {
        // Navigate to next chapter (whole chapter)
        const newReference = `${parsedRef.book} ${parsedRef.chapter + 1}`;
        document.getElementById('reference').value = newReference;
        saveReferencePreference(newReference);
        searchVerse();
    }
}

function shareCurrentReference() {
    const reference = document.getElementById('reference').value.trim();
    if (!reference) return;
    
    const selectElement = document.getElementById('bible-select');
    const selectedBibleId = selectElement.value;
    
    // Don't share if using an uploaded Bible
    if (selectedBibleId === "upload") {
        alert("Não é possível compartilhar referências de Bíblias carregadas manualmente.");
        return;
    }
    
    // Create the share URL
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?bible=${encodeURIComponent(selectedBibleId)}&quote=${encodeURIComponent(reference)}`;
    
    // Copy to clipboard
    copyTextToClipboard(shareUrl)
        .then(() => {
            // Exibir mensagem de sucesso
            showTemporaryMessage('Link copiado');
        })
        .catch(err => {
            console.error('Erro ao copiar link:', err);
            showTemporaryMessage('Erro ao copiar link');
        });
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme first to avoid flash of wrong theme
    initializeTheme();

    instructionsBackup = document.getElementById('result').innerHTML;
    loadAvailableBibles();
    loadQuote();
    updateUploadContainerVisibility();
    setupExpandableSections();
    setupControlButtons();

    // Theme button event listener
    document.getElementById('theme-button').addEventListener('click', cycleTheme);
    
    // Add global event listener for Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeActiveModal();
        }
    });
    
    // Monitorar scroll para mostrar/esconder botões flutuantes
    window.addEventListener('scroll', checkNavigationButtonsVisibility);
    window.addEventListener('resize', checkNavigationButtonsVisibility);

    // Configurar listeners para botões flutuantes
    document.getElementById('floating-prev-chapter-button').addEventListener('click', navigateToPreviousChapter);
    document.getElementById('floating-next-chapter-button').addEventListener('click', navigateToNextChapter);
    document.getElementById('floating-copy-button').addEventListener('click', handleCopyButtonClick);
    document.getElementById('floating-share-button').addEventListener('click', shareCurrentReference);

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
        }

        if (this.value && this.value !== "upload") {
            const selectedOption = this.options[this.selectedIndex];
            const biblePath = selectedOption.dataset.path;
            ebfData = await loadBibleFromPath(biblePath);
            populateBooksSidebar(ebfData.bible.books);
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

    document.getElementById('reference').addEventListener('input', debouncedSearchVerse);
});

// Função para verificar visibilidade dos botões de navegação
function checkNavigationButtonsVisibility() {
    const staticButtons = document.getElementById('static-action-buttons');
    const floatingButtons = document.getElementById('floating-action-buttons');
    
    if (!staticButtons || !floatingButtons) return;
    
    // Verificar se os botões originais estão visíveis
    const rect = staticButtons.getBoundingClientRect();
    const isVisible = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
    
    // Mostrar/esconder botões flutuantes com base na visibilidade dos originais
    if (!isVisible && !floatingButtons.classList.contains('visible')) {
        floatingButtons.classList.add('visible');
    } else if (isVisible && floatingButtons.classList.contains('visible')) {
        floatingButtons.classList.remove('visible');
    }
    
    // Manter o mesmo estado de visibilidade (hidden/visible) nos botões flutuantes
    const prevButton = document.getElementById('prev-chapter-button');
    const nextButton = document.getElementById('next-chapter-button');
    const copyButton = document.getElementById('copy-button');
    const shareButton = document.getElementById('share-button');
    
    const floatingPrevButton = document.getElementById('floating-prev-chapter-button');
    const floatingNextButton = document.getElementById('floating-next-chapter-button');
    const floatingCopyButton = document.getElementById('floating-copy-button');
    const floatingShareButton = document.getElementById('floating-share-button');
    
    if (prevButton && floatingPrevButton) {
        floatingPrevButton.classList.toggle('hidden', prevButton.classList.contains('hidden'));
    }
    
    if (nextButton && floatingNextButton) {
        floatingNextButton.classList.toggle('hidden', nextButton.classList.contains('hidden'));
    }
    
    if (copyButton && floatingCopyButton) {
        floatingCopyButton.classList.toggle('hidden', copyButton.classList.contains('hidden'));
    }
    
    if (shareButton && floatingShareButton) {
        floatingShareButton.classList.toggle('hidden', shareButton.classList.contains('hidden'));
    }
}

async function searchVerse() {
    const reference = document.getElementById('reference').value.trim();
    const resultElement = document.getElementById('result');
    const translationSelect = document.getElementById('bible-select');
    const selectedBibleId = translationSelect.value;

    // Salvar a referência atual ao pesquisar
    saveReferencePreference(reference);

    result = generateResultFromEbf(reference, instructionsBackup, displayOptions, ebfData);

    if (result.error) {
        document.getElementById('prev-chapter-button').classList.add('hidden');
        document.getElementById('copy-button').classList.add('hidden');
        document.getElementById('share-button').classList.add('hidden');
        document.getElementById('next-chapter-button').classList.add('hidden');
        
        // Também esconder os botões flutuantes
        document.getElementById('floating-prev-chapter-button').classList.add('hidden');
        document.getElementById('floating-copy-button').classList.add('hidden');
        document.getElementById('floating-share-button').classList.add('hidden');
        document.getElementById('floating-next-chapter-button').classList.add('hidden');
    } else {
        document.getElementById('prev-chapter-button').classList.remove('hidden');
        document.getElementById('copy-button').classList.remove('hidden');
        document.getElementById('share-button').classList.remove('hidden');
        document.getElementById('next-chapter-button').classList.remove('hidden');
        
        // Também mostrar os botões flutuantes
        document.getElementById('floating-prev-chapter-button').classList.remove('hidden');
        document.getElementById('floating-copy-button').classList.remove('hidden');
        document.getElementById('floating-share-button').classList.remove('hidden');
        document.getElementById('floating-next-chapter-button').classList.remove('hidden');
        
        if (reference) {
            saveSearchToHistory(reference);
        }
    }
    resultElement.innerHTML = result.html;
    
    // Verificar visibilidade dos botões após atualizar o conteúdo
    checkNavigationButtonsVisibility();
}
