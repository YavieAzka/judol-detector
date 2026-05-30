import { type SearchResult } from "../interface.js";

interface AhoCorasickNode {
  children: Map<string, AhoCorasickNode>;
  failLink: AhoCorasickNode | null;
  outputLinks: AhoCorasickNode | null;
  outputs: string[];
}

function createNode(): AhoCorasickNode {
  return {
    children: new Map(),
    failLink: null,
    outputLinks: null,
    outputs: [],
  };
}

function buildAutomaton(keywords: string[]): AhoCorasickNode {
  const root = createNode();

  for (const keyword of keywords) {
    if (keyword.length === 0) continue;

    let curr = root;
    for (const ch of keyword.toLowerCase()) {
      if (!curr.children.has(ch)) {
        curr.children.set(ch, createNode());
      }
      curr = curr.children.get(ch)!;
    }
    curr.outputs.push(keyword);
  }

  const queue: AhoCorasickNode[] = [];

  for (const [, child] of root.children) {
    child.failLink = root;
    queue.push(child);
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;

    for (const [ch, child] of curr.children) {
      let fail = curr.failLink!;
      while (fail !== root && !fail.children.has(ch)) {
        fail = fail.failLink!;
      }
      child.failLink = fail.children.get(ch) ?? root;

      if (child.failLink === child) child.failLink = root;

      child.outputLinks =
        child.failLink!.outputs.length > 0
          ? child.failLink
          : child.failLink!.outputLinks;

      queue.push(child);
    }
  }

  return root;
}

export function ahoCorasickSearch(
  text: string,
  keywords: string[],
): SearchResult[] {
  const startTime = performance.now();
  const results: SearchResult[] = [];

  if (keywords.length === 0 || text.length === 0) return results;

  const root = buildAutomaton(keywords);
  const lowerText = text.toLowerCase();

  let curr = root;

  for (let i = 0; i < lowerText.length; i++) {
    const ch = lowerText[i]!;

    while (curr !== root && !curr.children.has(ch)) {
      curr = curr.failLink!;
    }

    if (curr.children.has(ch)) {
      curr = curr.children.get(ch)!;
    }

    let outputNode: AhoCorasickNode | null = curr;
    while (outputNode !== null) {
      for (const keyword of outputNode.outputs) {
        const startIndex = i - keyword.length + 1;
        results.push({
          keyword,
          algorithm: "AhoCorasick",
          startIndex,
          endIndex: startIndex + keyword.length,
          occurrences: 1,
          executionTime: 0,
        });
      }
      outputNode = outputNode.outputLinks;
    }
  }

  const executionTime = performance.now() - startTime;
  results.forEach((r) => (r.executionTime = executionTime));
  return results;
}

// rabin-karp

const RK_BASE = 31;
const RK_MOD = 1_000_000_007;

function computeHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i) - 96; // 'a'=1, 'b'=2, ..., angka bisa negatif → tidak masalah karena mod
    hash = (((hash * RK_BASE + code) % RK_MOD) + RK_MOD) % RK_MOD;
  }
  return hash;
}

function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  let b = base % mod;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) result = (result * b) % mod;
    b = (b * b) % mod;
    e = Math.floor(e / 2);
  }
  return result;
}

function rabinKarpSingle(
  text: string,
  pattern: string,
): Omit<SearchResult, "executionTime">[] {
  const results: Omit<SearchResult, "executionTime">[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || m > n) return results;

  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  const patternHash = computeHash(lowerPattern);
  const highestPow = modPow(RK_BASE, m - 1, RK_MOD);

  let windowHash = computeHash(lowerText.slice(0, m));

  for (let i = 0; i <= n - m; i++) {
    if (windowHash === patternHash) {
      if (lowerText.slice(i, i + m) === lowerPattern) {
        results.push({
          keyword: pattern,
          algorithm: "RabinKarp",
          startIndex: i,
          endIndex: i + m,
          occurrences: 1,
        });
      }
    }

    if (i < n - m) {
      const outCode = lowerText.charCodeAt(i) - 96;
      const inCode = lowerText.charCodeAt(i + m) - 96;
      windowHash =
        ((windowHash - ((outCode * highestPow) % RK_MOD) + RK_MOD) * RK_BASE +
          inCode) %
        RK_MOD;
      windowHash = ((windowHash % RK_MOD) + RK_MOD) % RK_MOD;
    }
  }

  return results;
}

export function rabinKarpSearch(
  text: string,
  keywords: string[],
): SearchResult[] {
  const startTime = performance.now();
  const allResults: SearchResult[] = [];

  for (const keyword of keywords) {
    if (keyword.length === 0) continue;
    const partial = rabinKarpSingle(text, keyword);
    for (const r of partial) {
      allResults.push({ ...r, executionTime: 0 });
    }
  }

  const executionTime = performance.now() - startTime;
  allResults.forEach((r) => (r.executionTime = executionTime));
  return allResults;
}
