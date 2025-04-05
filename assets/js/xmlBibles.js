// Bible book mapping from OSIS to USFM IDs
const BIBLE_BOOKS_MAP = {
    // Old Testament
    "Gen": { usfm_id: "GEN" },
    "Exod": { usfm_id: "EXO" },
    "Lev": { usfm_id: "LEV" },
    "Num": { usfm_id: "NUM" },
    "Deut": { usfm_id: "DEU" },
    "Josh": { usfm_id: "JOS" },
    "Judg": { usfm_id: "JDG" },
    "Ruth": { usfm_id: "RUT" },
    "1Sam": { usfm_id: "1SA" },
    "2Sam": { usfm_id: "2SA" },
    "1Kgs": { usfm_id: "1KI" },
    "2Kgs": { usfm_id: "2KI" },
    "1Chr": { usfm_id: "1CH" },
    "2Chr": { usfm_id: "2CH" },
    "Ezra": { usfm_id: "EZR" },
    "Neh": { usfm_id: "NEH" },
    "Esth": { usfm_id: "EST" },
    "Job": { usfm_id: "JOB" },
    "Ps": { usfm_id: "PSA" },
    "Prov": { usfm_id: "PRO" },
    "Eccl": { usfm_id: "ECC" },
    "Song": { usfm_id: "SNG" },
    "Isa": { usfm_id: "ISA" },
    "Jer": { usfm_id: "JER" },
    "Lam": { usfm_id: "LAM" },
    "Ezek": { usfm_id: "EZK" },
    "Dan": { usfm_id: "DAN" },
    "Hos": { usfm_id: "HOS" },
    "Joel": { usfm_id: "JOL" },
    "Amos": { usfm_id: "AMO" },
    "Obad": { usfm_id: "OBA" },
    "Jonah": { usfm_id: "JON" },
    "Mic": { usfm_id: "MIC" },
    "Nah": { usfm_id: "NAM" },
    "Hab": { usfm_id: "HAB" },
    "Zeph": { usfm_id: "ZEP" },
    "Hag": { usfm_id: "HAG" },
    "Zech": { usfm_id: "ZEC" },
    "Mal": { usfm_id: "MAL" },
    
    // New Testament
    "Matt": { usfm_id: "MAT" },
    "Mark": { usfm_id: "MRK" },
    "Luke": { usfm_id: "LUK" },
    "John": { usfm_id: "JHN" },
    "Acts": { usfm_id: "ACT" },
    "Rom": { usfm_id: "ROM" },
    "1Cor": { usfm_id: "1CO" },
    "2Cor": { usfm_id: "2CO" },
    "Gal": { usfm_id: "GAL" },
    "Eph": { usfm_id: "EPH" },
    "Phil": { usfm_id: "PHP" },
    "Col": { usfm_id: "COL" },
    "1Thess": { usfm_id: "1TH" },
    "2Thess": { usfm_id: "2TH" },
    "1Tim": { usfm_id: "1TI" },
    "2Tim": { usfm_id: "2TI" },
    "Titus": { usfm_id: "TIT" },
    "Phlm": { usfm_id: "PHM" },
    "Heb": { usfm_id: "HEB" },
    "Jas": { usfm_id: "JAS" },
    "1Pet": { usfm_id: "1PE" },
    "2Pet": { usfm_id: "2PE" },
    "1John": { usfm_id: "1JN" },
    "2John": { usfm_id: "2JN" },
    "3John": { usfm_id: "3JN" },
    "Jude": { usfm_id: "JUD" },
    "Rev": { usfm_id: "REV" },
    
    // Deuterocanonical books (for Catholic Bibles)
    "Tob": { usfm_id: "TOB" },
    "Jdt": { usfm_id: "JDT" },
    "EpJer": { usfm_id: "LJE" },
    "Bar": { usfm_id: "BAR" },
    "Sus": { usfm_id: "SUS" },
    "Bel": { usfm_id: "BEL" },
    "1Macc": { usfm_id: "1MA" },
    "2Macc": { usfm_id: "2MA" },
    "3Macc": { usfm_id: "3MA" },
    "4Macc": { usfm_id: "4MA" },
    "Wis": { usfm_id: "WIS" },
    "Sir": { usfm_id: "SIR" },
    "PrMan": { usfm_id: "MAN" },
    "1Esd": { usfm_id: "1ES" },
    "2Esd": { usfm_id: "2ES" },
    "Ps151": { usfm_id: "PS2" },
    "AddEsth": { usfm_id: "ADE" },
    "AddDan": { usfm_id: "DAG" }
};

