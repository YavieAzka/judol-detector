import type { SearchResult } from "../interface.js";
import "../styles/content.css";
import { buildTextMap } from "../content/dom_walker.js";
import { Highlighter } from "../content/highlight.js";
import { Matcher } from "../algorithms/algorithm.js";
import { fuzzySearch } from "../algorithms/fuzzy.js";
import { ahoCorasickSearch, rabinKarpSearch } from "../algorithms/bonus.js";

function detectSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[.!?\n\r]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
// event listener untuk menerima pesan dari popup utk toggle blur
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // pesan yang diterima adalah perintah toggle blur
  if (message.command === "TOGGLE_BLUR") {
    // mencari semua elemen hasil highlight di halaman web
    const highlights = document.querySelectorAll(".judol-highlight");

    // iterasi melalui semua elemen hasil highlight dan toggle kelas 'is-blurred' sesuai dengan state yang diterima dari popup
    highlights.forEach((span) => {
      if (message.blurState === true) {
        span.classList.add("is-blurred");
      } else {
        span.classList.remove("is-blurred");
      }
    });

    // mencari semua gambar yang terdeteksi mengandung keyword
    const matchedImages = document.querySelectorAll("img.judol-image-matched");
    matchedImages.forEach((img) => {
      if (message.blurState === true) {
        img.classList.add("is-blurred");
      } else {
        img.classList.remove("is-blurred");
      }
    });

    console.log(`Blur state: ${message.blurState}`);
    sendResponse({ status: "success" });
  }

  // pesan yang diterima adalah perintah rescan halaman web
  else if (message.command === "MANUAL_RESCAN") {
    console.log("Manual re-scanning...");

    // menghapus semua highlight yang ada di halaman web
    Highlighter.removeAllHighlights();

    // Reset status OCR pada semua gambar
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      img.removeAttribute("data-ocr-processed");
      img.classList.remove("judol-image-matched");
      img.classList.remove("is-blurred");
      img.removeAttribute("data-keyword");
      img.removeAttribute("data-algorithm");
      img.removeAttribute("data-occurrences");
      img.removeAttribute("data-time");
    });

    // scan ulang halaman web
    scanPage(document.body, true);

    sendResponse({ status: "Rescan initiated" });
  }

  return false;
});

// tooltip saat hover pada hasil highlight
const tooltip = document.createElement("div");
tooltip.id = "judol-modern-tooltip";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

