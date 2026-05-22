import type { TextNodeMap } from "../interface.js";

// fungsi utk mengambil node teks dari elemen root HTML yang diberikan
export function buildTextMap(rootElement: HTMLElement): { flatTextMap: string, textNodeMap: TextNodeMap[]} {
    // list utk menyimpan node teks yang ditemukan
    const textNodeMap: TextNodeMap[] = [];

    // string besar yang menggabungkan semua teks dari node teks, 
    let flatTextMap = '';

    // index saat ini dalam string besar
    let currentIndex = 0;
    
    // membuat sebuah TreeWalker utk mengambil node teks dari elemen
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node: Text) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName.toLowerCase();
                // edge case: jika node teks berada di dalam elemen yang tidak terlihat, skip
                if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }

                // ignore whitespace
                if (node.nodeValue?.trim() === '') {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    // iterasi melalui semua node teks yang ditemukan dan tambahkan ke list
    let currentNode = walker.nextNode();
    while (currentNode) {
        // memastikan node saat ini adalah node teks
        const textNode = currentNode as Text;
        const textContent = textNode.nodeValue || "";

        // push node teks dan indexnya ke list
        textNodeMap.push({
            node: textNode,
            startIndex: currentIndex,
            endIndex: currentIndex + textContent.length
        });

        // menambahkan teks ke string besar dan update index saat ini
        flatTextMap += textContent;
        currentIndex += textContent.length;

        currentNode = walker.nextNode();
    }

    return { flatTextMap, textNodeMap };
}