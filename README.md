# Judol Detector | Browser Extension

> Tugas Besar 3 IF2211 Strategi Algoritma  
> Institut Teknologi Bandung | Semester Genap 2025/2026

Judol Detector adalah ekstensi browser berbasis Chromium yang mendeteksi konten judi online (*judol*) pada halaman web secara otomatis menggunakan berbagai algoritma *string matching*. Keyword yang terdeteksi akan di-highlight langsung di halaman, dilengkapi tooltip statistik dan fitur blur. Ekstensi juga mendukung OCR untuk mendeteksi keyword pada gambar.

---

## Daftar Isi

- [Fitur](#fitur)
- [Algoritma](#algoritma)
- [Struktur Proyek](#struktur-proyek)
- [Requirement](#requirement)
- [Instalasi dan Build](#instalasi-dan-build)
- [Cara Load Extension di Chrome](#cara-load-extension-di-chrome)
- [Cara Penggunaan](#cara-penggunaan)
- [Anggota Kelompok](#anggota-kelompok)

---

## Fitur

- **Exact Matching** : deteksi keyword eksak menggunakan KMP, Boyer-Moore, dan Aho-Corasick
- **Pattern Matching** : deteksi pola `<kata><angka>` (seperti `SLOT99`) menggunakan Regex dan Rabin-Karp
- **Fuzzy Matching** : deteksi manipulasi visual (*leetspeak* dan homoglyph unicode) menggunakan Weighted Levenshtein Distance
- **OCR** : deteksi keyword pada gambar di halaman web menggunakan Tesseract.js (berjalan secara offline)
- **Highlight & Blur** : visualisasi keyword terdeteksi langsung di DOM tanpa merusak layout halaman
- **Tooltip** : menampilkan detail hasil deteksi (keyword, algoritma, jumlah kemunculan, waktu eksekusi) saat hover
- **Popup Statistik** : menampilkan total keyword, waktu eksekusi per algoritma, dan grafik perbandingan
- **Rescan** : memindai ulang halaman tanpa perlu refresh
- **MutationObserver** : mendukung halaman dengan infinite scroll (Twitter/X, Instagram, dll.)

---

## Algoritma

### Exact Matching

| Algoritma | Deskripsi | Kompleksitas |
|---|---|---|
| **KMP** (Knuth-Morris-Pratt) | Pencarian eksak dengan failure function untuk menghindari perbandingan ulang | O(n + m) |
| **Boyer-Moore** | Pencarian eksak dari kanan ke kiri dengan bad character heuristic | O(n/m) best case |
| **Aho-Corasick** *(bonus)* | Multi-pattern matching dengan trie automaton dan failure links — scan teks sekali untuk semua keyword | O(n + z) |

### Pattern Matching

| Algoritma | Deskripsi | Kompleksitas |
|---|---|---|
| **Regex** | Menangkap pola `<kata><angka>` menggunakan JavaScript regex engine | O(n) |
| **Rabin-Karp** *(bonus)* | Pencarian berbasis rolling hash polynomial | O(n) average |

### Fuzzy Matching

| Algoritma | Deskripsi | Kompleksitas |
|---|---|---|
| **Weighted Levenshtein** | Mendeteksi manipulasi visual dengan bobot substitusi 0.2 untuk pasangan karakter mirip (O↔0, A↔4, I↔1, M↔Μ, dll.) | O(n·m) per pasang |

Semua algoritma diimplementasikan **from scratch** tanpa menggunakan `string.includes()`, `string.indexOf()`, atau library string matching eksternal.

---

## Struktur Proyek

```
Tubes3_kakeguruistimashou/
├── dist/                         # Hasil build siap di-load di Chrome
├── doc/
│   └── kakeguruistimashou.pdf    # Laporan
├── keywords/
│   └── keywords.txt              # Daftar keyword judol
├── public/
│   ├── tesseract/                # Library Tesseract.js lokal (offline OCR)
│   │   ├── eng.traineddata.gz
│   │   ├── tesseract-core.wasm
│   │   ├── tesseract-core.wasm.js
│   │   └── worker.min.js
│   ├── manifest.json             # Manifest V3 Chrome Extension
│   └── offscreen.html            # Offscreen Document untuk Tesseract.js
├── src/
│   ├── algorithms/
│   │   ├── algorithm.ts          # KMP, Boyer-Moore, Regex
│   │   ├── bonus.ts              # Aho-Corasick, Rabin-Karp
│   │   └── fuzzy.ts              # Weighted Levenshtein Distance
│   ├── background/
│   │   ├── background.ts         # Service worker: load keywords, OCR bridge
│   │   └── offscreen.ts          # Offscreen script untuk Tesseract.js
│   ├── content/
│   │   ├── content.ts            # Logic utama: scan, highlight, tooltip, OCR
│   │   ├── dom_walker.ts         # TreeWalker: ekstraksi node teks DOM
│   │   └── highlight.ts          # Highlight & blur keyword di DOM
│   ├── ocr/
│   │   └── ocr.ts                # Helper inisialisasi Tesseract.js
│   ├── popup/
│   │   ├── popup.html            # UI popup statistik
│   │   └── popup.ts              # Logic popup
│   ├── styles/
│   │   ├── content.css           # Style highlight, blur, tooltip
│   │   └── popup.css             # Style popup
│   ├── interface.ts              # Definisi interface TypeScript
│   └── vite-env.d.ts
├── test/
│   ├── fuzzy-normal.html         # Test case fuzzy matching & unicode homoglyph
│   └── testcases.html            # Test case lengkap semua algoritma
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Requirement

- **Node.js** v18 atau lebih baru
- **npm** v9 atau lebih baru
- **Google Chrome** / Chromium browser

---

## Instalasi dan Build

**1. Clone repositori**

```bash
git clone https://github.com/aufafaza/Tubes3_kakeguruistimashou.git
cd Tubes3_kakeguruistimashou
```

**2. Install dependencies**

```bash
npm install
```

**3. Build extension**

```bash
npm run build
```

Hasil build akan berada di folder `dist/` dan siap di-load ke Chrome.

---

## Cara Load Extension di Chrome

1. Buka Chrome dan masuk ke `chrome://extensions/`
2. Aktifkan **Developer mode** (toggle pojok kanan atas)
3. Klik **Load unpacked**
4. Pilih folder `dist/` hasil build
5. Extension **Judol Detector** akan muncul di toolbar Chrome

---

## Cara Penggunaan

### Pemindaian Otomatis
Extension berjalan otomatis saat membuka halaman web. Keyword yang terdeteksi langsung di-highlight dengan warna kuning.

### Tooltip
Arahkan kursor ke kata yang di-highlight untuk melihat detail deteksi: keyword, algoritma yang mendeteksi, jumlah kemunculan, dan waktu eksekusi.

### Popup Statistik
Klik ikon extension di toolbar Chrome untuk membuka popup yang menampilkan:
- Total keyword terdeteksi di halaman
- Waktu eksekusi per algoritma (KMP, BM, Regex, Levenshtein, Aho-Corasick, Rabin-Karp)
- Grafik perbandingan jumlah match per algoritma
- Toggle aktifkan/nonaktifkan fitur blur
- Toggle aktifkan/nonaktifkan algoritma bonus (Aho-Corasick dan Rabin-Karp)
- Tombol **Rescan Page** untuk memindai ulang halaman

### OCR
Gambar pada halaman web yang mengandung keyword judol akan otomatis di-blur oleh fitur OCR berbasis Tesseract.js yang berjalan secara offline.

### Menambah Keyword
Edit file `keywords/keywords.txt`, satu keyword per baris, lalu build ulang extension.

---

| Nama | NIM |
|---|---|
| Aufa Rienaldifaza Ahmad | 13524027 |
| Yavie Azka Putra Araly | 13524077 |
| Muhammad Dzaky Atha F. | 18223124 |

---

<p align="center">
  Institut Teknologi Bandung · IF2211 Strategi Algoritma · 2025/2026
</p>