// fungsi utk memposisikan tooltip supaya tidak keluar viewport
function positionTooltip(event: MouseEvent) {
  const padding = 12;
  const offset = 15;
  const rect = tooltip.getBoundingClientRect();

  let left = event.clientX + offset;
  let top = event.clientY + offset;

  if (left + rect.width + padding > window.innerWidth) {
    left = window.innerWidth - rect.width - padding;
  }

  if (top + rect.height + padding > window.innerHeight) {
    top = event.clientY - rect.height - offset;
  }

  left = Math.max(padding, left);
  top = Math.max(padding, top);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// event listener untuk menampilkan tooltip saat hover pada hasil highlight atau gambar yang terdeteksi
document.addEventListener("mouseover", (event) => {
  const target = event.target as HTMLElement;

  if (target.classList.contains("judol-highlight")) {
    const parentElement = target.parentElement;
    if (!parentElement) return;

    // mengumpulkan semua highlight yang berada di dalam TextNode yang sama
    const siblingHighlights = Array.from(
      parentElement.querySelectorAll(".judol-highlight"),
    ) as HTMLElement[];

    // variabel untuk menampung agregasi data
    const allKeywords = new Set<string>();
    const allAlgorithms = new Set<string>();
    const localOccurrenceMap: Record<string, Record<string, number>> = {};
    const algorithmTimeMap = new Map<string, number>();

    // iterasi untuk menjumlahkan semua keyword, algoritma, dan occurrences dari highlight yang berada di TextNode yang sama
    siblingHighlights.forEach((span) => {
      // parse data dari masing-masing span
      const keywords = (span.dataset.keyword || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const algorithms = (span.dataset.algorithm || "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      keywords.forEach((k) => allKeywords.add(k));
      algorithms.forEach((a) => allAlgorithms.add(a));

      // hitung Local Occurrences (kata yang muncul di paragraf ini saja)
      keywords.forEach((k) => {
        const lowerK = k.toLowerCase();
        const keywordEntry = localOccurrenceMap[lowerK] ?? {};

        algorithms.forEach((alg) => {
          keywordEntry[alg] = (keywordEntry[alg] ?? 0) + 1;
        });

        localOccurrenceMap[lowerK] = keywordEntry;
      });

      // parse dan gabungkan execution time
      // format: "KMP: 12.00 ms<br>Regex: 15.00 ms"
      const timeDetails = (span.dataset.time || "").split("<br>");
      timeDetails.forEach((detail) => {
        const parts = detail.split(":");
        if (parts.length === 2) {
          const alg = parts[0]?.trim();
          const timePart = parts[1];
          if (!alg || !timePart) return;

          const timeStr = timePart.replace("ms", "").trim();
          const timeVal = parseFloat(timeStr);

          if (!isNaN(timeVal)) {
            // Menggunakan Math.max untuk memastikan jika KMP menemukan 2 kata di paragraf ini,
            // waktu global pencarian KMP tidak ditambahkan berulang kali
            const currentTime = algorithmTimeMap.get(alg) ?? 0;
            algorithmTimeMap.set(alg, Math.max(currentTime, timeVal));
          }
        }
      });
    });

    // format data utk Tooltip
    const keywordArray = Array.from(allKeywords);
    const showKeyword = keywordArray.length > 1;

    // string HTML untuk occurrences
    const lines = keywordArray.map((keyword) => {
      const counts = localOccurrenceMap[keyword.toLowerCase()] || {};
      const entries = Object.entries(counts)
        .map(([alg, count]) => `${alg}: ${count}`)
        .join(", ");
      const content = entries.length > 0 ? entries : "0";
      return showKeyword ? `${keyword}: ${content}` : content;
    });
    const occurrenceHtml = lines.length > 0 ? lines.join("<br>") : "0";

    // string HTML utk breakdown waktu dan hitung total
    let totalExecutionTime = 0;
    const timeLines: string[] = [];
    algorithmTimeMap.forEach((time, alg) => {
      totalExecutionTime += time;
      timeLines.push(`${alg}: ${time.toFixed(2)} ms`);
    });
    const timeHtml = timeLines.join("<br>");

    tooltip.innerHTML = `
      <div class="judol-tt-header">Detection Details</div>
      <div class="judol-tt-row">
          <span class="judol-tt-label">Keywords:</span>
          <span class="judol-tt-value">${keywordArray.join(", ")}</span>
      </div>
      <div class="judol-tt-row">
          <span class="judol-tt-label">Algorithms:</span>
          <span class="judol-tt-value" style="color: #3b82f6;">${Array.from(allAlgorithms).join(", ")}</span>
      </div>
      <div class="judol-tt-row">
        <span class="judol-tt-label">Local Occurrences:</span>
        <span class="judol-tt-value" style="text-align: right; font-weight: 500;">
          ${occurrenceHtml}
        </span>
      </div>
      <hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 8px 0;">
      <div style="font-size: 11px; color: #64748b;">
        <strong>Execution Times Breakdown:</strong><br>
        ${timeHtml}
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
            <strong style="font-size: 12px; color: #0f172a;">Total Node Time: ${totalExecutionTime.toFixed(2)} ms</strong>
        </div>
      </div>
    `;

    tooltip.style.display = "block";
    positionTooltip(event);
  } else if (target.classList.contains("judol-image-matched")) {
    const keyword = target.dataset.keyword || "";
    const algorithm = target.dataset.algorithm || "";
    const occurrences = target.dataset.occurrences || "0";
    const time = target.dataset.time || "0";

    tooltip.innerHTML = `
      <div class="judol-tt-header">Detection Details (Image)</div>
      <div class="judol-tt-row">
          <span class="judol-tt-label">Keywords:</span>
          <span class="judol-tt-value">${keyword}</span>
      </div>
      <div class="judol-tt-row">
          <span class="judol-tt-label">Algorithms:</span>
          <span class="judol-tt-value" style="color: #3b82f6;">${algorithm}</span>
      </div>
      <div class="judol-tt-row">
        <span class="judol-tt-label">Occurrences:</span>
        <span class="judol-tt-value" style="text-align: right; font-weight: 500;">
          ${occurrences}
        </span>
      </div>
      <hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 8px 0;">
      <div style="font-size: 11px; color: #64748b;">
        <strong style="font-size: 12px; color: #0f172a;">Total Image OCR Time: ${time} ms</strong>
      </div>
    `;

    tooltip.style.display = "block";
    positionTooltip(event);
  }
});

// event listener saat mouse keluar dari hasil highlight atau gambar terdeteksi
document.addEventListener("mouseout", (event) => {
  const target = event.target as HTMLElement;
  if (
    target.classList.contains("judol-highlight") ||
    target.classList.contains("judol-image-matched")
  ) {
    tooltip.style.display = "none";
  }
});

// fungsi untuk menyimpan hasil pencarian ke dalam storage chrome
async function saveResultsToStorage(
  newResults: SearchResult[],
  isInitialScan: boolean = false,
) {
  // edge case: jika tidak ada hasil baru yang ditemukan dan ini bukan scan awal, tidak perlu update storage
  if (newResults.length === 0 && !isInitialScan) {
    return;
  }

  // mendapatkan data statistik yang sudah ada dari storage dan digabungkan dengan hasil baru (jika bukan scan awal)
  const data = await chrome.storage.local.get("judolStats");
  const existingResults = isInitialScan
    ? []
    : data.judolStats?.detailedResults || [];
  const combinedResults = [...existingResults, ...newResults];

  // menghitung total keywords yang ditemukan dan total waktu eksekusi tiap algoritma
  const uniqueKeys = new Set<string>();
  const algorithmTimes = new Map<string, number>();

  // iterasi hasil pencarian yang sudah digabungkan untuk menghitung statistik
  combinedResults.forEach((match) => {
    uniqueKeys.add(match.keyword.toLowerCase());

    const current = algorithmTimes.get(match.algorithm) ?? 0;
    algorithmTimes.set(match.algorithm, Math.max(current, match.executionTime));
  });

  // menghitung total keywords unik dan total waktu eksekusi untuk keseluruhan page
  const totalKeywords = uniqueKeys.size;
  const totalExecutionTime = Array.from(algorithmTimes.values()).reduce(
    (sum, time) => sum + time,
    0,
  );

  // menyimpan statistik hasil pencarian ke dalam storage
  await chrome.storage.local.set({
    judolStats: {
      lastScanTime: Date.now(),
      totalKeywords,
      totalExecutionTime,
      detailedResults: combinedResults,
    },
  });

  console.log("Statistik berhasil disimpan pada storage");
}

// fungsi utk filter hasil pencarian yang tertelan oleh hasil pencarian lain yang lebih panjang
function filterSwallowedMatches(results: SearchResult[]): SearchResult[] {
  const grouped = new Map<number, SearchResult[]>(); // mengelompokkan hasil pencarian berdasarkan startIndex
  results.forEach((match) => {
    const group = grouped.get(match.startIndex) ?? [];
    group.push(match);
    grouped.set(match.startIndex, group);
  });

  const filtered: SearchResult[] = []; // menyimpan hasil pencarian yang sudah difilter

  // iterasi setiap kelompok hasil pencarian yang memiliki startIndex yang sama
  grouped.forEach((matches) => {
    matches.sort((a, b) => b.endIndex - a.endIndex);
    const longest = matches[0];
    if (longest) {
      filtered.push(longest);
    }
  });

  return filtered.sort((a, b) => a.startIndex - b.startIndex);
}

// fungsi utk filter hasil pencarian yang overlap dengan hasil pencarian lain
export function filterOverlappingMatches(
  results: SearchResult[],
): SearchResult[] {
  const sorted = [...results].sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return b.endIndex - a.endIndex;
  });

  const filtered: SearchResult[] = [];
  let maxEnd = -1;

  for (const match of sorted) {
    if (match.endIndex <= maxEnd) {
      continue;
    }

    filtered.push(match);
    if (match.endIndex > maxEnd) {
      maxEnd = match.endIndex;
    }
  }

  return filtered;
}

// fungsi utk menggabungkan hasil pencarian algortima yang sama/overlap
export function mergeOverlappingMatches(
  results: SearchResult[],
): SearchResult[] {
  // edge case: tidak ada hasil pencarian yang ditemukan
  if (results.length === 0) {
    return [];
  }

  // menghitung total execution time and occurrences pada keseluruhan page
  const globalStats: Record<string, { time: number; count: number; comparisons: number }> = {};
  const keywordStats: Record<string, Record<string, number>> = {};
  const matchesByAlgorithm: Record<string, SearchResult[]> = {};

  // iterasi hasil pencarian untuk menghitung total execution time dan occurrences per algoritma
  results.forEach((match) => {
    const existing = globalStats[match.algorithm];
    if (existing) {
      existing.time = Math.max(existing.time, match.executionTime);
      existing.count += match.occurrences;
      existing.comparisons = Math.max(existing.comparisons, match.comparisonCount ?? 0);
    } else {
      globalStats[match.algorithm] = {
        time: match.executionTime,
        count: match.occurrences,
        comparisons: match.comparisonCount ?? 0,
      };
    }

    // mengelompokkan hasil pencarian berdasarkan algoritma
    const bucket = matchesByAlgorithm[match.algorithm];
    if (bucket) {
      bucket.push(match);
    } else {
      matchesByAlgorithm[match.algorithm] = [match];
    }
  });

  // menghitung total occurrences per keyword untuk setiap algoritma
  Object.entries(matchesByAlgorithm).forEach(([algorithm, matches]) => {
    const filtered = filterSwallowedMatches(matches);
    filtered.forEach((match) => {
      const normalizedKeyword = match.keyword.toLowerCase();
      const keywordEntry = keywordStats[normalizedKeyword] ?? {};
      keywordEntry[algorithm] =
        (keywordEntry[algorithm] ?? 0) + match.occurrences;
      keywordStats[normalizedKeyword] = keywordEntry;
    });
  });

  // menggabungkan hasil pencarian overlap
  const sorted = [...results].sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return b.endIndex - a.endIndex;
  });

  const first = sorted[0];
  if (!first) {
    return [];
  }

  const merged: SearchResult[] = [];

  // membuat cluster berdasarkan hasil pencarian pertama
  let currentCluster = {
    startIndex: first.startIndex,
    endIndex: first.endIndex,
    keywords: new Set([first.keyword]),
    algorithms: new Set([first.algorithm]),
  };

  // fungsi utk format cluster pencarian menjadi objek SearchResult
  const finalizeCluster = (cluster: {
    startIndex: number;
    endIndex: number;
    keywords: Set<string>;
    algorithms: Set<string>;
  }): SearchResult => {
    const algorithmArray = Array.from(cluster.algorithms);

    // format total execution times utk tooltip
    const timeDetails = algorithmArray
      .map((alg) => {
        const stats = globalStats[alg];
        const time = stats ? stats.time : 0;
        const comps = stats && stats.comparisons > 0 ? ` (${stats.comparisons} comps)` : '';
        return `${alg}: ${time.toFixed(2)} ms${comps}`;
      })
      .join("<br>");

    // format occurrence details utk tooltip
    const occurrenceMap: Record<string, Record<string, number>> = {};
    const occurrenceDetails = Array.from(cluster.keywords)
      .map((keyword) => {
        const stats = keywordStats[keyword.toLowerCase()] ?? {};
        occurrenceMap[keyword.toLowerCase()] = { ...stats };
        const entries = Object.entries(stats).sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        if (entries.length === 0) {
          return `${keyword}: 0`;
        }

        const details = entries
          .map(([alg, count]) => `${alg}: ${count}`)
          .join(", ");
        return `${keyword}: ${details}`;
      })
      .join("<br>");

    // menghitung total occurrences utk algoritma pada cluster
    const totalOccurrences = algorithmArray.reduce(
      (sum, alg) => sum + (globalStats[alg]?.count ?? 0),
      0,
    );

    return {
      keyword: Array.from(cluster.keywords).join(", "),
      algorithm: algorithmArray.join(", "),
      startIndex: cluster.startIndex,
      endIndex: cluster.endIndex,
      occurrences: totalOccurrences,
      executionTime: 0,
      timeDetails: timeDetails,
      occurrenceDetails: occurrenceDetails,
      occurrenceMap: occurrenceMap,
    };
  };

  // iterasi hasil pencarian dan menggabungkan yang overlap
  for (let i = 1; i < sorted.length; i++) {
    const match = sorted[i];
    if (!match) {
      continue;
    }

    if (match.startIndex <= currentCluster.endIndex) {
      // jika overlap, perluas cluster dan menambahkan keyword - algoritma ke dalam cluster
      currentCluster.endIndex = Math.max(
        currentCluster.endIndex,
        match.endIndex,
      );
      currentCluster.keywords.add(match.keyword);
      currentCluster.algorithms.add(match.algorithm);
    } else {
      // tidak overlap, push cluster yang sudah selesai ke dalam hasil akhir dan buat cluster baru
      merged.push(finalizeCluster(currentCluster));

      currentCluster = {
        startIndex: match.startIndex,
        endIndex: match.endIndex,
        keywords: new Set([match.keyword]),
        algorithms: new Set([match.algorithm]),
      };
    }
  }

  // push cluster terakhir
  merged.push(finalizeCluster(currentCluster));
  return merged;
}

