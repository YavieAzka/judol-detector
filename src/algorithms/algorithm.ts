import { type SearchResult } from "../interface.js";

export class Matcher {
  private static computeLPSArray(pattern: string): number[] {
    const lps = new Array(pattern.length).fill(0);
    let length = 0;
    let i = 1;

    while (i < pattern.length) {
      if (pattern[i]!.toLowerCase() === pattern[length]!.toLowerCase()) {
        length++;
        lps[i] = length;
        i++;
      } else {
        if (length !== 0) {
          length = lps[length - 1];
        } else {
          lps[i] = 0;
          i++;
        }
      }
    }
    return lps;
  }

  public static kmpSearch(text: string, pattern: string): SearchResult[] {
    const startTime = performance.now();
    const results: SearchResult[] = [];

    if (!pattern || pattern.length === 0) return results;

    const lps = this.computeLPSArray(pattern);
    let i = 0;
    let j = 0;
    let comparisonCount = 0;

    while (i < text.length) {
      comparisonCount++;
      if (pattern[j]!.toLowerCase() === text[i]!.toLowerCase()) {
        j++;
        i++;
        if (j === pattern.length) {
          const startIndex = i - j;
          results.push({
            keyword: pattern,
            algorithm: "KMP",
            startIndex: startIndex,
            endIndex: startIndex + pattern.length,
            occurrences: 1,
            executionTime: 0,
            comparisonCount: 0,
          });
          j = lps[j - 1]!;
        }
      } else {
        if (j !== 0) {
          j = lps[j - 1]!;
        } else {
          i++;
        }
      }
    }
    const executionTime = performance.now() - startTime;
    results.forEach((res) => {
      res.executionTime = executionTime;
      res.comparisonCount = comparisonCount;
    });
    return results;
  }

  public static regexSearch(text: string): SearchResult[] {
    const startTime = performance.now();
    const results: SearchResult[] = [];
    const regex = /\b([\p{L}]+)(\d{2,3})\b/giu;

    let match;
    let occurences = 0;

    while ((match = regex.exec(text)) !== null) {
      occurences++;
      results.push({
        keyword: match[0],
        algorithm: "Regex",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        occurrences: 1,
        executionTime: 0,
      });
    }
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    results.forEach((res) => (res.executionTime = executionTime));
    return results;
  }

  private static buildBadCharTable(pattern: string): Map<string, number> {
    const badChar = new Map<string, number>();

    for (let i = 0; i < pattern.length; i++) {
      badChar.set(pattern[i]!.toLowerCase(), i);
    }
    return badChar;
  }

  public static boyerMooreSearch(
    text: string,
    pattern: string,
  ): SearchResult[] {
    const startTime = performance.now();
    const results: SearchResult[] = [];

    const m = pattern.length;
    const n = text.length;

    if (m === 0) return results;

    const badChar = this.buildBadCharTable(pattern);
    let s = 0; // pattern shift
    let comparisonCount = 0;

    while (s <= n - m) {
      let j = m - 1;

      while (j >= 0) {
        comparisonCount++;
        if (pattern[j]!.toLowerCase() === text[s + j]!.toLowerCase()) {
          j--;
        } else {
          break;
        }
      }

      if (j < 0) {
        results.push({
          keyword: pattern,
          algorithm: "BM",
          startIndex: s,
          endIndex: s + m,
          occurrences: 1,
          executionTime: 0,
          comparisonCount: 0,
        });
        s++;
      } else {
        const badCharShift = badChar.get(text[s + j]!.toLowerCase()) ?? -1;
        s += Math.max(1, j - badCharShift);
      }
    }
    const executionTime = performance.now() - startTime;
    results.forEach((res) => {
      res.executionTime = executionTime;
      res.comparisonCount = comparisonCount;
    });
    return results;
  }
}
