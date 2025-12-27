# HIMAGRO Hub - Web Data Management

Aplikasi web modern untuk mengelola data Proker, Konten Kominfo, dan Steering Committee dari Google Spreadsheet menggunakan Google Apps Script.

## ✨ Fitur Utama

### 🎯 Mode Pengguna
- **Mode Staff** (Default) - Akses standar untuk semua pengguna
- **Mode SC (Steering Committee)** - Mode khusus dengan login username/password untuk tracking history

### 📊 Data Proker (Full CRUD)
- ✅ **View** - Melihat data proker dengan 3 format tampilan:
  - 📅 **Per Bulan** - Dikelompokkan per bulan dengan filter
  - 📋 **Semua** - Tampilan tabel lengkap semua data
  - 🗓️ **Kalender** - Tampilan kalender interaktif
- ✅ **Create** - Menambahkan proker baru
- ✅ **Update** - Mengedit proker yang sudah ada
- ✅ **Delete** - Menghapus proker
- ✅ **Search** - Pencarian data proker
- ✅ **History Tracking** - Mencatat siapa yang mengubah data (Mode SC)

### 📰 Konten Kominfo (Read Only)
- ✅ **View** - Melihat nama konten dan tanggal dengan 3 format tampilan:
  - 📅 **Per Bulan** - Dikelompokkan per bulan dengan filter
  - 📋 **Semua** - Tampilan tabel lengkap semua data
  - 🗓️ **Kalender** - Tampilan kalender interaktif
- ✅ **Search** - Pencarian konten
- ❌ Tidak dapat menambah, mengedit, atau menghapus

### 👥 Steering Committee (Mode SC Only)
- ✅ **View** - Melihat data SC (hanya bisa diakses di Mode SC)

### 🎨 Fitur Tambahan
- 🌙 **Dark Mode** - Toggle dark/light theme
- 🔄 **Refresh Data** - Memuat ulang data dari spreadsheet
- 🗑️ **Clear Cache** - Menghapus cache lokal
- 📅 **Filter Bulan** - Filter data berdasarkan bulan
- 🗓️ **Kalender Interaktif** - Tampilan kalender dengan navigasi bulan

## 📋 Struktur Spreadsheet

### Spreadsheet Proker
Format kolom yang diharapkan:
| ID | Nama | Deskripsi | Tanggal | Status |
|----|------|-----------|---------|--------|
| 1  | ...  | ...       | ...     | Aktif  |

**Catatan:** 
- Kolom pertama (ID) akan di-generate otomatis saat create
- Tanggal format: YYYY-MM-DD
- Status: Aktif, Selesai, atau Dibatalkan
- Sheet "History" akan dibuat otomatis untuk tracking perubahan

### Spreadsheet Konten Kominfo
Format kolom yang diharapkan:
| Nama Konten | Tanggal | ... |
|-------------|---------|-----|
| ...         | ...     | ... |

**Catatan:**
- Hanya kolom pertama (Nama Konten) dan kedua (Tanggal) yang akan ditampilkan
- Kolom lain akan diabaikan

### Spreadsheet Steering Committee
Format kolom yang diharapkan:
| Data | Tanggal | ... |
|------|---------|-----|
| ...  | ...     | ... |

**Catatan:**
- Format bebas, sesuaikan dengan kebutuhan
- Hanya bisa diakses di Mode SC

## 🚀 Setup Instructions

### 1. Persiapan Spreadsheet

#### Buat Spreadsheet Proker:
1. Buat Google Spreadsheet baru
2. Beri nama sheet pertama sebagai `Sheet1` (atau sesuaikan di Apps Script)
3. Buat header di baris pertama:
   - Kolom A: `ID`
   - Kolom B: `Nama`
   - Kolom C: `Deskripsi`
   - Kolom D: `Tanggal`
   - Kolom E: `Status`
4. Copy **Spreadsheet ID** dari URL (bagian antara `/d/` dan `/edit`)
   - Contoh: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

#### Buat Spreadsheet Konten Kominfo:
1. Buat Google Spreadsheet baru
2. Beri nama sheet pertama sebagai `Sheet1` (atau sesuaikan di Apps Script)
3. Pastikan kolom pertama adalah `Nama Konten` dan kolom kedua adalah `Tanggal`
4. Copy **Spreadsheet ID** dari URL