async function processImageOCR(
  img: HTMLImageElement,
  keywordsToSearch: string[],
) {
  if (img.dataset.ocrProcessed === "true") {
    return;
  }
  img.dataset.ocrProcessed = "true";

  const src = img.src || img.getAttribute("src");
  if (!src) return;

  if (src.startsWith("data:image") && src.length < 150) {
    return;
  }

  const startTime = performance.now();

  try {
    const response = await chrome.runtime.sendMessage({
      action: "PERFORM_OCR",
      imageSrc: src,
    });
    const text = response?.text || "";
    if (!text.trim()) return;

    const sentences = detectSentences(text);
    const imageResults: SearchResult[] = [];

    for (const sentence of sentences) {
      const rawResults: SearchResult[] = [];

      rawResults.push(...Matcher.regexSearch(sentence));

      const exactResults: SearchResult[] = [];
      for (const keyword of keywordsToSearch) {
        exactResults.push(...Matcher.kmpSearch(sentence, keyword || ""));
        exactResults.push(
          ...(Matcher.boyerMooreSearch(sentence, keyword) || []),
        );
      }
      rawResults.push(...exactResults);

      const fuzzyResults = fuzzySearch(
        sentence,
        keywordsToSearch,
        exactResults,
      );
      rawResults.push(...fuzzyResults);

      const filteredResults = filterOverlappingMatches(rawResults);
      imageResults.push(...filteredResults);
    }

    if (imageResults.length > 0) {
      img.classList.add("judol-image-matched");

      const { isBlurEnabled } = (await chrome.storage.local.get(
        "isBlurEnabled",
      )) as { isBlurEnabled?: boolean };
      const blurEnabled = isBlurEnabled !== false;

      if (blurEnabled) {
        img.classList.add("is-blurred");
      }

      img.dataset.keyword = Array.from(
        new Set(imageResults.map((r) => r.keyword)),
      ).join(", ");
      img.dataset.algorithm = Array.from(
        new Set(imageResults.map((r) => r.algorithm)),
      ).join(", ");
      img.dataset.occurrences = imageResults.length.toString();

      const executionTime = performance.now() - startTime;
      img.dataset.time = executionTime.toFixed(1);

      imageResults.forEach((res) => {
        res.executionTime = executionTime / imageResults.length;
      });

      await saveResultsToStorage(imageResults, false);
    }
  } catch (error) {
    console.error("Gagal melakukan OCR pada gambar:", src, error);
  }
}

