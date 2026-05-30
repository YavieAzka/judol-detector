import type { SearchResult } from "../interface.js";

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

  ["a", "α"],  // Alpha
  ["o", "ο"],  // Omicron
  ["e", "ε"],  // Epsilon
  ["n", "η"],  // Eta
  ["m", "μ"],  // Mu
  ["g", "γ"],  // Gamma
  ["t", "τ"],  // Tau
  ["p", "π"],  // Pi

  ["a", "Α"],  // Alpha
  ["o", "Ο"],  // Omicron
  ["h", "Η"],  // Eta — untuk ΗOKI
  ["s", "Ѕ"],  // (dipindah ke Cyrillic, lihat bawah)
  ["m", "Μ"],  // Mu — untuk ΜAXWIN
  ["n", "Ν"],  // Nu
  ["t", "Τ"],  // Tau
  ["p", "Π"],  // Pi
  ["x", "Χ"],  // Chi

  ["a", "а"],  // Cyrillic a
  ["e", "е"],  // Cyrillic e
  ["o", "о"],  // Cyrillic o
  ["p", "р"],  // Cyrillic r
  ["c", "с"],  // Cyrillic s
  ["i", "і"],  // Cyrillic i
  ["s", "ѕ"],  // Cyrillic dze
  ["x", "х"],  // Cyrillic x — untuk MAХWIN

  ["a", "А"],  // Cyrillic A
  ["e", "Е"],  // Cyrillic E
  ["o", "О"],  // Cyrillic O
  ["p", "Р"],  // Cyrillic R
  ["c", "С"],  // Cyrillic S
  ["m", "М"],  // Cyrillic M — untuk МAXWIN
  ["i", "І"],  // Cyrillic I
  ["s", "Ѕ"],  // Cyrillic Dze — untuk Ѕlot
  ["x", "Х"],  // Cyrillic X
];

const SUBSTITUTION_COST_MAP = new Map<string, number>();
const VISUAL_SUBSTITUTION_PENALTY = 0.2;

for (const [a, b] of VISUAL_SIMILAR_PAIRS) {
  const key = [a, b].sort().join("");
  SUBSTITUTION_COST_MAP.set(key, VISUAL_SUBSTITUTION_PENALTY);
}

function substitutionCost(a: string, b: string): number {
  const aLow = a.toLowerCase();
  const bLow = b.toLowerCase();

  if (aLow === bLow) return 0;

  const key = [aLow, bLow].sort().join("");
  return SUBSTITUTION_COST_MAP.get(key) ?? 1.0;
}

export function weightedLevenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

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

export function similarityScore(s1: string, s2: string): number {
  if (s1.length === 0 && s2.length === 0) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = weightedLevenshtein(s1, s2);
  return 1.0 - dist / maxLen;
}

interface Token {
  word: string;
  startIndex: number;
  endIndex: number;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /[a-zA-Z0-9\u0080-\uFFFF]+/g;
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

const SIMILARITY_THRESHOLD = 0.75;
const MIN_TOKEN_LENGTH = 4;
const MIN_KEYWORD_LENGTH = 4;

export function fuzzySearch(
  flatTextMap: string,
  keywords: string[],
  exactMatches: SearchResult[],
): SearchResult[] {
  const startTime = performance.now();
  const results: SearchResult[] = [];

  const keywordsToFuzz = keywords.filter(
    (kw) => kw.length >= MIN_KEYWORD_LENGTH,
  );

  if (keywordsToFuzz.length === 0) return results;

  const exactMatchedRanges = exactMatches.map((r) => ({
    start: r.startIndex,
    end: r.endIndex,
  }));

  // Tokenisasi flatTextMap sekali saja (efisiensi)
  const tokens = tokenize(flatTextMap);

  // Debug log (hapus setelah selesai testing)
  console.log(
    "Tokens:",
    tokens.map((t) => t.word),
  );
  console.log("Keywords to fuzz:", keywordsToFuzz);

  for (const token of tokens) {
    // Skip token yang terlalu pendek
    if (token.word.length < MIN_TOKEN_LENGTH) continue;

    // Skip token yang range-nya sudah di-cover exact match
    const alreadyCovered = exactMatchedRanges.some(
      (range) => range.start === token.startIndex && range.end === token.endIndex,
    );

    if (
      token.word.toUpperCase().includes("SL0T") ||
      token.word.toUpperCase().includes("GAC0R")
    ) {
      console.log("DEBUG token:", token.word, "covered:", alreadyCovered);
    }

    if (alreadyCovered) continue;

    // Bandingkan token dengan setiap keyword, pilih yang paling mirip
    let bestScore = -1;
    let bestKeyword = "";

    for (const keyword of keywordsToFuzz) {
      const score = similarityScore(token.word, keyword);

      if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestKeyword = keyword;
      }
    }

    // Hanya push hasil terbaik per token (hindari duplikasi)
    if (bestKeyword !== "") {
      results.push({
        keyword: bestKeyword,
        algorithm: "Levenshtein",
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        occurrences: 1,
        executionTime: 0,
      });
    }
  }

  const executionTime = performance.now() - startTime;
  results.forEach((r) => (r.executionTime = executionTime));

  return results;
}
