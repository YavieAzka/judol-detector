import type { StorageData, ChartData, SearchResult } from '../interface.js';

// event listener untuk load data statistik saat popup dibuka
document.addEventListener('DOMContentLoaded', async () => {
    // mengambil data statistik hasil pencarian dan state toggle dari storage
    const data = await chrome.storage.local.get({
        judolStats: null,
        isBlurEnabled: false,
        useAhoCorasick: false,
        useRabinKarp: false
    }) as {
        judolStats: StorageData['judolStats'] | null;
        isBlurEnabled: boolean;
        useAhoCorasick: boolean;
        useRabinKarp: boolean;
    };

    if (blurToggle) blurToggle.checked = data.isBlurEnabled;
    if (acToggle) acToggle.checked = data.useAhoCorasick;
    if (rkToggle) rkToggle.checked = data.useRabinKarp;

    // menampilkan statistik pada popup
    await renderStatistics(data.judolStats ?? undefined);
});

// fungsi visualisasi perbandingan hasil pencarian algoritma
function drawComparisonChart(statsArray: ChartData[]) {
    // canvas setup utk visualisasi bar chart
    const canvas = document.getElementById('statsChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // tinggi bar chart berdasarkan jumlah kemunculan keyword terbanyak
    const maxMatches = Math.max(...statsArray.map(s => s.value), 1);
    const chartHeight = Math.max(60, height - 50);
    const totalBars = Math.max(statsArray.length, 1);
    const padding = 4;
    const gap = 8;
    const availableWidth = width - (padding * 2) - gap * (totalBars - 1);
    const barWidth = Math.max(18, availableWidth / totalBars);

    // iterasi setiap algoritma dan gambar bar chart untuk jumlah kemunculan keyword yang ditemukan
    statsArray.forEach((stat, index) => {
        const pixelHeight = (stat.value / maxMatches) * chartHeight;
        const xPosition = padding + index * (barWidth + gap);
        const baseY = height - 32;

        ctx.fillStyle = stat.color;
        ctx.fillRect(xPosition, baseY - pixelHeight, barWidth, pixelHeight);

        ctx.fillStyle = '#0f172a';
        ctx.font = '11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';

        const textCenterX = xPosition + (barWidth / 2);
        ctx.fillText(stat.label, textCenterX, height - 10);
        ctx.fillText(`${stat.value}`, textCenterX, baseY - pixelHeight - 6);
    });
}

// fungsi utk menampilkan statistik hasil pencarian pada popup
export async function renderStatistics(stats?: StorageData['judolStats']) {
    // elemen-elemen DOM yang akan diupdate dengan data statistik
    const totalCountElement = document.getElementById('total-count');
    const totalTimeElement = document.getElementById('execution-time');
    const keywordListElement = document.getElementById('keyword-list');
    const keywordCountElement = document.getElementById('keyword-count');

    // tidak ada data statistik
    if (!stats) {
        if (totalCountElement) totalCountElement.textContent = 'No scan data';
        return;
    }

    // filter hasil pencarian berdasarkan state toggle algoritma Aho-Corasick dan Rabin-Karp
    const { useAhoCorasick, useRabinKarp } = await chrome.storage.local.get({
        useAhoCorasick: false,
        useRabinKarp: false
    }) as { useAhoCorasick: boolean; useRabinKarp: boolean };
    
    const filteredResults = stats.detailedResults.filter((result) => {
        if (result.algorithm === 'AhoCorasick' && !useAhoCorasick) return false;
        if (result.algorithm === 'RabinKarp' && !useRabinKarp) return false;
        return true;
    });

    // jumlah keyword unik yang ditemukan dari hasil pencarian
    const uniqueKeywords = new Set(
        filteredResults.map(result => result.keyword.toLowerCase())
    );
    if (totalCountElement) totalCountElement.textContent = uniqueKeywords.size.toString();

    // mendapatkan waktu eksekusi setiap algoritma dari hasil pencarian
    const getAlgorithmTime = (algorithm: string) => {
        const times = filteredResults
            .filter(result => result.algorithm === algorithm)
            .map(result => result.executionTime);
        return times.length > 0 ? Math.max(...times) : 0;
    };

    // mendapatkan jumlah perbandingan setiap algoritma dari hasil pencarian
    const getAlgorithmComparisons = (algorithm: string) => {
        const comps = filteredResults
            .filter(result => result.algorithm === algorithm)
            .map(result => result.comparisonCount ?? 0);
        return comps.length > 0 ? Math.max(...comps) : 0;
    };

    // update elemen DOM dengan waktu eksekusi setiap algoritma
    const kmpTime = getAlgorithmTime('KMP');
    const kmpComps = getAlgorithmComparisons('KMP');
    const bmTime = getAlgorithmTime('BM');
    const bmComps = getAlgorithmComparisons('BM');
    const regexTime = getAlgorithmTime('Regex');
    const levTime = getAlgorithmTime('Levenshtein');
    const acTime = useAhoCorasick ? getAlgorithmTime('AhoCorasick') : 0;
    const acComps = useAhoCorasick ? getAlgorithmComparisons('AhoCorasick') : 0;
    const rkTime = useRabinKarp ? getAlgorithmTime('RabinKarp') : 0;
    const rkComps = useRabinKarp ? getAlgorithmComparisons('RabinKarp') : 0;

    if (totalTimeElement) {
        const timeRows = [
            `<div class="time-row"><span>KMP</span><span>${kmpTime.toFixed(2)} ms${kmpComps > 0 ? ` (${kmpComps} comps)` : ''}</span></div>`,
            `<div class="time-row"><span>BM</span><span>${bmTime.toFixed(2)} ms${bmComps > 0 ? ` (${bmComps} comps)` : ''}</span></div>`,
            `<div class="time-row"><span>Regex</span><span>${regexTime.toFixed(2)} ms</span></div>`,
            `<div class="time-row"><span>Lev</span><span>${levTime.toFixed(2)} ms</span></div>`
        ];
        if (useAhoCorasick) {
            timeRows.push(`<div class="time-row"><span>AC</span><span>${acTime.toFixed(2)} ms${acComps > 0 ? ` (${acComps} comps)` : ''}</span></div>`);
        }
        if (useRabinKarp) {
            timeRows.push(`<div class="time-row"><span>RK</span><span>${rkTime.toFixed(2)} ms${rkComps > 0 ? ` (${rkComps} comps)` : ''}</span></div>`);
        }
        totalTimeElement.innerHTML = timeRows.join('');
    }

    // jumlah kemunculan keyword yang ditemukan untuk setiap algoritma
    const kmpMatches = filteredResults
        .filter(result => result.algorithm === 'KMP')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const bmMatches = filteredResults
        .filter(result => result.algorithm === 'BM')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const regexMatches = filteredResults
        .filter(result => result.algorithm === 'Regex')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const levMatches = filteredResults
        .filter(result => result.algorithm === 'Levenshtein')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const acMatches = useAhoCorasick
        ? filteredResults
            .filter(result => result.algorithm === 'AhoCorasick')
            .reduce((sum, result) => sum + result.occurrences, 0)
        : 0;
    const rkMatches = useRabinKarp
        ? filteredResults
            .filter(result => result.algorithm === 'RabinKarp')
            .reduce((sum, result) => sum + result.occurrences, 0)
        : 0;

    // data utk visualisasi perbandingan jumlah kemunculan keyword yang ditemukan untuk setiap algoritma
    const chartData: ChartData[] = [
        { label: 'KMP', value: kmpMatches, color: '#3498db' },
        { label: 'BM', value: bmMatches, color: '#e74c3c' },
        { label: 'RegEx', value: regexMatches, color: '#2ecc71' },
        { label: 'Lev', value: levMatches, color: '#f1c40f' }
    ];
    if (useAhoCorasick) {
        chartData.push({ label: 'AC', value: acMatches, color: '#9b59b6' });
    }
    if (useRabinKarp) {
        chartData.push({ label: 'RK', value: rkMatches, color: '#34495e' });
    }

    drawComparisonChart(chartData);

    // daftar keyword yang ditemukan beserta jumlah kemunculannya, diurutkan dari yang paling sering muncul
    if (keywordListElement) {
        const keywordCounts = buildKeywordCounts(filteredResults);
        const maxCount = Math.max(...keywordCounts.map(item => item.count), 1);
        keywordListElement.innerHTML = '';
        if (keywordCountElement) {
            keywordCountElement.textContent = keywordCounts.length.toString();
        }

        keywordCounts.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'keyword-item';
            const width = (item.count / maxCount) * 100;
            row.innerHTML = `
                <div class="keyword-row">
                    <span class="keyword-name">${item.keyword}</span>
                    <span class="keyword-count">${item.count}</span>
                </div>
                <div class="keyword-bar">
                    <span class="keyword-bar-fill" style="width: ${width}%;"></span>
                </div>
            `;
            keywordListElement.appendChild(row);
        });
    }
}

