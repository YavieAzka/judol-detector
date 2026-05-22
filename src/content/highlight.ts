import type { SearchResult, TextNodeMap } from "../interface.js";

// kelas untuk menerapkan highlight pada teks hasil pencarian
export class Highlighter {
    
    // fungsi untuk menerapkan highlight pada teks hasil pencarian
    public static applyHighlight(match: SearchResult, shadowMap: TextNodeMap[]) {
        // mencari setiap node yang tumpang tindih dengan hasil pencarian
        const overlappingNodes = shadowMap.filter(mappedNode => {
            return mappedNode.startIndex < match.endIndex && mappedNode.endIndex > match.startIndex;
        });

        // iterasi setiap node yang tumpang tindih dan terapkan fungsi splitText
        for (const mappedNode of overlappingNodes) {
            // jika mappedNode tidak ditemukan, skip (edge case)
            if (!mappedNode) {
                continue;
            }
            
            // menghitung dimana indeks utk split node ini
            // menggunakan Math.max() utk handle node yang berada di awal hasil pencarian
            const localStartIndex = Math.max(0, match.startIndex - mappedNode.startIndex);
            
            // jika node ini berada di akhir hasil pencarian, gunakan Math.min() utk handle edge case
            const localEndIndex = Math.min(
                mappedNode.node.length, 
                match.endIndex - mappedNode.startIndex
            );

            // TODO (Your Job): 
            // Use localStartIndex and localEndIndex with node.splitText() 
            // to wrap the isolated text in <span class="judol-highlight">...</span>
            this.wrapNode(mappedNode.node, localStartIndex, localEndIndex);
        }
    }

    /**
     * Physically splits a text node and wraps the target characters in a span.
     */
    private static wrapNode(node: Text, start: number, end: number) {
        // memastikan node memiliki parent sebelum melakukan split (edge case)
        if (!node.parentNode) {
            return;
        }

        // menggunakan Math.max() dan Math.min() untuk memastikan indeks split berada dalam batas node
        const safeStart = Math.max(0, start);
        const safeEnd = Math.max(safeStart, end);

        // jika safeStart dan safeEnd sama, 
        // berarti tidak ada teks yang perlu di-highlight
        if (safeStart === safeEnd) {
            return;
        }

        // split node teks menjadi tiga bagian: sebelum, tengah (yang akan di-highlight), dan setelah
        const middleNode = node.splitText(safeStart);
        middleNode.splitText(safeEnd - safeStart);

        // buat elemen span untuk membungkus teks yang di-highlight
        const span = document.createElement("span");
        span.className = "judol-highlight";
        span.appendChild(middleNode);
        node.parentNode.replaceChild(span, middleNode);
    }

    // fungsi untuk menghapus semua highlight
    public static removeAllHighlights() {
        // mencari semua highlight
        const highlights = document.querySelectorAll('.judol-highlight');
        
        // unwrap setiap highlight dengan memindahkan elemen anaknya ke parent dan menghapus elemen span
        highlights.forEach(span => {
            const parent = span.parentNode;
            if (parent) {
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
            }
        });

        // normalisasi kembali teks setelah menghapus highlight untuk menggabungkan node teks yang terpisah
        document.body.normalize();
    }
}