#### Buat Spreadsheet Steering Committee:
1. Buat Google Spreadsheet baru
2. Beri nama sheet pertama sebagai `Sheet1` (atau sesuaikan di Apps Script)
3. Format bebas sesuai kebutuhan
4. Copy **Spreadsheet ID** dari URL

### 2. Setup Google Apps Script

1. Buka [Google Apps Script](https://script.google.com)
2. Klik **"New Project"**
3. Hapus kode default dan copy-paste semua isi dari file `apps-script.gs`
4. Edit konfigurasi di bagian atas file:
   ```javascript
   const SPREADSHEET_ID_PROKER = 'PASTE_ID_SPREADSHEET_PROKER_DISINI';
   const SPREADSHEET_ID_KONTEN = 'PASTE_ID_SPREADSHEET_KONTEN_DISINI';
   const SPREADSHEET_ID_SC = 'PASTE_ID_SPREADSHEET_SC_DISINI';
   ```
5. Jika nama sheet bukan `Sheet1`, ubah juga:
   ```javascript
   const SHEET_NAME_PROKER = 'NamaSheetAnda';
   const SHEET_NAME_KONTEN = 'NamaSheetAnda';
   const SHEET_NAME_SC = 'NamaSheetAnda';
   ```
6. Klik **Save** (Ctrl+S) dan beri nama project, misalnya "HIMAGRO Hub Backend"

### 3. Deploy Apps Script sebagai Web App

1. Di Apps Script editor, klik **Deploy** > **New deployment**
2. Klik ikon **⚙️ (gear)** di sebelah "Select type"
3. Pilih **Web app**
4. Isi konfigurasi:
   - **Description**: HIMAGRO Hub Backend (opsional)
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone** (atau "Anyone with Google account" untuk lebih aman)
5. Klik **Deploy**
6. **PENTING**: Authorize access saat diminta:
   - Klik "Authorize access"
   - Pilih akun Google Anda
   - Klik "Advanced" > "Go to [project name] (unsafe)"
   - Klik "Allow"
7. Copy **Web App URL** yang muncul (format: `https://script.google.com/macros/s/...`)

### 4. Setup Web Frontend

1. Buka file `script.js`
2. Ganti `YOUR_APPS_SCRIPT_WEB_APP_URL` dengan Web App URL yang sudah di-copy:
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
   ```
3. Simpan file

### 5. Menjalankan Web

#### Opsi 1: Local Server (Recommended)
```bash
# Menggunakan Python
python -m http.server 8000

# Atau menggunakan Node.js (http-server)
npx http-server -p 8000
```
Kemudian buka browser: `http://localhost:8000`

#### Opsi 2: Hosting Static
- Upload semua file ke hosting static (GitHub Pages, Netlify, Vercel, dll)
- Pastikan semua file (index.html, styles.css, script.js) ada di root directory

#### Opsi 3: Langsung Buka File
- Buka `index.html` langsung di browser (mungkin ada masalah CORS)

## 📖 Cara Penggunaan

### Mode Staff (Default)
1. Buka aplikasi web
2. Secara default, Anda akan masuk ke Mode Staff
3. Anda dapat melihat dan mengelola data Proker
4. Anda dapat melihat data Konten Kominfo (read-only)
5. Section SC tidak dapat diakses

### Mode SC (Steering Committee)
1. Klik tombol **"Masuk Mode SC"** di navigation bar
2. Masukkan **Username** dan **Password**
3. Klik **"Masuk"**
4. Sekarang Anda berada di Mode SC
5. Semua perubahan pada Proker akan tercatat dengan username Anda
6. Section SC sekarang dapat diakses
7. Untuk keluar, klik **"Keluar Mode SC"**

**Catatan:** Username dan password tidak digunakan untuk autentikasi, melainkan untuk tracking history siapa yang melakukan perubahan.

### Tampilan Data

#### Tampilan Per Bulan (Default)
- Data dikelompokkan per bulan
- Gunakan dropdown "Pilih Bulan" untuk filter bulan tertentu
- Pilih "Semua Bulan" untuk menampilkan semua data

#### Tampilan Semua
- Semua data ditampilkan dalam bentuk tabel
- Sudah dikelompokkan per bulan secara otomatis

#### Tampilan Kalender
- Data ditampilkan dalam bentuk kalender
- Gunakan tombol ◀ dan ▶ untuk navigasi bulan
- Klik pada tanggal untuk melihat detail (jika ada)

### Dark Mode
- Klik ikon 🌙/☀️ di navigation bar untuk toggle dark mode
- Preferensi akan tersimpan di browser

### Refresh & Clear Cache
- **Refresh**: Klik ikon 🔄 untuk memuat ulang data dari spreadsheet
- **Clear Cache**: Klik ikon 🗑️ untuk menghapus cache dan memuat ulang data

## 🔍 History Tracking

Semua perubahan pada data Proker akan dicatat di sheet "History" di spreadsheet Proker dengan format:
| Timestamp | Action | Type | ID | Nama | Username | Details |
|-----------|--------|------|----|------|----------|---------|
| 2024-01-15 10:30:00 | CREATE | Proker | 1 | Nama Proker | username | - |
| 2024-01-15 11:00:00 | UPDATE | Proker | 1 | Nama Proker | username | {"old":{...},"new":{...}} |
| 2024-01-15 12:00:00 | DELETE | Proker | 1 | Nama Proker | username | - |

**Catatan:** History hanya dicatat jika perubahan dilakukan di Mode SC. Perubahan di Mode Staff akan tercatat dengan username "Staff".

## 🐛 Troubleshooting

### Error: "Gagal memuat data"
- Pastikan Spreadsheet ID sudah benar
- Pastikan nama sheet sudah benar
- Pastikan Apps Script sudah di-deploy
- Pastikan Web App URL sudah benar di `script.js`
- Cek browser console (F12) untuk error detail

### Error: "Action tidak valid"
- Pastikan Apps Script sudah di-deploy ulang setelah perubahan
- Pastikan Web App URL sudah benar

### Data tidak muncul
- Pastikan spreadsheet sudah memiliki data (minimal header)
- Pastikan format kolom sesuai dengan yang diharapkan
- Cek Apps Script execution log (View > Executions)

### Permission Denied
- Pastikan saat deploy, "Who has access" sudah di-set ke "Anyone" atau "Anyone with Google account"
- Pastikan sudah authorize Apps Script dengan benar

### Dark Mode tidak tersimpan
- Pastikan browser mengizinkan localStorage
- Cek browser console untuk error

### Kalender tidak muncul
- Pastikan data memiliki tanggal yang valid
- Cek format tanggal di spreadsheet (harus format date, bukan text)

## 📁 File Structure

```
HIMAGRO HUB/
│
├── index.html          # HTML structure
├── styles.css          # CSS styling (dengan dark mode)
├── script.js           # Frontend JavaScript
├── apps-script.gs      # Google Apps Script backend
└── README.md           # Dokumentasi ini
```

## 🛠️ Teknologi

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Google Apps Script
- **Database**: Google Spreadsheet
- **Storage**: LocalStorage (untuk dark mode preference)

## ⚠️ Catatan Penting

1. **Apps Script Quota**: Google Apps Script memiliki batas eksekusi harian. Untuk penggunaan intensif, pertimbangkan menggunakan Google Sheets API.

2. **Security**: Web App URL bisa diakses siapa saja jika di-set "Anyone". Untuk keamanan lebih, gunakan "Anyone with Google account" dan batasi akses spreadsheet.

3. **CORS**: Apps Script Web App sudah meng-handle CORS dengan baik, jadi tidak perlu khawatir tentang CORS error.

4. **Update Apps Script**: Setelah mengubah kode Apps Script, Anda harus **deploy ulang** (Deploy > Manage deployments > Edit > New version > Deploy).

5. **History Tracking**: Sheet "History" akan dibuat otomatis di spreadsheet Proker saat pertama kali ada perubahan. Pastikan spreadsheet Proker memiliki permission untuk membuat sheet baru.

6. **Username/Password**: Username dan password di Mode SC tidak digunakan untuk autentikasi keamanan, melainkan hanya untuk tracking history. Semua user tetap bisa mengakses semua fitur.

## 📝 Changelog

### v2.0.0
- ✨ Tambah Mode SC dengan login
- ✨ Tambah section Steering Committee
- ✨ Tambah dark mode
- ✨ Tambah tombol refresh dan clear cache
- ✨ Tambah 3 format tampilan (Per Bulan, Semua, Kalender)
- ✨ Tambah filter berdasarkan bulan
- ✨ Tambah history tracking
- 🎨 UI lebih modern dan ringan
- 📱 Responsive design yang lebih baik

### v1.0.0
- ✨ Fitur CRUD untuk Proker
- ✨ Read-only untuk Konten Kominfo
- ✨ Search functionality

---

**Dibuat untuk HIMAGRO Hub** 🚀
