// struktur data hasil pencarian algoritma
export interface SearchResult {
  keyword: string;
  algorithm: string;
  startIndex: number;
  endIndex: number;
  occurrences: number;
  executionTime: number;
  timeDetails?: string; // detail waktu eksekusi tiap algoritma
  occurrenceDetails?: string; // detail jumlah kemunculan tiap keyword
  occurrenceMap?: Record<string, Record<string, number>>; // map kemunculan keyword per algoritma
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
