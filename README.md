# 🛵 KendaraTrack - Manajemen Kendaraan & Pengingat Finansial Pribadi

Aplikasi web mobile-first modern, responsif, dan elegan untuk pencatatan aktivitas kendaraan bermotor pribadi (motor & mobil), pelacakan pengeluaran & pemasukan operasional, log servis berkala & penggantian sparepart, serta kalender interaktif pengingat jatuh tempo pajak STNK, perpanjangan SIM, dan cicilan leasing.

Dirancang khusus dengan estetika **Finora Emerald UI Design System**:
- **Background:** Soft Off-White (`#F8FAFC`)
- **Card / Surface:** Pure White (`#FFFFFF`) dengan border halus (`#E2E8F0`) dan soft elevation shadow
- **Aksen Utama:** Linear Gradient Deep Emerald Green (`#0F5132`) ke Forest Green (`#198754`)
- **Aksen Sekunder:** Mint Green (`#DCFCE7`), Soft Amber (`#FEF3C7`), Soft Red (`#FEE2E2`), Pastel Blue/Purple
- **Tipografi:** Google Font `'Plus Jakarta Sans'`

---

## 📁 Struktur Berkas Proyek

```
kendaratrack/
├── index.html                  # File utama aplikasi (SPA responsif mobile & frame desktop)
├── css/
│   └── styles.css              # Custom styling Finora, scrollbars, gradients, elevations
├── js/
│   ├── app.js                  # Main Application Controller, state, tab navigation, modals
│   ├── calendar.js             # Interactive Calendar Component (monthly grid, colored dots, agenda)
│   ├── charts.js               # Visualisasi Chart.js (Bar 6-Bulan & Donut Kategori)
│   ├── seedData.js             # Data awal realistis Indonesia (Vario 160 & Avanza 1.5G)
│   └── utils.js                # Formatter Rupiah, KM, Tanggal Indonesia, Kalkulasi KM/L & Oli
├── services/
│   └── api.js                  # Centralized Data Layer (Repository/Adapter: LOCAL, GAS, SUPABASE)
├── backend/
│   ├── Code.gs                 # Google Apps Script siap deploy (RESTful JSON API untuk Sheets)
│   └── supabase_schema.sql     # Skema database Supabase PostgreSQL + RLS + Seed Data
├── vercel.json                 # Konfigurasi deployment instan Vercel
└── README.md                   # Dokumentasi lengkap & panduan implementasi
```

---

## 🌟 Fitur Utama & Layar Aplikasi

### 1. Home Screen (Beranda)
- **Top Greeting & Garasi Switcher:** Sambutan *"Halo, Pengendara!"* dilengkapi dropdown switcher kendaraan aktif (contoh: `Honda Vario 160 • L 1234 AB` atau `Toyota Avanza 1.5G • B 2345 CDE`).
- **Emerald Gradient Hero Card:**
  - Total Pengeluaran Bulan Ini (dihitung otomatis dari transaksi bulan berjalan).
  - Pemasukan Bulan Ini (badge hijau untuk reimbursement kantor atau transport).
  - Odometer Terkini dengan tombol inline **"+ Update KM"** cepat.
- **4 Aksi Cepat (Quick Action Buttons):**
  - `+ Transaksi` (Catat pengeluaran/pemasukan baru)
  - `+ Ganti Oli` (Catat ganti oli mesin/gardan & auto update status oli)
  - `+ Sparepart` (Catat part baru, merk, garansi & biaya)
  - `+ Jadwal` (Buat pengingat jatuh tempo baru)
- **Pengingat Terdekat (Alert Cards):** Countdown sisa hari & sisa KM untuk Ganti Oli Mesin, Pajak STNK Tahunan, Masa Berlaku SIM C/A, dan Cicilan Kendaraan.
- **Aktivitas Terbaru:** Riwayat transaksi kas terkini dengan ikon pastel dan nominal +/-.

### 2. Kalender Screen (Jadwal & Pengingat)
- **Grid Kalender Bulanan Interaktif:**
  - Navigasi bulan (Sebelumnya, Hari Ini, Selanjutnya).
  - Indikator titik berwarna (*colored dot badges*) pada tanggal jatuh tempo:
    - 🟢 **Titik Hijau:** Ganti Oli / Servis Rutin
    - 🟡 **Titik Amber:** Cicilan Leasing / Asuransi
    - 🔴 **Titik Merah:** Pajak STNK Tahunan / 5 Tahunan / Perpanjangan SIM
- **Daftar Agenda Terfilter:**
  - Klik tanggal untuk memfilter agenda khusus tanggal tersebut atau lihat seluruh bulan.
  - Tab status: `[Semua]`, `[Belum Selesai]`, `[Selesai]`.
- **Fitur "Selesai & Bayar":**
  - Mengklik tombol ini otomatis membuka modal pembayaran terisi (*pre-filled*).
  - Saat dikonfirmasi, otomatis mencatat pengeluaran kas, menandai jadwal selesai, dan **men-generate jadwal periode berikutnya secara otomatis** (+12 bulan untuk STNK tahunan, +60 bulan untuk SIM/Plat 5 tahunan, +1 bulan untuk cicilan, atau interval KM untuk oli).

