import type { StorageData, ChartData } from '../interface.js';

// event listener untuk load data statistik saat popup dibuka
document.addEventListener('DOMContentLoaded', async () => {
    // membaca data statistik dari storage
    const data = await chrome.storage.local.get('judolStats') as StorageData;

    // menampilkan statistik pada popup
    renderStatistics(data.judolStats);
});

// fungsi visualisasi perbandingan hasil pencarian algoritma
function drawComparisonChart(statsArray: ChartData[]) {
    // ambil elemen canvas dari DOM
    const canvas = document.getElementById('statsChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // setup canvas
    const dpr = window.devicePixelRatio || 1;
    const width = 300; 
    const height = 200;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // perhitungan tinggi bar
    const maxMatches = Math.max(...statsArray.map(s => s.value), 1);
    const chartHeight = 150; 
        
    // perhitungan lebar dan posisi X untuk setiap bar
    const totalBars = statsArray.length;
    const padding = 20;
    const availableWidth = width - (padding * 2);
    const barWidth = (availableWidth / totalBars) - 15;

    // iterasi untuk menggambar setiap bar dan labelnya
    statsArray.forEach((stat, index) => {
        // perhitungan tinggi bar
        const pixelHeight = (stat.value / maxMatches) * chartHeight;
        const xPosition = padding + (index * (availableWidth / totalBars));
            
        // paint Bar
        ctx.fillStyle = stat.color;
        ctx.fillRect(xPosition, height - pixelHeight - 25, barWidth, pixelHeight);
        
        // paint Text
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // perhitungan posisi X untuk teks agar berada di tengah bar
        const textCenterX = xPosition + (barWidth / 2);
        ctx.fillText(`${stat.label}: ${stat.value}`, textCenterX, height - 5);
    });
}

// fungsi utk render dashboard
export function renderStatistics(stats?: StorageData['judolStats']) {
    // mengambil elemen DOM untuk menampilkan total keywords dan waktu eksekusi tiap algoritma
    const totalCountElement = document.getElementById('total-count');
    const timeKmpEl = document.getElementById('time-kmp');
    const timeBmEl = document.getElementById('time-bm');
    const timeRegexEl = document.getElementById('time-regex');
    const timeLevEl = document.getElementById('time-lev');

    // edge case: jika tidak ada data statistik yang ditemukan
    if (!stats) {
        if (totalCountElement) totalCountElement.textContent = "No scan data found. Please refresh the page!";
        return;
    }
    if (totalCountElement) totalCountElement.textContent = stats.totalKeywords.toString();
    
    // waktu eksekusi tiap algoritma: penjumlahan waktu eksekusi dari semua hasil pencarian yang menggunakan algoritma tersebut
    const kmpTime = stats.detailedResults
        .filter(result => result.algorithm === 'KMP')
        .reduce((sum, result) => sum + result.executionTime, 0);
        
    const bmTime = stats.detailedResults
        .filter(result => result.algorithm === 'BM')
        .reduce((sum, result) => sum + result.executionTime, 0);
        
    const regexTime = stats.detailedResults
        .filter(result => result.algorithm === 'Regex')
        .reduce((sum, result) => sum + result.executionTime, 0);
        
    const levTime = stats.detailedResults
        .filter(result => result.algorithm === 'Levenshtein')
        .reduce((sum, result) => sum + result.executionTime, 0);

    if (timeKmpEl) timeKmpEl.textContent = kmpTime.toFixed(2);
    if (timeBmEl) timeBmEl.textContent = bmTime.toFixed(2);
    if (timeRegexEl) timeRegexEl.textContent = regexTime.toFixed(2);
    if (timeLevEl) timeLevEl.textContent = levTime.toFixed(2);

    // data untuk chart perbandingan hasil pencarian algoritma
    const kmpMatches = stats.detailedResults
        .filter(result => result.algorithm === 'KMP')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const bmMatches = stats.detailedResults
        .filter(result => result.algorithm === 'BM')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const regexMatches = stats.detailedResults
        .filter(result => result.algorithm === 'Regex')
        .reduce((sum, result) => sum + result.occurrences, 0);
    const levMatches = stats.detailedResults
        .filter(result => result.algorithm === 'Levenshtein')
        .reduce((sum, result) => sum + result.occurrences, 0);

    const chartData: ChartData[] = [
        { label: 'KMP', value: kmpMatches, color: '#3498db' },
        { label: 'BM', value: bmMatches, color: '#e74c3c' },
        { label: 'RegEx', value: regexMatches, color: '#2ecc71' },
        { label: 'Lev', value: levMatches, color: '#f1c40f' }
    ];

    drawComparisonChart(chartData);
}

// listener real-time untuk mendeteksi perubahan pada storage dan mengupdate popup jika diperlukan
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: chrome.storage.AreaName) => {
    if (namespace === 'local' && changes.judolStats) {
        const newStats = changes.judolStats.newValue;
        renderStatistics(newStats);
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
            rescanBtn.textContent = 'Rescan Halaman';
            rescanBtn.style.backgroundColor = '#3498db';
        }, 800);
    });
}