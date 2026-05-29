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

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) {
        return;
    }
    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }
    creatingOffscreen = chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS' as any, 'DOM_PARSER' as any],
        justification: 'Run Tesseract OCR worker securely in extension context to bypass strict webpage CSPs'
    });
    try {
        await creatingOffscreen;
    } catch (e) {
        console.error("Failed to create offscreen document:", e);
    } finally {
        creatingOffscreen = null;
    }
}

async function handleOcrRequest(imageSrc: string): Promise<string> {
    await ensureOffscreenDocument();

    return new Promise((resolve) => {
        let timeoutId: any;
        
        const listener = (msg: any) => {
            if (msg.action === "OCR_RESULT" && msg.imageSrc === imageSrc) {
                chrome.runtime.onMessage.removeListener(listener);
                clearTimeout(timeoutId);
                resolve(msg.text);
            }
        };

        timeoutId = setTimeout(() => {
            chrome.runtime.onMessage.removeListener(listener);
            console.warn("OCR request timed out for image:", imageSrc);
            resolve("");
        }, 30000); // 30 seconds timeout

        chrome.runtime.onMessage.addListener(listener);

        chrome.runtime.sendMessage({
            target: "offscreen",
            action: "RUN_OCR",
            imageSrc: imageSrc
        }).catch((err) => {
            console.error("Failed to send message to offscreen:", err);
            chrome.runtime.onMessage.removeListener(listener);
            clearTimeout(timeoutId);
            resolve("");
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "PERFORM_OCR") {
        handleOcrRequest(message.imageSrc).then((text) => {
            sendResponse({ text });
        });
        return true; // Keep message channel open for async response
    }
});