### 3. Transaksi Screen (Kas Masuk & Keluar)
- Filter tipe transaksi: `[Semua]`, `[Pemasukan]`, `[Pengeluaran]`.
- Filter kategori & kolom pencarian teks instan (*real-time search*).
- **Strip Ringkasan Finansial:** Total Masuk, Total Keluar, dan Selisih Bersih (*Net Cashflow*).
- Pengelompokan transaksi berdasarkan tanggal (*"Hari Ini"*, *"Kemarin"*, *"20 Nov 2026"*).
- **Kalkulasi Efisiensi BBM (KM/Liter):** Saat menginput BBM (Liter, Harga/Liter, Odometer), sistem otomatis menghitung rasio keiritan bahan bakar dibandingkan pengisian sebelumnya.
- Opsi Edit & Hapus transaksi.

### 4. Servis & Part Screen (Oli, Sparepart & Dokumen)
- **Indikator Kesehatan Oli (Oil Health Tracker Card):**
  - Visual *progress bar* dinamis (Hijau bila > 1000 KM, Amber bila < 500 KM, Merah bila lewat jatuh tempo).
  - Menampilkan sisa KM (contoh: *"Sisa 750 KM lagi"*), target KM, merk/viskositas oli terakhir, dan tanggal penggantian.
  - Tombol aksi: `+ Catat Ganti Oli Baru`.
- **Timeline Riwayat Sparepart:**
  - Garis waktu vertikal komponen terpasang (Nama part, merk, odometer pasang, biaya, dan masa garansi/usia pakai).
  - Tombol aksi: `+ Tambah Part`.
- **Kartu Dokumen & Legalitas Kendaraan:**
  - Plat Nomor terdaftar.
  - Masa berlaku Pajak Tahunan STNK (dengan badge countdown).
  - Masa berlaku Pajak 5 Tahunan / Ganti Plat Kaleng.
  - Masa berlaku SIM A/C pengendara.

### 5. Analitik & Manajemen Profil
- **Bar Chart 6-Bulan Terakhir:** Perbandingan tren bulanan Pengeluaran vs Pemasukan (Chart.js).
- **Donut Chart Proporsi Pengeluaran:** Distribusi pengeluaran per kategori (BBM, Oli, Sparepart, Pajak, Cicilan, dll) lengkap dengan persentase.
- **Metrik Efisiensi Kendaraan:** Biaya per KM (Cost/KM), Rata-rata Konsumsi BBM (KM/L), dan Kategori Biaya Terbesar.
- **Garasi Kendaraan:** Manajemen multi-kendaraan (tambah/edit motor & mobil).
- **Manajemen Database:** Ganti provider data antara LocalStorage, Google Apps Script, dan Supabase secara *hot-swap*.
- **Unduh Data CSV:** Download riwayat transaksi kas dan log servis ke format file `.csv`.

---

## 🚀 Panduan Deployment

### Opsi 1: Menjalankan Langsung Secara Lokal (Zero-Config)
Aplikasi ini dapat langsung dibuka di browser tanpa perlu server atau kompilasi:
1. Double-click file `index.html` di komputer Anda, atau buka via Live Server / browser modern.
2. Aplikasi langsung berjalan menggunakan penyimpanan `LOCAL_DEMO` yang sudah terisi data realistis Indonesia.

---

