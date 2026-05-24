import type { SearchResult } from "../interface.js";
import "../styles/content.css";
import { buildTextMap } from "../content/dom_walker.js";
import { Highlighter } from "../content/highlight.js";
import { Matcher } from "../algorithms/algorithm.js";
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
    console.log(`Blur state: ${message.blurState}`);
    sendResponse({ status: "success" });
  }

  // pesan yang diterima adalah perintah rescan halaman web
  else if (message.command === "MANUAL_RESCAN") {
    console.log("Manual re-scanning...");

    // menghapus semua highlight yang ada di halaman web
    Highlighter.removeAllHighlights();

    // scan ulang halaman web
    scanPage(document.body, true);

    sendResponse({ status: "Rescan initiated" });
  }

  return false;
});

// tooltip saat hover pada hasil highlight
const tooltip = document.createElement("div");
tooltip.id = "judol-tooltip";
tooltip.style.position = "absolute";
tooltip.style.display = "none";
tooltip.style.backgroundColor = "#333";
tooltip.style.color = "#fff";
tooltip.style.padding = "8px";
tooltip.style.borderRadius = "4px";
tooltip.style.zIndex = "999999";
document.body.appendChild(tooltip);

// event listener untuk menampilkan tooltip saat hover pada hasil highlight
document.addEventListener("mouseover", (event) => {
  const target = event.target as HTMLElement;

  if (target.classList.contains("judol-highlight")) {
    // komponen tooltip
    tooltip.innerHTML = `
            <strong>Keyword:</strong> ${target.dataset.keyword} <br>
            <strong>Algorithm:</strong> ${target.dataset.algorithm} <br>
            <strong>Occurrences:</strong> ${target.dataset.occurrences} <br>
            <strong>Time:</strong> ${target.dataset.time} ms
        `;

    // posisi berada di kanan mouse pointer
    tooltip.style.left = `${event.pageX + 15}px`;
    tooltip.style.top = `${event.pageY + 15}px`;
    tooltip.style.display = "block";
  }
});

// event listener saat mouse keluar dari hasil highlight
document.addEventListener("mouseout", (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("judol-highlight")) {
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

  // menghitung total keywords yang ditemukan dan total waktu eksekusi dari semua hasil pencarian
  const totalKeywords = combinedResults.reduce(
    (sum, match) => sum + match.occurrences,
    0,
  );
  const totalExecutionTime = combinedResults.reduce(
    (sum, match) => sum + match.executionTime,
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

// fungsi utama untuk melakukan scan pada halaman web
async function scanPage(
  rootElement: HTMLElement = document.body,
  isInitialScan: boolean = false,
) {
  // ekstrak teks dari halaman web dan buat mapping antara karakter dengan node teks DOM
  const data = await chrome.storage.local.get("activeDictionary");
  const keywordsToSearch = data.activeDictionary || [];
  const { flatTextMap, textNodeMap } = buildTextMap(rootElement);

  // jika element baru tidak memiliki teks
  if (flatTextMap.trim() === "") {
    return;
  }

  // hasil pencarian algoritma
  const rawResults: SearchResult[] = [];

  rawResults.push(...Matcher.regexSearch(flatTextMap));

  for (const keyword of keywordsToSearch) {
    rawResults.push(...Matcher.kmpSearch(flatTextMap, keyword || ""));
    rawResults.push(...(Matcher.boyerMooreSearch(flatTextMap, keyword) || []));
  }

  // filter hasil pencarian overlap
  const filteredResults = filterOverlappingMatches(rawResults);

  // Highlight & blur DOM
  const { isBlurEnabled } = (await chrome.storage.local.get(
    "isBlurEnabled",
  )) as { isBlurEnabled?: boolean };
  const blurEnabled = isBlurEnabled === true;
  // highlight dari kiri ke kanan
  const reversedResults = [...filteredResults].reverse();
  reversedResults.forEach((match) =>
    Highlighter.applyHighlight(match, textNodeMap, blurEnabled),
  );

  // Save to Storage
  await saveResultsToStorage(filteredResults, isInitialScan);
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
          element.classList.contains("judol-highlight")
        ) {
          continue;
        }

        scanPage(element, false);
      }
    }
  }
});

// main
console.log("Memulai Judol Detector...");
scanPage(document.body, true).then(() => {
  observer.observe(document.body, { childList: true, subtree: true });
});
