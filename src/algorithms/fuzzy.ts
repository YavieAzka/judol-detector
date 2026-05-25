import type { SearchResult } from "../interface.js";

// ============================================================
// TABEL BOBOT SUBSTITUSI KARAKTER
// Pasangan karakter yang mirip secara visual mendapat penalti
// lebih kecil (0.2) dibanding substitusi normal (1.0).
// Semua key disimpan dalam lowercase.
// ============================================================
const VISUAL_SIMILAR_PAIRS: [string, string][] = [
  ["o", "0"],
  ["i", "1"],
  ["l", "1"],
  ["z", "2"],
  ["e", "3"],
  ["a", "4"],
  ["s", "5"],
  ["g", "6"],
  ["t", "7"],
  ["b", "8"],
  ["q", "9"],
  // Karakter unicode yang sering dipakai sebagai kamuflase
  ["a", "α"], // alpha Yunani
  ["o", "ο"], // omicron Yunani
  ["e", "е"], // Cyrillic e
  ["a", "а"], // Cyrillic a
  ["p", "р"], // Cyrillic r (mirip p)
  ["c", "с"], // Cyrillic s (mirip c)
  ["i", "і"], // Cyrillic i
];

// Bangun lookup map dua arah dari tabel di atas
// Key: "ab" (dua karakter, diurutkan secara leksikografis) → nilai penalti
const SUBSTITUTION_COST_MAP = new Map<string, number>();
const VISUAL_SUBSTITUTION_PENALTY = 0.2;

for (const [a, b] of VISUAL_SIMILAR_PAIRS) {
  const key = [a, b].sort().join("");
  SUBSTITUTION_COST_MAP.set(key, VISUAL_SUBSTITUTION_PENALTY);
}

/**
 * Menghitung biaya substitusi antara dua karakter.
 * Karakter identik → 0
 * Karakter mirip visual → VISUAL_SUBSTITUTION_PENALTY (0.2)
 * Karakter berbeda → 1.0
 */
function substitutionCost(a: string, b: string): number {
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();

  if (aLow === bLow) return 0;

  const key = [aLow, bLow].sort().join("");
  return SUBSTITUTION_COST_MAP.get(key) ?? 1.0;
}

// ============================================================
// WEIGHTED LEVENSHTEIN DISTANCE
// Menggunakan DP standar dengan tabel 2D.
// Biaya insert/delete = 1.0, biaya substitusi = substitutionCost().
// ============================================================

/**
 * Menghitung Weighted Levenshtein Distance antara dua string.
 * @returns Nilai distance (float). Semakin kecil = semakin mirip.
 */
export function weightedLevenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  // Alokasi tabel DP berukuran (m+1) x (n+1)
  // dp[i][j] = cost minimum untuk mengubah s1[0..i-1] menjadi s2[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  // Base case: mengubah string ke string kosong
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = substitutionCost(s1[i - 1]!, s2[j - 1]!);

      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Menghitung skor kemiripan ternormalisasi antara dua string.
 * @returns Nilai antara 0.0 (sangat berbeda) hingga 1.0 (identik).
 */
export function similarityScore(s1: string, s2: string): number {
  if (s1.length === 0 && s2.length === 0) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = weightedLevenshtein(s1, s2);
  return 1.0 - dist / maxLen;
}

// ============================================================
// TOKENIZER
// Memecah flatTextMap menjadi token kata beserta posisi aslinya
// dalam string, sehingga startIndex/endIndex pada SearchResult
// tetap valid untuk highlight.
// ============================================================

interface Token {
  word: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Tokenisasi string menjadi kata-kata non-whitespace beserta posisinya.
 * Mempertahankan index asli agar kompatibel dengan TextNodeMap.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Cocokkan setiap run karakter non-spasi
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      word: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return tokens;
}

// ============================================================
// KONFIGURASI THRESHOLD
// Nilai minimum similarityScore agar token dianggap "match".
// Nilai ini krusial: terlalu tinggi → miss; terlalu rendah → false positive.
//
// Reasoning:
// - Kata 4 karakter yang 1 hurufnya diganti → sim ≈ 0.75 (sub biasa)
//   atau sim ≈ 0.95 (sub visual, karena penalti 0.2)
// - Threshold 0.75 menangkap manipulasi visual tanpa terlalu banyak noise.
// - Kata sangat pendek (≤ 3 karakter) di-skip untuk menghindari false positive.
// ============================================================
const SIMILARITY_THRESHOLD = 0.75;
const MIN_TOKEN_LENGTH = 4;
const MIN_KEYWORD_LENGTH = 4;

// ============================================================
// FUNGSI UTAMA FUZZY SEARCH
// ============================================================

/**
 * Menjalankan fuzzy matching pada flatTextMap untuk keyword yang
 * belum ditemukan oleh exact matching (KMP/BM).
 *
 * @param flatTextMap  - String gabungan semua teks DOM
 * @param keywords     - Daftar semua keyword dari keyword.txt
 * @param exactMatches - Hasil exact matching yang sudah ada (untuk di-skip)
 * @returns Array SearchResult[] dengan algoritma 'Levenshtein'
 */
export function fuzzySearch(
  flatTextMap: string,
  keywords: string[],
  exactMatches: SearchResult[],
): SearchResult[] {
  const startTime = performance.now();
  const results: SearchResult[] = [];

  // Kumpulkan keyword yang sudah memiliki exact match → skip fuzzy untuk keyword ini
  const exactlyMatchedKeywords = new Set(
    exactMatches.map((r) => r.keyword.toLowerCase()),
  );

  // Saring keyword yang perlu difuzzy
  const keywordsToFuzz = keywords.filter((kw) => {
    if (kw.length < MIN_KEYWORD_LENGTH) return false;
    return !exactlyMatchedKeywords.has(kw.toLowerCase());
  });

  if (keywordsToFuzz.length === 0) return results;

  // Tokenisasi flatTextMap sekali saja (efisiensi)
  const tokens = tokenize(flatTextMap);

  for (const token of tokens) {
    // Skip token yang terlalu pendek
    if (token.word.length < MIN_TOKEN_LENGTH) continue;

    // Bandingkan token dengan setiap keyword yang perlu difuzzy
    for (const keyword of keywordsToFuzz) {
      const score = similarityScore(token.word, keyword);

      if (score >= SIMILARITY_THRESHOLD) {
        results.push({
          keyword: keyword,
          algorithm: "Levenshtein",
          startIndex: token.startIndex,
          endIndex: token.endIndex,
          occurrences: 1,
          executionTime: 0, // diisi setelah loop selesai
        });

        // Satu token hanya di-match dengan keyword terbaik (tidak perlu lanjut)
        break;
      }
    }
  }

  const executionTime = performance.now() - startTime;
  results.forEach((r) => (r.executionTime = executionTime));

  return results;
}