### Opsi 2: Backend Google Apps Script (Phase 1)
Menggunakan Google Spreadsheet pribadi sebagai cloud database gratis tanpa biaya hosting:
1. Buat Google Spreadsheet baru di [https://sheets.new](https://sheets.new) (Beri nama: `"KendaraTrack Database"`).
2. Di menu atas Spreadsheet, klik: **Extensions (Ekstensi)** > **Apps Script**.
3. Hapus seluruh isi default, lalu salin dan tempel seluruh kode dari berkas [`backend/Code.gs`](file:///C:/Users/hp/.gemini/antigravity/scratch/kendaratrack/backend/Code.gs).
4. Klik tombol **Save** (Simpan).
5. Pada dropdown fungsi di toolbar atas, pilih `setupSheets` lalu klik **Run** (Berikan izin/permission Google akun Anda saat diminta).
6. Klik tombol **Deploy** di kanan atas > pilih **New deployment**.
7. Klik ikon gear/roda gigi di samping *"Select type"* > pilih **Web app**.
8. Atur konfigurasi:
   - **Description:** `KendaraTrack API v1`
   - **Execute as:** `Me` (email Anda)
   - **Who has access:** `Anyone` (Penting agar web app dapat mengakses data tanpa kendala autentikasi Google)
9. Klik **Deploy**, lalu salin URL Web App yang berakhiran `/exec`.
10. Buka aplikasi KendaraTrack di browser > Tab **[Analitik]** > **Penyimpanan & Sinkronisasi** > Pilih **"Google Apps Script"** > Tempel URL Web App > Klik **"Simpan & Uji Koneksi"**.

---

## 🌐 Panduan Online: GitHub & Vercel Deployment

Aplikasi KendaraTrack adalah **Progressive Web App (PWA)** murni tanpa build dependency yang rumit. Anda dapat meng-host-nya secara online 100% gratis dengan performa global super cepat melalui **GitHub + Vercel**.

### Langkah 1: Upload ke GitHub

1. Buka [https://github.com](https://github.com) dan buat repository baru (contoh: `kendaratrack`, set sebagai **Public** atau **Private**).
2. Di komputer Anda, buka terminal / PowerShell / Git Bash di folder `kendaratrack`:
   ```bash
   # Masuk ke direktori
   cd C:\Users\hp\.gemini\antigravity\scratch\kendaratrack

   # Inisialisasi Git
   git init
   git add .
   git commit -m "feat: KendaraTrack Mobile PWA with Finora UI, Photos, Maps & Auth"

   # Hubungkan ke repository GitHub Anda (ganti USERNAME dengan akun Anda)
   git branch -M main
   git remote add origin https://github.com/USERNAME/kendaratrack.git
   git push -u origin main
   ```
   *(Atau Anda bisa menggunakan aplikasi **GitHub Desktop** atau fitur "Upload existing files" langsung di website GitHub).*

---

### Langkah 2: Deploy ke Vercel (Online dalam 1 Menit)

1. Buka [https://vercel.com](https://vercel.com) dan login menggunakan akun GitHub Anda.
2. Di dashboard Vercel, klik tombol **"Add New..."** lalu pilih **"Project"**.
3. Temukan repository **`kendaratrack`** dari daftar GitHub Anda, lalu klik tombol **"Import"**.
4. Di bagian konfigurasi:
   - **Framework Preset:** Pilih `Other`
   - **Root Directory:** `./`
   - *Build and Output Settings* dibiarkan kosong / default.
5. Klik tombol **"Deploy"**.
6. Selesai! Dalam ~15 detik, aplikasi Anda sudah online dengan URL resmi seperti:
   `https://kendaratrack.vercel.app`

---

## 📲 Cara Memasang Aplikasi di Layar Utama HP (Add to Home Screen / PWA)

Pengguna **TIDAK PERLU repot membuka web browser** setiap kali ingin menggunakan KendaraTrack. Aplikasi sudah dilengkapi teknologi **Progressive Web App (PWA)** sehingga dapat langsung dipasang ke layar utama ponsel (Homescreen) layaknya aplikasi asli dari Play Store atau App Store:

### A. Pengguna Android (Google Chrome, Edge, Samsung Internet)
1. Buka URL Vercel aplikasi Anda di browser HP (contoh: `https://kendaratrack.vercel.app`).
2. Banner hijau otomatis akan muncul di bagian atas layar: **"📲 Pasang di Layar Utama HP"**.
3. Klik tombol **"Pasang"** (atau buka menu titik tiga ⋮ di pojok kanan atas browser > pilih **"Instal Aplikasi"** / **"Tambahkan ke Layar Utama"**).
4. Konfirmasi instalasi.
5. Ikon **KendaraTrack** akan langsung muncul di menu dan layar utama ponsel Anda! Aplikasi akan terbuka dalam layar penuh (*standalone*) tanpa bar browser.

### B. Pengguna iPhone / iPad (Apple Safari)
1. Buka link Vercel aplikasi Anda di browser **Safari**.
2. Ketuk tombol **Bagikan / Share** (ikon kotak dengan panah ke atas `⎋`) di bilah navigasi bawah Safari.
3. Gulir ke bawah dan ketuk opsi **"Tambah ke Layar Utama" (Add to Home Screen ➕)**.
4. Ketuk **"Tambah"** di pojok kanan atas.
5. Selesai! KendaraTrack sudah terpasang di layar utama iPhone Anda.

---

## 🧮 Validasi Logika & Perhitungan

1. **Kalkulasi Sisa KM & Kesehatan Oli:**
   $$\text{Target KM} = \text{Odometer Ganti Terakhir} + \text{Interval Oli (KM)}$$
   $$\text{Sisa KM} = \text{Target KM} - \text{Odometer Terkini}$$
   $$\text{Persentase Terpakai} = \min\left(100\%, \frac{\text{KM Terpakai}}{\text{Interval Oli}} \times 100\%\right)$$
2. **Kalkulasi Efisiensi Bahan Bakar (KM/Liter):**
   $$\text{Efisiensi} = \frac{\text{Odometer Saat Ini} - \text{Odometer Pengisian Lalu}}{\text{Jumlah Liter BBM}}$$
3. **Kalkulasi Countdown Hari Kalender:**
   $$\text{Selisih Hari} = \left\lceil \frac{\text{Jatuh Tempo} - \text{Hari Ini}}{1000 \times 60 \times 60 \times 24} \right\rceil$$
4. **Odometer Delta Auto-Sync:**
   Setiap pencatatan transaksi BBM, ganti oli, atau servis dengan nilai odometer lebih tinggi dari odometer tersimpan, sistem secara otomatis memperbarui angka odometer master kendaraan.