function convertOsisToEbf(xmlContent) {
    return new Promise((resolve, reject) => {
        try {
            // Use the browser's built-in XML parser
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            
            // Handle parsing errors
            const parseError = xmlDoc.getElementsByTagName("parsererror");
            if (parseError.length > 0) {
                reject(new Error("XML parsing error: " + parseError[0].textContent));
                return;
            }
            
            // Extract Bible name from header > work > title
            let bibleName = "imported";  // Default name if not found
            const header = xmlDoc.getElementsByTagName("header")[0];
            if (header) {
                const work = header.getElementsByTagName("work")[0];
                if (work) {
                    const title = work.getElementsByTagName("title")[0];
                    if (title) {
                        bibleName = title.textContent.trim();
                    }
                }
            }

            const books = [];
            // Get all book divs
            const osisText = xmlDoc.getElementsByTagName("osisText")[0];
            if (!osisText) {
                reject(new Error("Invalid OSIS format: osisText element not found"));
                return;
            }
            
            // Find all div elements with type="book"
            const bookDivs = Array.from(osisText.getElementsByTagName("div"))
                .filter(div => div.getAttribute("type") === "book");
            
            bookDivs.forEach(bookDiv => {
                // Get the osisID from the book div
                const osisID = bookDiv.getAttribute('osisID');
                
                // Get USFM ID from the mapping table or use osisID if not found
                const bookDetails = BIBLE_BOOKS_MAP[osisID] || { usfm_id: osisID };
                const usfm_id = bookDetails.usfm_id;

                const chapters = [];
                
                // Process chapters
                const chapterElements = Array.from(bookDiv.getElementsByTagName("chapter"));
                chapterElements.forEach(chapterElem => {
                    const verses = [];
                    
                    // Process verses
                    const verseElements = Array.from(chapterElem.getElementsByTagName("verse"));
                    verseElements.forEach(verseElem => {
                        // Get the text content of the verse
                        let verseText = "";
                        for (const node of verseElem.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                verseText += node.textContent;
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                verseText += node.textContent;
                            }
                        }
                        verses.push({
                            text: verseText.trim(),
                        });
                    });
                    
                    chapters.push({
                        verses: verses,
                    });
                });
                
                books.push({
                    names: [osisID],
                    abbreviation: osisID,
                    usfm_id: usfm_id,
                    chapters: chapters,
                });
            });
            
            resolve({
                bible: {
                    name: bibleName,
                    books: books,
                }
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

function convertUsfxToEbf(xmlContent) {
    return new Promise((resolve, reject) => {
        try {
            // Use the browser's built-in XML parser
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            
            // Handle parsing errors
            const parseError = xmlDoc.getElementsByTagName("parsererror");
            if (parseError.length > 0) {
                reject(new Error("XML parsing error: " + parseError[0].textContent));
                return;
            }
            
            // Get language code
            const languageCode = xmlDoc.querySelector("languageCode")?.textContent || "und";
            
            // Get Bible name (use first book's id as a fallback)
            let bibleName = "USFX Bible";
            const firstBook = xmlDoc.querySelector("book");
            if (firstBook) {
                const idElement = firstBook.querySelector("id");
                if (idElement && idElement.textContent.trim()) {
                    bibleName = idElement.textContent.trim();
                }
            }
            
            const books = [];
            // Get all book elements
            const bookElements = xmlDoc.getElementsByTagName("book");
            
            for (let i = 0; i < bookElements.length; i++) {
                const bookElement = bookElements[i];
                const bookId = bookElement.getAttribute("id");
                
                // Get book names from TOC elements
                const names = [];
                const tocElements = bookElement.getElementsByTagName("toc");
                let abbreviation = bookId; // Default to bookId if no toc level="3" is found
                
                for (let j = 0; j < tocElements.length; j++) {
                    const tocElement = tocElements[j];
                    const level = tocElement.getAttribute("level");
                    const tocText = tocElement.textContent.trim();
                    
                    if (level === "3") {
                        // Level 3 is the abbreviation
                        abbreviation = tocText;
                    } else {
                        // Other levels are book names
                        if (tocText && !names.includes(tocText)) {
                            names.push(tocText);
                        }
                    }
                }
                
                // Process chapters
                const chapters = [];
                const chapterElements = bookElement.getElementsByTagName("c");
                
                for (let j = 0; j < chapterElements.length; j++) {
                    const chapterElement = chapterElements[j];
                    const pElements = getFollowingPElements(chapterElement);
                    
                    const verses = [];
                    
                    // Process each paragraph that contains verses
                    for (let k = 0; k < pElements.length; k++) {
                        const pElement = pElements[k];
                        const verseElements = pElement.getElementsByTagName("v");
                        
                        for (let l = 0; l < verseElements.length; l++) {
                            const verseElement = verseElements[l];
                            let verseText = "";
                            
                            // Get all text until <ve/> tag or next verse
                            let currentNode = verseElement.nextSibling;
                            while (currentNode && 
                                   !(currentNode.nodeType === Node.ELEMENT_NODE && 
                                     currentNode.tagName === "ve") && 
                                   !(currentNode.nodeType === Node.ELEMENT_NODE && 
                                     currentNode.tagName === "v")) {
                                
                                if (currentNode.nodeType === Node.TEXT_NODE) {
                                    verseText += currentNode.textContent;
                                } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                                    // Skip footnote content but include other elements
                                    if (currentNode.tagName !== "f") {
                                        verseText += currentNode.textContent;
                                    }
                                }
                                currentNode = currentNode.nextSibling;
                            }
                            
                            verses.push({
                                text: verseText.trim()
                            });
                        }
                    }
                    
                    chapters.push({
                        verses: verses
                    });
                }
                
                books.push({
                    names: names,
                    abbreviation: abbreviation,
                    usfm_id: bookId,
                    chapters: chapters
                });
            }
            
            resolve({
                bible: {
                    name: bibleName,
                    language: languageCode,
                    books: books
                }
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to get all <p> elements that follow the chapter
// until the next chapter element or end of book
function getFollowingPElements(chapterElement) {
    const pElements = [];
    let currentNode = chapterElement.nextSibling;
    
    while (currentNode) {
        // Break if we encounter the next chapter
        if (currentNode.nodeType === Node.ELEMENT_NODE && 
            currentNode.tagName === "c") {
            break;
        }
        
        // Add paragraph elements
        if (currentNode.nodeType === Node.ELEMENT_NODE && 
            currentNode.tagName === "p") {
            pElements.push(currentNode);
        }
        
        currentNode = currentNode.nextSibling;
    }
    
    return pElements;
}

/**
 * Detects the format of the provided XML content
 * @param {string} xmlContent - The XML content to analyze
 * @returns {string} - 'osis', 'usfx', or 'unknown'
 */
function detectXmlFormat(xmlContent) {
    try {
        // Use the browser's built-in XML parser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        
        // Handle parsing errors
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
            return 'unknown';
        }
        
        // Check for OSIS format
        const osisText = xmlDoc.getElementsByTagName("osisText");
        const osisDiv = Array.from(xmlDoc.getElementsByTagName("div")).filter(div => div.getAttribute("type") === "book");
        
        if (osisText.length > 0 || osisDiv.length > 0) {
            return 'osis';
        }
        
        // Check for USFX format
        const usfxElement = xmlDoc.getElementsByTagName("usfx");
        const bookElements = xmlDoc.getElementsByTagName("book");
        const hasUsfxStructure = bookElements.length > 0 && 
                                Array.from(bookElements).some(el => el.getAttribute("id"));
        
        if (usfxElement.length > 0 || hasUsfxStructure) {
            return 'usfx';
        }
        
        // If no clear format is detected
        return 'unknown';
    } catch (error) {
        console.error('Error detecting XML format:', error);
        return 'unknown';
    }
}

/**
 * Converts XML content to Easy Bible Format (EBF)
 * It auto-detects whether the XML is in OSIS or USFX format
 * @param {string} xmlContent - The XML content to convert
 * @returns {Promise<Object>} - Promise that resolves to the EBF object
 */
function convertXmlToEbf(xmlContent) {
    return new Promise((resolve, reject) => {
        try {
            const format = detectXmlFormat(xmlContent);
            
            switch (format) {
                case 'osis':
                    convertOsisToEbf(xmlContent)
                        .then(result => resolve(result))
                        .catch(error => reject(error));
                    break;
                    
                case 'usfx':
                    convertUsfxToEbf(xmlContent)
                        .then(result => resolve(result))
                        .catch(error => reject(error));
                    break;
                    
                default:
                    reject(new Error("Unsupported XML format. The XML provided is neither OSIS nor USFX format."));
                    break;
            }
        } catch (error) {
            reject(error);
        }
    });
}

// Export functions
window.XmlBibles = {
    convertOsisToEbf,
    convertUsfxToEbf,
    convertXmlToEbf
};