// listener real-time untuk mendeteksi perubahan pada storage dan mengupdate popup jika diperlukan
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: chrome.storage.AreaName) => {
    if (namespace === 'local' && changes.judolStats) {
        const newStats = changes.judolStats.newValue;
        void renderStatistics(newStats);
    }
});

// event listener utk toggle efek blur pada hasil highlight di halaman web
const blurToggle = document.getElementById('blur-toggle') as HTMLInputElement | null;
if (blurToggle) {
    blurToggle.addEventListener('change', async (event) => {
        const isEnabled = (event.target as HTMLInputElement).checked;

        // mencari tab aktif saat ini
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // mengirim pesan ke content script untuk toggle efek blur pada hasil highlight
        if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, {
                command: "TOGGLE_BLUR",
                blurState: isEnabled
            }).catch(() => {});
        }

        // edge case: save state toggle blur ke storage
        // agar saat user membuka popup kembali, state toggle blur bisa tetap sesuai dengan preferensi terakhir
        chrome.storage.local.set({ isBlurEnabled: isEnabled });
    });
}

// event listener utk toggle opsional algoritma Aho-Corasick dan Rabin-Karp
const acToggle = document.getElementById('ac-toggle') as HTMLInputElement | null;
const rkToggle = document.getElementById('rk-toggle') as HTMLInputElement | null;