// fungsi utama untuk melakukan scan pada halaman web
async function scanPage(
  rootElement: HTMLElement = document.body,
  isInitialScan: boolean = false,
) {
  // ekstrak teks dari halaman web dan buat mapping antara karakter dengan node teks DOM
  const data = await chrome.storage.local.get("activeDictionary");
  const keywordsToSearch = data.activeDictionary || [];

  // Cari semua gambar (img) di bawah rootElement
  const images: HTMLImageElement[] = [];
  if (rootElement instanceof HTMLImageElement) {
    images.push(rootElement);
  }
  if (rootElement.querySelectorAll) {
    images.push(...Array.from(rootElement.querySelectorAll("img")));
  }

  images.forEach((img) => {
    processImageOCR(img, keywordsToSearch);
  });

  const { flatTextMap, textNodeMap } = buildTextMap(rootElement);

  // jika element baru tidak memiliki teks
  if (flatTextMap.trim() === "") {
    return;
  }

  // hasil pencarian algoritma
  const rawResults: SearchResult[] = [];
  rawResults.push(...Matcher.regexSearch(flatTextMap));

  const exactResults: SearchResult[] = [];
  for (const keyword of keywordsToSearch) {
    exactResults.push(...Matcher.kmpSearch(flatTextMap, keyword || ""));
    exactResults.push(
      ...(Matcher.boyerMooreSearch(flatTextMap, keyword) || []),
    );
  }
  rawResults.push(...exactResults);

  rawResults.push(...ahoCorasickSearch(flatTextMap, keywordsToSearch));
  rawResults.push(...rabinKarpSearch(flatTextMap, keywordsToSearch));

  const fuzzyResults = fuzzySearch(flatTextMap, keywordsToSearch, exactResults);
  rawResults.push(...fuzzyResults);
  // merge hasil pencarian overlap
  const mergedResults = mergeOverlappingMatches(rawResults);

  // highlight & blur
  const { isBlurEnabled } = (await chrome.storage.local.get(
    "isBlurEnabled",
  )) as { isBlurEnabled?: boolean };
  const blurEnabled = isBlurEnabled === true;

  const reversedResults = [...mergedResults].reverse();
  reversedResults.forEach((match) =>
    Highlighter.applyHighlight(match, textNodeMap, blurEnabled),
  );

  // save hasil pencarian ke storage utk ditampilkan di popup
  await saveResultsToStorage(rawResults, isInitialScan);
}

// MutationObserver utk mendeteksi perubahan pada DOM
// utk menangani scrolling pada halaman web
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      // hanya memproses HTML tags
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        // mencegah infinite loop
        if (
          element.classList &&
          (element.classList.contains("judol-highlight") ||
            element.id === "judol-modern-tooltip" ||
            element.closest("#judol-modern-tooltip"))
        ) {
          continue;
        }

        scanPage(element, false);
      }
    }
  }
});

// fungsi utk mengaktifkan blur secara default saat extension pertama kali dijalankan
async function enableDefaultBlur() {
  const { isBlurEnabled } = (await chrome.storage.local.get(
    "isBlurEnabled",
  )) as {
    isBlurEnabled?: boolean;
  };

  if (typeof isBlurEnabled !== "boolean") {
    await chrome.storage.local.set({ isBlurEnabled: true });
  }
}

// main
console.log("Memulai Judol Detector...");
(async () => {
  await enableDefaultBlur();
  await scanPage(document.body, true);
  observer.observe(document.body, { childList: true, subtree: true });
})();
