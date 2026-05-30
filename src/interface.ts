// struktur data hasil pencarian algoritma
export interface SearchResult {
  keyword: string;
  algorithm:
    | "KMP"
    | "BM"
    | "Regex"
    | "Levenshtein"
    | "AhoCorasick"
    | "RabinKarp";
  startIndex: number;
  endIndex: number;
  occurrences: number;
  executionTime: number;
}

// struktur data utk mapping karakter dengan node teks DOM
export interface TextNodeMap {
  node: Text;
  startIndex: number;
  endIndex: number;
}

// struktur data statistik yang disimpan di storage
export interface StorageData {
  judolStats?: {
    lastScanTime: number;
    totalKeywords: number;
    totalExecutionTime: number;
    detailedResults: SearchResult[];
  };
}

// struktur data utk visualisasi perbandingan hasil pencarian algoritma
export interface ChartData {
  label: string;
  value: number;
  color: string;
}