const refreshStats = async () => {
    const data = await chrome.storage.local.get('judolStats') as StorageData;
    await renderStatistics(data.judolStats);
};

acToggle?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ useAhoCorasick: (e.target as HTMLInputElement).checked });
    await refreshStats();
});

rkToggle?.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ useRabinKarp: (e.target as HTMLInputElement).checked });
    await refreshStats();
});

// event listener untuk tombol rescan halaman web dengna algoritma pencarian
const rescanBtn = document.getElementById('rescan-btn') as HTMLButtonElement | null;
if (rescanBtn) {
    rescanBtn.addEventListener('click', async () => {
        rescanBtn.disabled = true;
        rescanBtn.textContent = 'Scanning...';
        rescanBtn.style.backgroundColor = '#95a5a6';

        // mencari tab aktif saat ini
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
            // mengirim pesan ke content script untuk melakukan rescan halaman web
            chrome.tabs.sendMessage(activeTab.id, { command: "MANUAL_RESCAN" })
                .catch(() => {});
        }

        // reset button setelah delay utk memberi waktu bagi content script melakukan scan dan update hasilnya di storage
        setTimeout(() => {
            rescanBtn.disabled = false;
            rescanBtn.textContent = 'Rescan Page';
            rescanBtn.style.backgroundColor = '#3498db';
        }, 800);
    });
}

// fungsi utk menghitung jumlah kemunculan keyword dari hasil pencarian
function buildKeywordCounts(results: SearchResult[]) {
    const keywordMap = new Map<string, Set<string>>();

    // iterasi setiap hasil pencarian dan membuat map keyword dengan posisi unik utk menghitung jumlah kemunculan yang sebenarnya
    results.forEach((result) => {
        const keyword = result.keyword.toLowerCase();
        const positionKey = `${result.startIndex}:${result.endIndex}`;
        const positions = keywordMap.get(keyword) ?? new Set<string>();
        positions.add(positionKey);
        keywordMap.set(keyword, positions);
    });

    // mengubah map menjadi array dengan format { keyword, count } dan mengurutkannya berdasarkan jumlah kemunculan terbanyak
    return Array.from(keywordMap.entries())
        .map(([keyword, positions]) => ({ keyword, count: positions.size }))
        .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
}
