import keywordsRaw from '../../keywords/keywords.txt?raw';

const parsedKeywords = parseTextFile(keywordsRaw);

chrome.runtime.onInstalled.addListener(() => {
    initializeDictionary();
});

chrome.runtime.onStartup.addListener(() => {
    initializeDictionary();
});

// fungsi utk load file keywords.txt ke dalam memory saat extension diinstal atau browser dinyalakan
async function initializeDictionary() {
    try {
        // caching di storage
        await chrome.storage.local.set({ activeDictionary: parsedKeywords });
        
        console.log("Dictionary loaded into memory:", parsedKeywords.length, "words");
    } catch (error) {
        console.error("Failed to load keywords.txt:", error);
    }
}

// fungsi parsing teks mentah dari file keywords.txt menjadi array string
function parseTextFile(rawText: string): string[] {
    // split the teks mentah menjadi array
    return rawText
        .split(/\r?\n/)                     // split teks
        .map(word => word.trim())           // strip spaces
        .filter(word => word.length > 0);   // menghilangkan empty string
}